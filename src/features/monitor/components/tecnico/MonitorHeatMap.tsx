import { useEffect, useRef, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDayReport } from "../../hooks/useMonitor";
import type { MonitorDaySensor, MonitorDevice } from "../../types/monitor.types";
import { renderToString } from "react-dom/server";
import MonitorSensorPanel from "./MonitorSensorPanel";
import MonitorDayReportModal from "../shared/MonitorDayReportModal";
import MonitorLillieTrackView from "./MonitorLillieTrackView";
import { matchesSearch } from "@/utils/text";
import { isFreshForDevice } from "../../utils/online";
import { formatBattery, batteryColor, formatStationBattery, stationBatteryColor } from "../../utils/battery";
import { 
  IconAntenna, 
  IconBook, 
  IconBuildingFactory, 
  IconFileSpreadsheet,
  IconMapPin,
  IconSearch,
  IconX
} from "@tabler/icons-react";

// ─── Escalas de señal ───
// RSSI (dBm): en 125 kHz el piso de ruido ronda -117 dBm, así que -110 es señal sobre el ruido,
// -110..-120 está al borde y <= -120 sólo funciona por debajo del ruido (SNR negativo).
const GRIS = '#64748b';
const VERDE = '#4ade80';
const TURQUESA = '#2dd4bf';
const AMBAR = '#fbbf24';
const NARANJA = '#fb923c';
const ROJO = '#f87171';

function rssiColor(rssi: number | null): string {
  if (rssi == null || !Number.isFinite(rssi)) return GRIS;
  if (rssi > -40) return GRIS; // atípico (imposible con antena real): no se pinta como buena señal
  if (rssi > -110) return VERDE;
  if (rssi > -120) return NARANJA;
  return ROJO;
}

// SNR (dB): límites del demodulador LoRa (>0 excelente, -7 límite de SF7, -12, -17 casi sin enlace).
function snrColor(snr: number | null): string {
  if (snr == null || !Number.isFinite(snr)) return GRIS;
  if (snr > 0) return VERDE;
  if (snr > -7) return TURQUESA;
  if (snr > -12) return AMBAR;
  if (snr > -17) return NARANJA;
  return ROJO;
}

function snrEtiqueta(snr: number | null): string {
  if (snr == null || !Number.isFinite(snr)) return 'sin dato';
  if (snr > 0) return 'excelente';
  if (snr > -7) return 'buena';
  if (snr > -12) return 'marginal';
  if (snr > -17) return 'crítica';
  return 'sin enlace';
}

// Los helpers de batería devuelven clases Tailwind; el popup es HTML, así que se traducen.
const COLOR_TEXTO: Record<string, string> = {
  'text-green-400': VERDE, 'text-orange-400': NARANJA, 'text-red-400': ROJO, 'text-text-300': '#94a3b8',
};

/** Banco de 12 V del MPPT (estación/lector) o tensión de la celda del sensor (mV). */
function bateriaDe(d: MonitorDevice): { texto: string; color: string; etiqueta: string } {
  if (d.battery_v != null && Number.isFinite(Number(d.battery_v)) && Number(d.battery_v) < 500) {
    return { texto: formatStationBattery(d.battery_v), color: COLOR_TEXTO[stationBatteryColor(d.battery_v)] ?? '#94a3b8', etiqueta: 'Banco 12 V' };
  }
  const mV = d.last_value != null && `${d.last_value}` !== '' ? Number(d.last_value) : null;
  if (mV != null && Number.isFinite(mV) && mV > 1000) {
    return { texto: formatBattery(mV), color: COLOR_TEXTO[batteryColor(mV)] ?? '#94a3b8', etiqueta: 'Batería' };
  }
  return { texto: '—', color: '#94a3b8', etiqueta: 'Batería' };
}

interface GwRx { eui?: string | null; name?: string | null; snr?: number | null; rssi?: number | null }
interface PopupTel { rssi: number | null; snr: number | null; ts?: string | null; gateways?: GwRx[] }

function nombreGateway(m: Map<string, string>, eui?: string | null): string | null {
  if (!eui) return null;
  const e = String(eui).toLowerCase();
  return m.get(e) ?? m.get(e.slice(-6)) ?? null;
}

const chip = (texto: string, color: string) =>
  `<span style="display:inline-flex;align-items:center;font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${color};background:${color}1f;border:1px solid ${color}44;border-radius:999px;padding:2px 6px;">${texto}</span>`;

/** Popup del mapa: métricas del equipo, batería y los gateways que recibieron el dato. */
function construirPopup(
  d: MonitorDevice,
  tel: PopupTel | undefined,
  cob: MonitorDaySensor | undefined,
  resolver: (eui?: string | null) => string | null,
): string {
  const isGateway = d.type_device === 'Gateway';
  const rssi = tel?.rssi ?? cob?.rssi ?? null;
  const snr = tel?.snr ?? cob?.snr ?? null;
  const bat = bateriaDe(d);

  const lista = (tel?.gateways?.length ? tel.gateways : (cob?.gateways ?? [])) as GwRx[];
  const gw = [...lista].sort((a, b) => (b.snr ?? -999) - (a.snr ?? -999));

  const filas = gw.map(g => {
    const nombre = g.name ?? resolver(g.eui) ?? `(no registrado) ${String(g.eui ?? '').slice(-6)}`;
    const pct = g.snr == null ? 0 : Math.max(4, Math.min(100, Math.round(((Number(g.snr) + 20) / 35) * 100)));
    return `<div style="display:flex;align-items:center;gap:7px;font-size:11px;line-height:1.6;">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1;">${nombre}</span>
      <span style="width:36px;height:5px;border-radius:2px;background:#1e293b;overflow:hidden;flex:none;"><span style="display:block;height:100%;width:${pct}%;background:${snrColor(g.snr ?? null)};"></span></span>
      <span style="font-family:ui-monospace,monospace;color:${snrColor(g.snr ?? null)};width:56px;text-align:right;flex:none;">${g.snr != null ? `${Number(g.snr).toFixed(1)} dB` : '—'}</span>
      <span style="font-family:ui-monospace,monospace;color:${rssiColor(g.rssi ?? null)};width:52px;text-align:right;flex:none;">${g.rssi != null ? Math.round(Number(g.rssi)) : '—'}</span>
    </div>`;
  }).join('');

  const enLinea = d.is_active && !!d.last_seen && isFreshForDevice(new Date(d.last_seen).getTime(), d.type_device);
  // Del reporte del día: si hoy no reportó, se dice explícitamente (vista cobertura)
  const sinDatosHoy = cob && !cob.ultimo_ts
    ? `sin datos hoy${cob.last_seen_global ? ` · últ. ${format(new Date(cob.last_seen_global), 'dd/MM/yyyy')}` : ' · nunca reportó'}`
    : null;
  const icono = isGateway ? renderToString(<IconAntenna size={17} stroke={1.9} />)
    : d.type_device === 'Lector' ? renderToString(<IconBook size={17} stroke={1.9} />)
      : d.type_device === 'SubEstacion' ? renderToString(<IconBuildingFactory size={17} stroke={1.9} />)
        : renderToString(<IconMapPin size={17} stroke={1.9} />);
  const metrica = (titulo: string, valor: string, color: string, unidad?: string, sub?: string) =>
    `<div style="background:rgba(0,0,0,0.3);border-radius:5px;padding:6px 8px;min-width:0;">
      <div style="font-size:9px;letter-spacing:0.4px;text-transform:uppercase;color:#64748b;">${titulo}</div>
      <div style="font-family:ui-monospace,monospace;font-size:14px;font-weight:700;color:${color};white-space:nowrap;">${valor}${unidad ? `<span style="font-size:9px;font-weight:500;color:#64748b;"> ${unidad}</span>` : ''}</div>
      ${sub ? `<div style="font-size:9px;color:#64748b;line-height:1.2;">${sub}</div>` : ''}
    </div>`;

  return `<div style="font-family:Inter,Segoe UI,sans-serif;color:#f8fafc;min-width:300px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="display:flex;align-items:center;flex:none;color:${isGateway ? CELESTE : rssiColor(rssi)};">${icono}</span>
      <span style="font-size:14px;font-weight:700;letter-spacing:0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</span>
      <span style="margin-left:auto;flex:none;">${chip(enLinea ? 'en línea' : 'sin reportar', enLinea ? VERDE : GRIS)}</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin:3px 0 9px;font-family:ui-monospace,monospace;font-size:10px;color:#94a3b8;">
      <span>${d.dev_eui}</span><span style="opacity:.45;">·</span><span style="color:#cbd5e1;">${d.type_device}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
      ${metrica('RSSI', rssi != null ? `${Math.round(rssi)}` : '—', rssiColor(rssi), rssi != null ? 'dBm' : undefined)}
      ${metrica('SNR', snr != null ? Number(snr).toFixed(1) : '—', snrColor(snr), snr != null ? 'dB' : undefined, snrEtiqueta(snr))}
      ${metrica('Gateways', `${gw.length}`, '#e2e8f0')}
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:6px;background:rgba(0,0,0,0.3);border-radius:7px;padding:5px 8px;">
      <span style="font-size:9px;letter-spacing:0.4px;text-transform:uppercase;color:#64748b;">${bat.etiqueta}</span>
      <span style="margin-left:auto;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;color:${bat.color};">${bat.texto}</span>
    </div>
    ${gw.length ? `<div style="margin-top:7px;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;letter-spacing:0.4px;text-transform:uppercase;color:#64748b;margin-bottom:2px;">
        <span>Gateways último dato (${gw.length})</span><span>SNR · RSSI</span>
      </div>${filas}</div>`
      : `<div style="margin-top:7px;font-size:10px;color:#64748b;">Sin detalle de gateways para este dato</div>`}
    ${sinDatosHoy ? `<div style="margin-top:6px;font-size:10px;color:${NARANJA};">${sinDatosHoy}</div>` : ''}
    <div style="margin-top:6px;font-size:9px;color:#64748b;text-align:right;">Actualizado ${d.last_seen ? format(new Date(d.last_seen), 'dd/MM HH:mm:ss') : '—'}</div>
  </div>`;
}

// ─── Vista cobertura ───
const COB_VERDE = '#4ade80';
const COB_ROJO = '#f87171';
const COB_GRIS = '#64748b';
const CELESTE = '#38bdf8'; // color del logo (antena) de los gateways

function coberturaColor(d: MonitorDevice, s?: MonitorDaySensor): string {
  if (d.type_device === 'Gateway') {
    const ts = d.last_seen ? new Date(d.last_seen).getTime() : null;
    return ts && Date.now() - ts < 300000 ? COB_VERDE : COB_ROJO;
  }
  if (!s) return COB_GRIS;
  return s.ultimo_ts ? COB_VERDE : COB_ROJO;
}

interface MonitorRadarMapProps {
  /** Vista inicial del mapa (por defecto "senal") */
  initialView?: 'senal' | 'cobertura';
  /** Modo embebido: sin cabecera, selector de vista, buscador ni controles de reporte */
  compact?: boolean;
}

export default function MonitorRadarMap({ initialView = 'senal', compact = false }: MonitorRadarMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersById = useRef<Map<number, L.Marker>>(new Map());
  // El último objeto de cada equipo: el clic del marcador no debe quedarse con datos viejos
  const devicesByIdRef = useRef<Map<number, MonitorDevice>>(new Map());
  const hasSetBounds = useRef<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Reporte del día (vista previa + Excel): el día por defecto es hoy y se puede cambiar
  const [reportDia, setReportDia] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [reportOpen, setReportOpen] = useState(false);

  // ─── Vista del mapa ───
  const [viewMode, setViewMode] = useState<'senal' | 'cobertura' | 'lillie'>(initialView);
  const hoy = format(new Date(), "yyyy-MM-dd");
  const { data: dayReport } = useMonitorDayReport(hoy, {
    enabled: viewMode === 'cobertura',
    refetchInterval: viewMode === 'cobertura' ? 60000 : undefined,
  });
  const coberturaMap = useMemo(() => {
    const m = new Map<number, MonitorDaySensor>();
    (dayReport?.sensores ?? []).forEach(s => m.set(s.id, s));
    return m;
  }, [dayReport]);
  const coberturaResumen = useMemo(() => ({
    conDatos: dayReport?.conDatos ?? 0,
    total: dayReport?.total ?? 0,
  }), [dayReport]);

  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(200);

  const telemetryMap = useMemo(() => {
    const map = new Map<number, PopupTel>();
    (latestTelemetry || []).forEach((t: any) => {
      if (map.has(t.device_id)) return;
      let rx: any[] = [];
      if (Array.isArray(t.rxinfo)) rx = t.rxinfo;
      else if (typeof t.rxinfo === 'string') try { rx = JSON.parse(t.rxinfo); } catch { /* payload inválido */ }
      else if (t.rxinfo && typeof t.rxinfo === 'object') rx = [t.rxinfo];

      const conSenal = (rx || [])
        .filter((x: any) => !x.crcStatus || x.crcStatus === 'CRC_OK')
        .map((x: any) => ({
          eui: x.gatewayId ?? null,
          name: null,
          snr: x.snr != null ? Number(x.snr) : null,
          rssi: x.rssi != null ? Number(x.rssi) : null,
        }))
        .sort((a: GwRx, b: GwRx) => (b.snr ?? -999) - (a.snr ?? -999));

      // El mejor gateway es el de mayor SNR, no el primero que llega en rxinfo.
      map.set(t.device_id, {
        snr: conSenal[0]?.snr ?? null,
        rssi: conSenal[0]?.rssi ?? null,
        ts: t.ts ?? null,
        gateways: conSenal,
      });
    });
    return map;
  }, [latestTelemetry]);

  const devicesWithPos = useMemo(() => {
    return (allDevices || []).filter(d => {
      const lat = Number(d.latitude_current);
      const lng = Number(d.longitude_current);
      if (isNaN(lat) || isNaN(lng)) return false;
      if (lat === 0 && lng === 0) return false;
      if (lat < -57 || lat > -17 || lng < -77 || lng > -63) return false;
      return true;
    });
  }, [allDevices]);

  // Nombre del gateway por EUI (rxinfo trae el EUI completo o los últimos 6 caracteres)
  const gwPorEui = useMemo(() => {
    const m = new Map<string, string>();
    (allDevices || []).forEach(d => {
      if (d.type_device !== 'Gateway' || !d.dev_eui) return;
      const eui = String(d.dev_eui).toLowerCase();
      m.set(eui, d.name);
      m.set(eui.slice(-6), d.name);
    });
    return m;
  }, [allDevices]);

  // Firma estable del conjunto de equipos: los marcadores sólo se recrean si cambia.
  const deviceSig = useMemo(() => devicesWithPos.map(d => d.id).join(','), [devicesWithPos]);

  // ─── Buscador de sensores ───
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return devicesWithPos
      .filter(d => matchesSearch(searchTerm, d.name, d.dev_eui, d.type_device))
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'))
      .slice(0, 8);
  }, [devicesWithPos, searchTerm]);

  const activeIdx = searchResults.length > 0 ? Math.min(highlightIdx, searchResults.length - 1) : 0;

  // Selecciona un sensor igual que si se hiciera clic en su marcador:
  const selectDevice = (d: any) => {
    setSelectedDevice(d);
    setSearchOpen(false);

    const lat = Number(d.latitude_current);
    const lng = Number(d.longitude_current);
    const map = mapInstance.current;
    if (map && !isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
    // Se busca el marcador dentro del timeout: el mapa puede redibujarse durante el vuelo
    window.setTimeout(() => markersById.current.get(d.id)?.openPopup(), 650);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setSearchOpen(false); e.currentTarget.blur(); return; }
    if (searchResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => (i + 1) % searchResults.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => (i - 1 + searchResults.length) % searchResults.length); }
    else if (e.key === 'Enter') { e.preventDefault(); selectDevice(searchResults[activeIdx]); }
  };

  // Cerrar el desplegable al hacer clic fuera del buscador
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  // Inicialización del Mapa
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [-33.45, -70.65], zoom: 12,
      zoomControl: false, attributionControl: false,
      // Los tiles llegan hasta z16; se permite acercar más (se escalan).
      maxZoom: 20,
      zoomSnap: 0.5,
    });
    
    // Mapa base Dark Matter
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { 
  maxZoom: 20, maxNativeZoom: 16, attribution: "&copy; Esri" 
}).addTo(map);
    
    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstance.current = map;
    hasSetBounds.current = false;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Dibujado de Nodos y Animaciones
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    // Referencias fijas durante la vida del efecto (evita leer .current en el cleanup)
    const markers = markersRef.current;
    const porId = markersById.current;

    // Se crean sólo los marcadores que faltan y se quitan los que ya no están: recrear los
    // 275 en cada refresco cerraba el popup abierto y reiniciaba las animaciones del radar.
    const idsActuales = new Set(devicesWithPos.map(d => d.id));
    [...porId.entries()].forEach(([id, marker]) => {
      if (!idsActuales.has(id)) { map.removeLayer(marker); porId.delete(id); }
    });

    devicesWithPos.forEach(d => {
      devicesByIdRef.current.set(d.id, d);
      if (porId.has(d.id)) return;

      const lat = Number(d.latitude_current);
      const lng = Number(d.longitude_current);
      if (isNaN(lat) || isNaN(lng)) return;

      const tel = telemetryMap.get(d.id);
      const rssi = tel?.rssi ?? null;
      const isGateway = d.type_device === 'Gateway';
      const cob = coberturaMap.get(d.id);
      // Color inicial según la vista activa (el efecto de actualización lo repinta en vivo)
      const color = viewMode === 'senal' ? rssiColor(rssi) : coberturaColor(d, cob);

      const size = isGateway ? 24 : 14;
      const borderRadius = '50%';
      const zIndexOffset = isGateway ? 1000 : 0;
      // Área clicable mayor que el punto visible: permite abrir el popup correcto cuando
      const hitSize = size + 10;
      
      const animationDelay = (Math.random() * 2).toFixed(2);
      // El logo del gateway va un poco más grande y en celeste, para no confundirlo con un sensor
      const gatewayIconSvg = isGateway ? renderToString(<IconAntenna size={17} stroke={2} />) : '';

      const icon = L.divIcon({
        html: `
        <div style="
          width:${hitSize}px;height:${hitSize}px;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;
        ">
        <div data-punto="" style="
          position: relative;
          width:${size}px;height:${size}px;
          border-radius:${borderRadius};
          background:rgba(15,23,42,1);
          border:2px solid ${color};
          box-shadow: 0 0 12px ${color}aa;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;
        ">
          <!-- Anillo de Radar animado -->
          <div class="radar-ping" data-anillo="" style="
            position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px;
            border-radius: ${borderRadius};
            border: 1px solid ${color};
            animation-delay: ${animationDelay}s;
          "></div>
          
          ${isGateway ? `<div style="display:flex;align-items:center;justify-content:center;color:${CELESTE};">${gatewayIconSvg}</div>` : ''}
        </div>
        </div>`,
        className: "",
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset, riseOnHover: true }).addTo(map);

      // El contenido lo escribe el efecto de actualización: así el popup abierto sobrevive
      // a los refrescos de datos en vez de cerrarse cada 15 s.
      marker.bindPopup('', { maxWidth: 360, className: 'dark-popup' });

      // Click en el sensor → abre el panel inferior con historial (con el objeto más fresco)
      marker.on('click', () => {
        const fresco = devicesByIdRef.current.get(d.id) ?? d;
        setSelectedDevice(fresco);
      });
      markers.push(marker);
      porId.set(d.id, marker);
    });

    if (!hasSetBounds.current && devicesWithPos.length > 0) {
      const bounds = L.latLngBounds(devicesWithPos.map(d =>
        L.latLng(Number(d.latitude_current), Number(d.longitude_current))
      ));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        hasSetBounds.current = true;
      }
    }

    // ── LEYENDA FLOTANTE ESTILO PANEL ──
    const legend = (L.control as any)({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.innerHTML = `
        <div style="background:rgba(9,9,11,0.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:12px;font-family:sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.8);min-width:140px;">
          <div style="font-weight:600;color:#f8fafc;margin-bottom:8px;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">${viewMode === 'senal' ? 'Nivel de Señal' : 'Cobertura de hoy'}</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:#94a3b8;">
            ${viewMode === 'senal' ? `
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;"></div> Señal sobre el ruido</div>
              <span style="font-family:monospace;font-size:9px;">&gt;-110</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#fb923c;box-shadow:0 0 8px #fb923c;"></div> Al borde del ruido</div>
              <span style="font-family:monospace;font-size:9px;">-110 a -120</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 8px #f87171;"></div> Bajo el ruido</div>
              <span style="font-family:monospace;font-size:9px;">&lt;-120</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 8px #64748b;"></div> Atípico / sin dato</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">SNR por gateway: verde &gt;0 dB · rojo &lt;-12 dB</div>` : `
            <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;"></div> Reportó hoy</div>
            <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 8px #f87171;"></div> Sin datos hoy</div>
            <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 8px #64748b;"></div> Sin información</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">Clic en un sensor → gateways de su último dato</div>`}
          </div>
        </div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;
      porId.clear();
      map.removeControl(legend);
    };
  // Los marcadores sólo se crean/reubican al cambiar el conjunto de equipos o la vista;
  // la telemetría la aplica el efecto siguiente sobre los marcadores existentes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceSig, viewMode]);

  // ── Actualización en vivo (sin recrear marcadores) ──
  // Recolorea el punto y reescribe el popup: el que esté abierto queda abierto y al día.
  useEffect(() => {
    if (!mapInstance.current) return;
    const resolver = (eui?: string | null) => nombreGateway(gwPorEui, eui);

    devicesWithPos.forEach(d => {
      devicesByIdRef.current.set(d.id, d);
      const marker = markersById.current.get(d.id);
      if (!marker) return;

      const tel = telemetryMap.get(d.id);
      const cob = coberturaMap.get(d.id);
      const color = viewMode === 'senal' ? rssiColor(tel?.rssi ?? null) : coberturaColor(d, cob);

      // Sólo se toca borde y halo: reemplazar el icono reiniciaría el radar y cerraría el popup.
      const el = marker.getElement();
      const punto = el?.querySelector('[data-punto]') as HTMLElement | null;
      const anillo = el?.querySelector('[data-anillo]') as HTMLElement | null;
      if (punto) { punto.style.borderColor = color; punto.style.boxShadow = `0 0 12px ${color}aa`; }
      if (anillo) anillo.style.borderColor = color;

      marker.setPopupContent(construirPopup(d, tel, cob, resolver));
    });
  }, [deviceSig, viewMode, devicesWithPos, telemetryMap, coberturaMap, gwPorEui]);

  return (
    <div className={`p-0 h-full flex flex-col min-h-0 relative overflow-hidden bg-bg-100 ${compact ? "" : "rounded-xl border border-border/60 shadow-[0_12px_28px_rgba(15,23,42,0.08)]"}`}>
      <style>{`
        /* Animación del efecto Radar */
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        .radar-ping {
          animation: radar-pulse 8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        
        /* Popup SIEMPRE oscuro: el contenido (construirPopup) está maquetado con colores
           oscuros fijos, así que un fondo claro lo volvía ilegible. */
        .dark-popup .leaflet-popup-content-wrapper {
          background: #131414 !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px !important;
          padding: 0;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55) !important;
        }
        .dark-popup .leaflet-popup-content {
          margin: 12px 14px;
        }
        .dark-popup .leaflet-popup-tip {
          background: #131414 !important;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dark-popup .leaflet-popup-close-button {
          color: var(--text-300) !important;
          padding: 6px 6px 0 0 !important;
        }
      `}</style>

        {/* Cabecera superpuesta al mapa para máximo aprovechamiento del espacio */}
      {!compact && (
      <div className="absolute top-4 left-4 z-400 pointer-events-none">
        <h1 className="text-xl font-bold text-text-100 drop-shadow-sm">
          {viewMode === 'lillie' ? 'RECORRIDO LILLIEGO' : 'MONITOREO DE SEÑAL EQUIPOS SNR/RSSI'}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${viewMode === 'senal' ? 'bg-green-400' : viewMode === 'cobertura' ? 'bg-teal-400' : 'bg-sky-400'}`}></div>
          <p className="text-xs text-text-200 font-medium drop-shadow-sm">
            {viewMode === 'senal'
              ? `${devicesWithPos.length} sensores en el mapa`
              : viewMode === 'cobertura'
                ? `${coberturaResumen.conDatos} de ${coberturaResumen.total} sensores con datos hoy`
                : 'Puntos del recorrido y gateways que recibieron cada uno'}
          </p>
        </div>

        {/* Selector de vista: señal (SNR/RSSI), cobertura (reportó hoy + gateways) o recorrido LillieGo */}
        <div className="mt-2 flex w-fit items-center gap-0.5 rounded-lg border border-border/60 bg-bg-200/80 p-0.5 backdrop-blur-md pointer-events-auto shadow-sm">
          {([['senal', 'Vista señal'], ['cobertura', 'Vista cobertura'], ['lillie', 'Vista LillieGo']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setViewMode(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${viewMode === key ? 'bg-white/80 text-text-100 shadow-sm ring-1 ring-border/60' : 'text-text-300 hover:text-text-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Buscador de sensores: al elegir uno hace lo mismo que hacer clic en su marcador.
            No aplica en la vista de recorrido (ahí se navega con la línea de tiempo). */}
        {viewMode !== 'lillie' && (<>
        <div ref={searchBoxRef} className="relative mt-3 w-76 max-w-[80vw] pointer-events-auto">
          <input value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setHighlightIdx(0); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder="Buscar sensor por nombre o EUI..."
            className="w-full bg-bg-200/85 backdrop-blur-md border border-border/60 rounded-lg pl-9 pr-9 py-2 text-sm text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/60 focus:ring-1 focus:ring-brand-100/20 shadow-lg transition-colors" />
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-300 pointer-events-none" />
          {searchTerm && (
            <button type="button" onClick={() => { setSearchTerm(''); setSearchOpen(false); }} title="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-300 hover:text-text-100 transition-colors">
              <IconX size={15} />
            </button>
          )}

          {searchOpen && searchTerm.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-bg-200/95 backdrop-blur-md border border-border/60 rounded-lg shadow-2xl overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-300">Sin coincidencias en el mapa</div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((d, i) => (
                      <button key={d.id} type="button"
                        onMouseEnter={() => setHighlightIdx(i)}
                        onClick={() => selectDevice(d)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === activeIdx ? 'bg-brand-100/10' : 'hover:bg-bg-100/70'}`}>
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: rssiColor(telemetryMap.get(d.id)?.rssi ?? null) }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-text-100 truncate">{d.name}</span>
                          <span className="block text-[10px] text-text-300 font-mono truncate">{d.dev_eui} · {d.type_device}</span>
                        </span>
                        <IconMapPin size={14} className="text-text-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 border-t border-border/60 text-[10px] text-text-300">
                    {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} · Enter para abrir
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Reporte del día: vista previa en pantalla + descarga Excel de los sensores */}
        <div className="mt-3 flex items-center gap-2 pointer-events-auto">
          <input type="date" value={reportDia} max={format(new Date(), "yyyy-MM-dd")}
            onChange={e => setReportDia(e.target.value)}
            title="Día del reporte"
            className="rounded-lg border border-border/60 bg-bg-200/85 px-3 py-2 text-sm text-text-100 shadow-lg outline-none backdrop-blur-md transition-colors focus:border-brand-100/60 focus:ring-1 focus:ring-brand-100/20" />
          <button type="button" onClick={() => setReportOpen(true)} disabled={!reportDia}
            title="Ver el reporte del día y descargarlo en Excel"
            className="flex items-center gap-2 rounded-lg border border-brand-100/30 bg-brand-100/10 px-3 py-2 text-sm font-medium text-brand-100 shadow-lg transition-colors hover:bg-brand-100/15 disabled:opacity-40">
            <IconFileSpreadsheet size={16} /> Reporte del día
          </button>
        </div>
        </>)}
      </div>
      )}

      {/* Leyenda compacta (modo embebido): qué significa cada color de la vista cobertura */}
      {compact && viewMode === 'cobertura' && (
        <div className="absolute bottom-2 left-2 z-400 flex items-center gap-2 rounded-lg border border-border/60 bg-bg-100/95 px-2 py-1 text-[9px] text-text-200 shadow-sm">
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COB_VERDE }} /> Con datos hoy</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COB_ROJO }} /> Sin datos</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COB_GRIS }} /> Sin registro</span>
        </div>
      )}

      <div className="flex-1 min-h-0 w-full">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: compact ? undefined : "400px", zIndex: 0, background: 'var(--bg-200)' }} />
      </div>

      {/* Vista LillieGo: recorrido del tracker + gateways por punto (tapa el mapa de sensores
          sin desmontarlo, así el mapa de señal no pierde su estado al volver) */}
      {viewMode === 'lillie' && <MonitorLillieTrackView />}

      {/* Panel inferior del sensor (1/3 de altura) al hacer clic en un marcador */}
      {selectedDevice && viewMode !== 'lillie' && (
        <MonitorSensorPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}

      {/* Reporte del día: vista previa + Excel */}
      {reportOpen && <MonitorDayReportModal dia={reportDia} onClose={() => setReportOpen(false)} />}
    </div>
  );
}