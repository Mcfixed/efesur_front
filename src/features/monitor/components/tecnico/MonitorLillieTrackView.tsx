import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMonitorDeviceTrack, useMonitorDevices } from "../../hooks/useMonitor";
import type { MonitorDevice, MonitorTrackPoint } from "../../types/monitor.types";
import { IconAntenna, IconBattery, IconEye, IconEyeOff, IconMapPin, IconRoute, IconX } from "@tabler/icons-react";

// Vista LillieGo: recorrido del tracker con un rayo a cada gateway y línea de tiempo.
// Misma capa base que el resto de las pestañas (ArcGIS Dark Gray): no requiere API key.
const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

// Escalas de color (la de RSSI es la misma que usa la vista de señal).
const POR_SNR = (snr: number | null) => snr == null ? '#64748b' : snr >= 10 ? '#4ade80' : snr >= 5 ? '#2dd4bf' : snr >= 0 ? '#fbbf24' : snr >= -7 ? '#fb923c' : '#f87171';
const POR_RSSI = (rssi: number | null) => rssi == null ? '#64748b' : rssi >= -100 ? '#4ade80' : rssi >= -110 ? '#2dd4bf' : rssi >= -118 ? '#38bdf8' : rssi >= -120 ? '#fb923c' : '#f87171';
const POR_GW = (n: number) => n >= 3 ? '#38bdf8' : n === 2 ? '#4ade80' : n === 1 ? '#fbbf24' : '#64748b';

type Metrica = 'snr' | 'rssi' | 'gw';
const METRICAS: [Metrica, string][] = [['snr', 'SNR'], ['rssi', 'RSSI'], ['gw', 'Gateways']];

const colorPunto = (p: MonitorTrackPoint, m: Metrica) =>
  m === 'snr' ? POR_SNR(p.snr) : m === 'rssi' ? POR_RSSI(p.rssi) : POR_GW(p.n_gw);

const valorMetrica = (p: MonitorTrackPoint, m: Metrica) =>
  m === 'snr' ? (p.snr == null ? '—' : `${p.snr.toFixed(1)} dB`)
    : m === 'rssi' ? (p.rssi == null ? '—' : `${p.rssi.toFixed(0)} dBm`)
      : `${p.n_gw} gw`;

const LEYENDAS: Record<Metrica, { c: string; t: string }[]> = {
  snr: [
    { c: '#4ade80', t: '≥ 10 dB' }, { c: '#2dd4bf', t: '5 a 10' }, { c: '#fbbf24', t: '0 a 5' },
    { c: '#fb923c', t: '-7 a 0' }, { c: '#f87171', t: '< -7' },
  ],
  rssi: [
    { c: '#4ade80', t: '≥ -100' }, { c: '#2dd4bf', t: '-110' }, { c: '#38bdf8', t: '-118' },
    { c: '#fb923c', t: '-120' }, { c: '#f87171', t: '< -120' },
  ],
  gw: [
    { c: '#38bdf8', t: '3 o más' }, { c: '#4ade80', t: '2' }, { c: '#fbbf24', t: '1' }, { c: '#64748b', t: '0' },
  ],
};

const RANGOS = [[1, '24 h'], [7, '7 días'], [30, '30 días']] as const;

// Rumbo (grados desde el norte) entre dos puntos: orienta las flechas del recorrido
const rumbo = (a: [number, number], b: [number, number]) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLng = rad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const claveGw = (g: { eui: string | null; name: string | null }) => String(g.eui ?? g.name ?? '?').toLowerCase();

// Nombre del gateway, o "Desconocido" si su EUI no está registrado.
const etiquetaGw = (g: { name: string | null }) => g.name ?? 'Desconocido';

export default function MonitorLillieTrackView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Map<number, L.CircleMarker>>(new Map());
  const fitKey = useRef<string>('');
  // Firma del último dibujo: si el refresco trae exactamente los mismos puntos no se redibuja
  const firma = useRef<string>('');

  const { data: allDevices } = useMonitorDevices();
  const trackers = useMemo(
    () => (allDevices || []).filter((d: MonitorDevice) => d.type_device === 'LillieGo'),
    [allDevices]
  );

  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [dias, setDias] = useState<number>(1);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [metrica, setMetrica] = useState<Metrica>('snr');
  const [verEnlaces, setVerEnlaces] = useState(true);
  const filaSelRef = useRef<HTMLLIElement>(null);

  // Sin setState dentro de un efecto: el dispositivo activo se deriva de la selección
  const activo = deviceId ?? trackers[0]?.id ?? null;

  const { data: track, isLoading, isFetching } = useMonitorDeviceTrack(activo, { dias });
  const puntos = useMemo<MonitorTrackPoint[]>(() => track?.puntos ?? [], [track]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [-36.76, -73.11], zoom: 13,
      attributionControl: false, maxZoom: 20, zoomSnap: 0.5,
      zoomControl: false,
    });
    L.tileLayer(TILES_DARK, { maxZoom: 20, maxNativeZoom: 16, attribution: '&copy; Esri' }).addTo(map);
    layers.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    const marks = markers.current;
    return () => {
      map.remove();
      mapInstance.current = null;
      layers.current = null;
      marks.clear();
    };
  }, []);

  // Dibujo del recorrido
  useEffect(() => {
    const map = mapInstance.current;
    const layer = layers.current;
    if (!map || !layer) return;

    const claveDibujo = `${activo}|${dias}|${metrica}|${verEnlaces}|${selIdx ?? 'x'}|${puntos.length}|${puntos[0]?.ts ?? ''}|${puntos[puntos.length - 1]?.ts ?? ''}`;
    if (firma.current === claveDibujo) return;
    firma.current = claveDibujo;

    layer.clearLayers();
    markers.current.clear();
    if (puntos.length === 0) return;

    const latlngs = puntos.map(p => [p.lat, p.lng] as [number, number]);
    // Se dibujan menos elementos cuando hay muchos puntos, para no ahogar el mapa
    const salto = Math.max(1, Math.ceil(puntos.length / 120));
    const idx = selIdx != null && selIdx >= 0 && selIdx < puntos.length ? selIdx : null;

    // Rayo punto → gateway: trazo nítido = buena señal, tenue = marginal
    if (verEnlaces) {
      puntos.forEach((p, i) => {
        const esActual = i === idx;
        if (!esActual && i % salto !== 0 && i !== puntos.length - 1) return;
        p.gateways.forEach(g => {
          if (g.lat == null || g.lng == null) return;
          L.polyline([[p.lat, p.lng], [g.lat, g.lng]], {
            color: POR_SNR(g.snr),
            weight: esActual ? 2 : 1,
            opacity: idx == null ? 0.38 : esActual ? 0.95 : 0.18,
            interactive: false,
          }).addTo(layer);
        });
      });
    }

    const stats = new Map<string, { n: number; mejor: number | null }>();
    puntos.forEach(p => p.gateways.forEach(g => {
      const k = claveGw(g);
      const s = stats.get(k) ?? { n: 0, mejor: null };
      s.n += 1;
      if (g.snr != null && (s.mejor == null || g.snr > s.mejor)) s.mejor = g.snr;
      stats.set(k, s);
    }));

    const gwVistos = new Set<string>();
    puntos.forEach(p => p.gateways.forEach(g => {
      if (g.lat == null || g.lng == null) return;
      const k = claveGw(g);
      if (gwVistos.has(k)) return;
      gwVistos.add(k);

      const s = stats.get(k);
      L.marker([g.lat, g.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                   <div style="background:#0f172a;border:1.5px solid #38bdf8;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(56,189,248,0.5);">
                     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round">
                       <path d="M12 20v-6"/><path d="M3 9a17 17 0 0 1 18 0"/><path d="M6 13a10 10 0 0 1 12 0"/><path d="M9 16.5a5 5 0 0 1 6 0"/>
                     </svg>
                   </div>
                   <span style="font-size:9px;font-weight:600;color:#e2e8f0;background:rgba(2,6,23,0.88);padding:0 4px;border-radius:3px;white-space:nowrap;">${etiquetaGw(g)}</span>
                   <span style="font-size:8px;font-family:monospace;color:#94a3b8;background:rgba(2,6,23,0.88);padding:0 3px;border-radius:3px;white-space:nowrap;">${g.eui ?? '—'}</span>
                 </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(layer).bindTooltip(
        `<div style="font-weight:600;color:#f1f5f9;">${etiquetaGw(g)}</div>
         <div style="font-family:monospace;font-size:9px;color:#94a3b8;">${g.eui ?? '—'}</div>
         <div style="color:#94a3b8;margin-top:2px;">Recibió ${s?.n ?? 0} punto${(s?.n ?? 0) === 1 ? '' : 's'} del recorrido</div>
         ${s?.mejor != null ? `<div style="color:${POR_SNR(s.mejor)};margin-top:1px;">Mejor SNR ${s.mejor.toFixed(1)} dB</div>` : ''}`,
        { direction: 'top', offset: [0, -14], className: 'lillie-tip' }
      );
    }));

    if (idx != null && idx > 0) {
      L.polyline(latlngs.slice(0, idx + 1), { color: '#38bdf8', weight: 4, opacity: 0.95, interactive: false }).addTo(layer);
      if (idx < puntos.length - 1) {
        L.polyline(latlngs.slice(idx), { color: '#38bdf8', weight: 2, opacity: 0.25, interactive: false }).addTo(layer);
      }
    } else {
      L.polyline(latlngs, { color: '#38bdf8', weight: 10, opacity: 0.10, interactive: false }).addTo(layer);
      L.polyline(latlngs, { color: '#38bdf8', weight: 3, opacity: 0.9, interactive: false }).addTo(layer);
    }

    const pasoFlecha = Math.max(1, Math.floor(puntos.length / 8));
    for (let i = pasoFlecha; i < puntos.length; i += pasoFlecha) {
      const a = latlngs[i - 1], b = latlngs[i];
      const g = rumbo(a, b);
      L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<svg width="11" height="11" viewBox="0 0 10 10" style="transform:rotate(${(g - 90).toFixed(1)}deg);opacity:0.85;"><path d="M0 0 L10 5 L0 10 Z" fill="#7dd3fc"/></svg>`,
          iconSize: [11, 11], iconAnchor: [5.5, 5.5],
        }),
      }).addTo(layer);
    }

    const r = puntos.length > 200 ? 3 : puntos.length > 80 ? 4 : 5;
    puntos.forEach((p, i) => {
      const c = colorPunto(p, metrica);
      const sel = i === idx;
      const cm = L.circleMarker([p.lat, p.lng], {
        radius: sel ? r + 3 : r,
        weight: sel ? 2.5 : 1.5,
        color: sel ? '#ffffff' : c,
        fillColor: c, fillOpacity: 0.9,
      }).addTo(layer);
      cm.bindTooltip(tooltipHtml(p, metrica), { direction: 'top', offset: [0, -6], className: 'lillie-tip' });
      cm.bindPopup(popupHtml(p), { className: 'dark-popup' });
      cm.on('click', () => setSelIdx(i));
      markers.current.set(i, cm);
    });

    if (idx != null) {
      const ps = puntos[idx];
      L.marker([ps.lat, ps.lng], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
                   <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-white opacity-25"></span>
                   <span style="position:relative;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #0f172a;"></span>
                 </div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).addTo(layer);
    }

    const p0 = puntos[0];
    const pN = puntos[puntos.length - 1];
    L.marker([p0.lat, p0.lng], {
      interactive: false,
      icon: L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#94a3b8;border:2px solid #0f172a;box-shadow:0 0 0 2px rgba(148,163,184,0.5);"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      }),
    }).addTo(layer);
    L.marker([pN.lat, pN.lng], {
      interactive: false,
      icon: L.divIcon({
        className: '',
        html: `<div style="position:relative;width:12px;height:12px;display:flex;align-items:center;justify-content:center;">
                 <span class="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-sky-400 opacity-70"></span>
                 <span style="position:relative;width:12px;height:12px;border-radius:50%;background:#38bdf8;border:2px solid #0f172a;"></span>
               </div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      }),
    }).addTo(layer);

    // Solo se reencuadra cuando cambia el dispositivo o el período: si no, cada refresco
    const clave = `${activo}|${dias}`;
    if (fitKey.current !== clave) {
      fitKey.current = clave;
      map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: 17 });
    }
  }, [puntos, activo, dias, metrica, verEnlaces, selIdx]);

  const irAPunto = (i: number) => {
    const p = puntos[i];
    if (!p) return;
    setSelIdx(i);
    const map = mapInstance.current;
    if (map) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
    window.setTimeout(() => markers.current.get(i)?.openPopup(), 550);
  };

  const lista = useMemo(() => puntos.map((p, i) => ({ p, i })).reverse(), [puntos]);
  const ultimo = puntos[puntos.length - 1] ?? null;

  const puntoSel = selIdx != null && selIdx >= 0 && selIdx < puntos.length ? puntos[selIdx] : null;
  const sliderIdx = selIdx ?? Math.max(0, puntos.length - 1);
  const etiquetaHora = (ts?: string) => (ts ? format(new Date(ts), dias > 1 ? 'dd/MM HH:mm' : 'HH:mm:ss') : '—');

  useEffect(() => {
    filaSelRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selIdx]);

  return (
    <div className="absolute inset-0 z-300 flex bg-gray-950">
      <style>{`
        /* Tooltips del mapa (hover): fondo oscuro igual que los popups */
        .leaflet-tooltip.lillie-tip {
          background: rgba(2,6,23,0.95);
          border: 1px solid rgba(148,163,184,0.28);
          border-radius: 6px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.55);
          color: #e2e8f0;
          font-size: 10px;
          line-height: 1.35;
          padding: 3px 6px;
          white-space: nowrap;
        }
        .leaflet-tooltip.lillie-tip::before { display: none; }
      `}</style>
      <div className="flex-1 min-w-0 relative">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400, background: '#09090b' }} />

        {/* Sin dispositivos del tipo o sin datos: se explica qué falta en vez de mostrar un mapa vacío */}
        {!activo && !isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-xl border border-gray-700/80 bg-black/85 p-5 text-center backdrop-blur-md">
              <IconRoute size={28} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm font-semibold text-gray-100">No hay dispositivos LillieGo</p>
              <p className="mt-1 text-xs text-gray-400">
                Créalo en <span className="text-gray-200">Configuración → Dispositivos</span> con el tipo
                <span className="text-gray-200"> LillieGo</span> y su DevEUI. Después vuelve a esta vista.
              </p>
            </div>
          </div>
        )}

        {activo && !isLoading && puntos.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-xl border border-gray-700/80 bg-black/85 p-5 text-center backdrop-blur-md">
              <IconMapPin size={28} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm font-semibold text-gray-100">Sin puntos con GPS válido</p>
              <p className="mt-1 text-xs text-gray-400">
                En el período elegido no hay uplinks con fix. Prueba con un rango más amplio o inyecta
                datos de prueba desde Node-RED.
              </p>
            </div>
          </div>
        )}

        {/* Leyenda: cambia con la métrica elegida, así el color del punto siempre se entiende */}
        {puntos.length > 0 && (
          <div className="absolute bottom-14 left-4 z-400 rounded-lg border border-gray-700/80 bg-black/85 px-3 py-2 backdrop-blur-md">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {metrica === 'snr' ? 'SNR del punto' : metrica === 'rssi' ? 'RSSI del punto' : 'Gateways por punto'}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-300">
              {LEYENDAS[metrica].map(l => (
                <span key={l.t} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                  {l.t}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-3 border-t border-gray-800 pt-1.5 text-[10px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg width="9" height="9" viewBox="0 0 10 10"><path d="M0 0 L10 5 L0 10 Z" fill="#7dd3fc" /></svg>
                sentido
              </span>
              {verEnlaces && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-0.5 rounded" style={{ background: 'linear-gradient(#4ade80,#f87171)' }} />
                  rayo = gateway que recibió el punto
                </span>
              )}
            </div>
          </div>
        )}

        {/* Datos del punto que marca la línea de tiempo */}
        {puntoSel && (
          <div className="absolute right-3 top-3 z-400 w-60 rounded-lg border border-gray-700/80 bg-black/90 p-2.5 backdrop-blur-md">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-gray-100">{etiquetaHora(puntoSel.ts)}</p>
                <p className="text-[10px] text-gray-500">{puntoSel.lat.toFixed(5)}, {puntoSel.lng.toFixed(5)}</p>
              </div>
              <button type="button" onClick={() => setSelIdx(null)} title="Quitar selección"
                className="ml-auto shrink-0 text-gray-500 transition-colors hover:text-gray-200">
                <IconX size={13} />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
              <span className="rounded px-1.5 py-0.5" style={{ background: `${POR_SNR(puntoSel.snr)}22`, color: POR_SNR(puntoSel.snr) }}>
                SNR {puntoSel.snr != null ? puntoSel.snr.toFixed(1) : '—'}
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5" style={{ color: POR_RSSI(puntoSel.rssi) }}>
                RSSI {puntoSel.rssi != null ? puntoSel.rssi.toFixed(0) : '—'}
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5" style={{ color: POR_GW(puntoSel.n_gw) }}>
                {puntoSel.n_gw} gw
              </span>
              {puntoSel.bateria_mv != null && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-gray-300">
                  {(puntoSel.bateria_mv / 1000).toFixed(2)} V
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5 border-t border-gray-800 pt-1.5">
              {puntoSel.gateways.length === 0 ? (
                <p className="text-[10px] text-gray-500">sin gateways registrados</p>
              ) : puntoSel.gateways.map((g, k) => (
                <div key={`${claveGw(g)}-${k}`} className="py-0.5">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-gray-300">{etiquetaGw(g)}</span>
                    <span className="shrink-0 font-mono" style={{ color: POR_SNR(g.snr) }}>
                      {g.snr != null ? `${g.snr.toFixed(1)} dB` : '—'}
                    </span>
                  </div>
                  {/* El DevEUI va al lado solo para poder buscarlo en Configuración */}
                  <p className="truncate font-mono text-[9px] text-gray-500">{g.eui ?? 'sin EUI'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Línea de tiempo: se arrastra y va mostrando cada punto en el mapa */}
        {puntos.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-400 border-t border-gray-800 bg-black/90 px-4 py-2 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-mono text-[10px] text-gray-500">{etiquetaHora(puntos[0]?.ts)}</span>
              <input
                type="range" min={0} max={Math.max(0, puntos.length - 1)} step={1}
                value={sliderIdx}
                onChange={e => setSelIdx(Number(e.target.value))}
                title="Arrastra para recorrer la línea de tiempo"
                className="w-full cursor-pointer accent-sky-400"
              />
              <span className="w-20 shrink-0 text-right font-mono text-[10px] text-gray-500">{etiquetaHora(ultimo?.ts)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Panel de línea de tiempo */}
      <div className="flex w-[21rem] shrink-0 flex-col border-l border-gray-800 bg-gray-950/95">
        <div className="border-b border-gray-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <IconRoute size={16} className="text-sky-400" />
            <span className="text-sm font-semibold text-gray-100">Recorrido LillieGo</span>
            {/* Se refresca cada 10 s: el punto indica que está consultando */}
            <span
              title={isFetching ? 'Actualizando…' : 'Al día'}
              className={`ml-auto h-1.5 w-1.5 rounded-full transition-colors ${isFetching ? 'animate-pulse bg-sky-400' : 'bg-emerald-400/60'}`}
            />
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <select
              value={activo ?? ''}
              onChange={e => { setDeviceId(Number(e.target.value)); setSelIdx(null); }}
              disabled={trackers.length === 0}
              className="min-w-0 flex-1 rounded-md border border-gray-700 bg-black/60 px-2 py-1 text-xs text-gray-200 outline-none disabled:opacity-50"
            >
              {trackers.length === 0 && <option value="">Sin dispositivos</option>}
              {trackers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-0.5 rounded-md border border-gray-700 bg-black/60 p-0.5">
              {RANGOS.map(([d, label]) => (
                <button key={d} type="button" onClick={() => { setDias(d); setSelIdx(null); }}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${dias === d ? 'bg-white/15 text-gray-100' : 'text-gray-400 hover:text-gray-100'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Qué se colorea en el mapa + encendido/apagado de los rayos a los gateways */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-gray-700 bg-black/60 p-0.5">
              {METRICAS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => setMetrica(k)}
                  title={`Colorear los puntos según ${label}`}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${metrica === k ? 'bg-white/15 text-gray-100' : 'text-gray-400 hover:text-gray-100'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setVerEnlaces(v => !v)}
              title={verEnlaces ? 'Ocultar los rayos punto → gateway' : 'Mostrar los rayos punto → gateway'}
              className={`ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${verEnlaces ? 'border-sky-400/40 bg-sky-500/15 text-sky-300' : 'border-gray-700 bg-black/60 text-gray-400 hover:text-gray-200'}`}>
              {verEnlaces ? <IconEye size={12} /> : <IconEyeOff size={12} />} Rayos
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded-md border border-gray-800 bg-black/40 px-2 py-1">
              <p className="text-gray-500">Puntos</p>
              <p className="font-semibold text-gray-100">{track?.resumen.puntos ?? 0}</p>
            </div>
            <div className="rounded-md border border-gray-800 bg-black/40 px-2 py-1">
              <p className="text-gray-500">Distancia</p>
              <p className="font-semibold text-gray-100">
                {(track?.resumen.distancia_km ?? 0) < 1
                  ? `${Math.round((track?.resumen.distancia_km ?? 0) * 1000)} m`
                  : `${(track?.resumen.distancia_km ?? 0).toFixed(1)} km`}
              </p>
            </div>
            <div className="rounded-md border border-gray-800 bg-black/40 px-2 py-1">
              <p className="text-gray-500">Gateways / punto</p>
              <p className="font-semibold text-gray-100">{track?.resumen.gw_promedio ?? 0}</p>
            </div>
            <div className="rounded-md border border-gray-800 bg-black/40 px-2 py-1">
              <p className="text-gray-500">Sin fix GPS</p>
              <p className="font-semibold text-gray-100">{track?.resumen.sin_fix ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-500">Sin puntos en el período.</p>
          ) : (
            <ul className="divide-y divide-gray-800/70">
              {lista.map(({ p, i }) => {
                const esUltimo = i === puntos.length - 1;
                return (
                  <li key={`${p.ts}-${i}`} ref={selIdx === i ? filaSelRef : undefined}>
                    <button type="button" onClick={() => irAPunto(i)}
                      className={`w-full px-3 py-2 text-left transition-colors ${selIdx === i ? 'bg-sky-400/10' : 'hover:bg-white/5'}`}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorPunto(p, metrica) }} />
                        <span className="font-mono text-xs text-gray-100">
                          {dias > 1 ? format(new Date(p.ts), 'dd/MM HH:mm') : format(new Date(p.ts), 'HH:mm:ss')}
                        </span>
                        {esUltimo && (
                          <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                            último
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold" style={{ color: colorPunto(p, metrica) }}>
                          {metrica === 'gw' && <IconAntenna size={12} />} {valorMetrica(p, metrica)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 pl-4 text-[10px] text-gray-500">
                        <span className="truncate">
                          {p.gateways.length > 0
                            ? p.gateways.map(g => etiquetaGw(g)).join(' · ')
                            : 'sin gateways registrados'}
                        </span>
                        {p.bateria_mv != null && (
                          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-gray-400">
                            <IconBattery size={11} /> {(p.bateria_mv / 1000).toFixed(2)} V
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {ultimo && (
          <div className="border-t border-gray-800 px-3 py-2 text-[10px] text-gray-500">
            Último punto {format(new Date(ultimo.ts), 'dd/MM/yyyy HH:mm')} · {ultimo.lat.toFixed(5)}, {ultimo.lng.toFixed(5)}
          </div>
        )}
      </div>
    </div>
  );
}

// Popup del punto (clic): hora, gateways que lo recibieron con su RSSI/SNR y batería
function popupHtml(p: MonitorTrackPoint) {
  const hora = format(new Date(p.ts), 'dd/MM/yyyy HH:mm:ss');
  const gws = p.gateways.length === 0
    ? '<div style="color:#64748b;">sin gateways registrados</div>'
    : p.gateways.map(g => `
        <div style="padding:1px 0;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;">
            <span style="color:#cbd5e1;">${etiquetaGw(g)}</span>
            <span style="font-family:monospace;color:${POR_SNR(g.snr)};">
              ${g.snr != null ? `${g.snr.toFixed(1)} dB` : '—'}${g.rssi != null ? ` · ${g.rssi} dBm` : ''}
            </span>
          </div>
          <div style="font-family:monospace;font-size:9px;color:#64748b;">${g.eui ?? '—'}</div>
        </div>`).join('');

  return `
    <div style="font-size:11px;min-width:190px;">
      <div style="font-weight:600;font-size:12px;color:#f1f5f9;">${hora}</div>
      <div style="margin-top:2px;color:#94a3b8;">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
      <div style="margin-top:6px;font-size:10px;color:${POR_GW(p.n_gw)};font-weight:600;">
        ${p.n_gw} gateway${p.n_gw === 1 ? '' : 's'} · mejor SNR ${p.snr != null ? p.snr.toFixed(1) : '—'} dB
      </div>
      <div style="margin-top:2px;display:flex;flex-direction:column;gap:1px;">${gws}</div>
      ${p.bateria_mv != null ? `<div style="margin-top:6px;color:#94a3b8;">Batería ${(p.bateria_mv / 1000).toFixed(2)} V</div>` : ''}
    </div>`;
}

// Tooltip al pasar el mouse: los tres datos del punto sin tener que hacer clic
function tooltipHtml(p: MonitorTrackPoint, metrica: Metrica) {
  return `<div>
      <div style="font-weight:600;color:#f1f5f9;">${format(new Date(p.ts), 'HH:mm:ss')}</div>
      <div style="margin-top:1px;color:${colorPunto(p, metrica)};font-weight:600;">${valorMetrica(p, metrica)}</div>
      <div style="margin-top:1px;color:#94a3b8;">${p.n_gw} gw${p.rssi != null ? ` · ${p.rssi.toFixed(0)} dBm` : ''}</div>
    </div>`;
}
