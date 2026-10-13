import { useEffect, useRef, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDayReport } from "../../hooks/useMonitor";
import type { MonitorDayGateway, MonitorDaySensor, MonitorDevice } from "../../types/monitor.types";
import { renderToString } from "react-dom/server";
import MonitorSensorPanel from "./MonitorSensorPanel";
import MonitorDayReportModal from "../shared/MonitorDayReportModal";
import { matchesSearch } from "@/utils/text";
import { 
  IconAntenna, 
  IconBook, 
  IconBuildingFactory, 
  IconFileSpreadsheet,
  IconMapPin,
  IconSearch,
  IconX
} from "@tabler/icons-react";

// Colores Neón adaptados para fondo oscuro
function rssiColorNeon(rssi: number | null): string {
  if (rssi === null) return '#64748b'; // Gris Pizarra
  if (rssi >= -100) return '#4ade80'; // Verde Neón
  if (rssi >= -110) return '#2dd4bf'; // Turquesa Neón
  if (rssi >= -118) return '#38bdf8'; // Azul Neón
  if (rssi >= -120) return '#fb923c'; // Naranja Neón
  return '#f87171'; // Rojo Neón
}

// ─── Vista cobertura ───
// Verde = reportó hoy · Rojo = sin datos hoy · Gris = sin información (lectores, dispositivos de prueba).
// Los gateways se evalúan con su propio last_seen, porque no generan telemetría propia.
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

export default function MonitorRadarMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersById = useRef<Map<number, L.Marker>>(new Map());
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
  // 'senal'   → color por calidad de señal (SNR/RSSI del último dato)
  // 'cobertura' → verde si reportó HOY, y el popup muestra los gateways de ese último dato
  const [viewMode, setViewMode] = useState<'senal' | 'cobertura'>('senal');
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
    const map = new Map<number, { snr: number | null; rssi: number | null }>();
    (latestTelemetry || []).forEach((t: any) => {
      if (!map.has(t.device_id)) {
        let rx: any[] = [];
        if (Array.isArray(t.rxinfo)) rx = t.rxinfo;
        else if (typeof t.rxinfo === 'string') try { rx = JSON.parse(t.rxinfo); } catch {}
        else if (t.rxinfo && typeof t.rxinfo === 'object') rx = [t.rxinfo];
        const gw = rx?.[0] || null;
        map.set(t.device_id, {
          snr: gw?.snr != null ? Number(gw.snr) : null,
          rssi: gw?.rssi != null ? Number(gw.rssi) : null,
        });
      }
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

  // ─── Buscador de sensores ───
  // Solo busca entre los sensores que están en el mapa (coordenadas válidas),
  // porque son los únicos sobre los que se puede "hacer clic".
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return devicesWithPos
      .filter(d => matchesSearch(searchTerm, d.name, d.dev_eui, d.type_device))
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'))
      .slice(0, 8);
  }, [devicesWithPos, searchTerm]);

  const activeIdx = searchResults.length > 0 ? Math.min(highlightIdx, searchResults.length - 1) : 0;

  // Selecciona un sensor igual que si se hiciera clic en su marcador:
  // abre el panel inferior, centra el mapa y despliega el popup.
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
      // El proveedor de tiles solo llega a z16, pero se permite acercar más (los tiles se
      // escalan) para poder separar marcadores que están pegados y abrir sus popups.
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

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    markersById.current.clear();

    devicesWithPos.forEach(d => {
      const lat = Number(d.latitude_current);
      const lng = Number(d.longitude_current);
      if (isNaN(lat) || isNaN(lng)) return;

      const tel = telemetryMap.get(d.id);
      const rssi = tel?.rssi ?? null;
      const isGateway = d.type_device === 'Gateway';
      const cob = coberturaMap.get(d.id);
      // Color según la vista activa
      const color = viewMode === 'senal' ? rssiColorNeon(rssi) : coberturaColor(d, cob);

      const size = isGateway ? 24 : 14;
      const borderRadius = '50%';
      const zIndexOffset = isGateway ? 1000 : 0;
      // Área clicable mayor que el punto visible: permite abrir el popup correcto cuando
      // hay varios sensores muy juntos (el aspecto del marcador no cambia).
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
        <div style="
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
          <div class="radar-ping" style="
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

      const rssiText = rssi != null ? `${rssi.toFixed(1)} dBm` : '—';
      const snrText = tel?.snr != null ? `${tel.snr.toFixed(1)} dB` : '—';
      
      const typeIcon = isGateway 
        ? renderToString(<IconAntenna size={18} stroke={1.5} />) 
        : d.type_device === 'Lector' 
        ? renderToString(<IconBook size={18} stroke={1.5} />) 
        : d.type_device === 'SubEstacion' 
        ? renderToString(<IconBuildingFactory size={18} stroke={1.5} />) 
        : renderToString(<IconMapPin size={18} stroke={1.5} />);

      // ── Popup: en vista señal, SNR/RSSI; en vista cobertura, último dato + gateways ──
      const ultimoCob = isGateway
        ? (d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm:ss") : '—')
        : cob?.ultimo_ts
          ? format(new Date(cob.ultimo_ts), "dd/MM HH:mm:ss")
          : cob
            ? `sin datos hoy${cob.last_seen_global ? ` · últ. ${format(new Date(cob.last_seen_global), "dd/MM/yyyy")}` : ' · nunca reportó'}`
            : 'sin información';

      // Gateways del último dato, de mejor a peor señal. Si la API aún no devuelve la lista
      // (proceso con código anterior), se cae al "mejor gateway" para no perder el dato.
      const gwListaCob: MonitorDayGateway[] = cob?.gateways?.length
        ? cob.gateways
        : cob?.ultimo_ts && (cob.gw_name || cob.gw_eui)
          ? [{ eui: cob.gw_eui ?? '', name: cob.gw_name, snr: cob.snr, rssi: cob.rssi }]
          : [];

      const gwListaHtml = cob?.ultimo_ts
        ? (gwListaCob.length > 0
            ? `<div style="margin-top:8px;">
                 <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Gateways de ese dato (${gwListaCob.length})</div>
                 ${gwListaCob.map(g => {
                   const gname = g.name ?? `(no registrado) ${String(g.eui).slice(-6)}`;
                   const gcolor = g.snr == null ? '#94a3b8' : g.snr >= 10 ? '#4ade80' : g.snr >= 5 ? '#fbbf24' : '#f87171';
                   return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;padding:2px 0;">
                     <span style="color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${gname}</span>
                     <span style="font-family:monospace;color:${gcolor};white-space:nowrap;">${g.snr != null ? `${g.snr.toFixed(1)} dB` : '—'} · ${g.rssi != null ? `${g.rssi.toFixed(0)} dBm` : '—'}</span>
                   </div>`;
                 }).join('')}
               </div>`
            : `<div style="margin-top:8px;font-size:10px;color:#64748b;">El registro de hoy no trae información de gateways</div>`)
        : '';

      const popupHtml = viewMode === 'senal'
        ? `<div style="font-family:sans-serif;min-width:180px;color:#f8fafc;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
            <span style="display:flex;align-items:center;color:${isGateway ? CELESTE : color};">
              ${typeIcon}
            </span>
            <span style="font-size:14px;font-weight:700;letter-spacing:0.3px;">${d.name}</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin-bottom:8px;font-family:monospace;">${d.dev_eui}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;">
            <div style="display:flex;flex-direction:column;">
              <span style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">RSSI</span>
              <span style="color:${color};font-weight:600;font-family:monospace;">${rssiText}</span>
            </div>
            <div style="display:flex;flex-direction:column;">
              <span style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">SNR</span>
              <span style="color:#cbd5e1;font-weight:600;font-family:monospace;">${snrText}</span>
            </div>
          </div>
          <div style="font-size:9px;color:#64748b;margin-top:8px;text-align:right;">
            Últ. Tx: ${d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : '—'}
          </div>
        </div>`
        : `<div style="font-family:sans-serif;min-width:200px;color:#f8fafc;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
            <span style="display:flex;align-items:center;color:${isGateway ? CELESTE : color};">
              ${typeIcon}
            </span>
            <span style="font-size:14px;font-weight:700;letter-spacing:0.3px;">${d.name}</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin-bottom:8px;font-family:monospace;">${d.dev_eui}</div>
          <div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;">
            <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">${isGateway ? 'Último reporte' : 'Último dato de hoy'}</div>
            <div style="color:${color};font-weight:600;font-family:monospace;font-size:13px;">${ultimoCob}</div>
          </div>
          ${isGateway ? '' : gwListaHtml}
        </div>`;

      marker.bindPopup(popupHtml, { maxWidth: 280, className: 'dark-popup' });

      // Click en el sensor → abre el panel inferior con historial
      marker.on('click', () => setSelectedDevice(d));
      markersRef.current.push(marker);
      markersById.current.set(d.id, marker);
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
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;"></div> Excelente</div>
              <span style="font-family:monospace;font-size:9px;">>-100</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 8px #2dd4bf;"></div> Buena</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;"></div> Media</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#fb923c;box-shadow:0 0 8px #fb923c;"></div> Débil</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 8px #f87171;"></div> Crítica</div>
              <span style="font-family:monospace;font-size:9px;"><-120</span>
            </div>` : `
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
      markersRef.current.forEach(m => map.removeLayer(m));
      markersById.current.clear();
      map.removeControl(legend);
    };
  }, [devicesWithPos, telemetryMap, viewMode, coberturaMap]);

  return (
    <div className="p-0 h-full flex flex-col min-h-0 relative bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
      <style>{`
        /* Animación del efecto Radar */
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        .radar-ping {
          animation: radar-pulse 8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        
        /* Personalización profunda del Popup para Dark Mode */
        .dark-popup .leaflet-popup-content-wrapper {
          background: #131414 !important;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px !important;
          padding: 0;
          box-shadow: 0 20px 40px rgba(0,0,0,0.8) !important;
        }
        .dark-popup .leaflet-popup-content {
          margin: 12px 14px;
        }
        .dark-popup .leaflet-popup-tip {
          background: rgba(15,23,42,0.95) !important;
          border-top: 1px solid rgba(255,255,255,0.1);
          border-left: 1px solid rgba(255,255,255,0.1);
        }
        .dark-popup .leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 6px 6px 0 0 !important;
        }
      `}</style>

      {/* Cabecera superpuesta al mapa para máximo aprovechamiento del espacio */}
      <div className="absolute top-4 left-4 z-400 pointer-events-none">
        <h1 className="text-xl font-bold text-white drop-shadow-md">MONITOREO DE SEÑAL EQUIPOS SNR/RSSI</h1>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${viewMode === 'senal' ? 'bg-green-400' : 'bg-teal-400'}`}></div>
          <p className="text-xs text-gray-300 font-medium drop-shadow-md">
            {viewMode === 'senal'
              ? `${devicesWithPos.length} sensores en el mapa`
              : `${coberturaResumen.conDatos} de ${coberturaResumen.total} sensores con datos hoy`}
          </p>
        </div>

        {/* Selector de vista: señal (SNR/RSSI) o cobertura (reportó hoy + gateways) */}
        <div className="mt-2 flex w-fit items-center gap-0.5 rounded-lg border border-gray-700/80 bg-black/85 p-0.5 backdrop-blur-md pointer-events-auto">
          {([['senal', 'Vista señal'], ['cobertura', 'Vista cobertura']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setViewMode(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${viewMode === key ? 'bg-white/15 text-gray-100' : 'text-gray-400 hover:text-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Buscador de sensores: al elegir uno hace lo mismo que hacer clic en su marcador */}
        <div ref={searchBoxRef} className="relative mt-3 w-76 max-w-[80vw] pointer-events-auto">
          <input value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setHighlightIdx(0); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder="Buscar sensor por nombre o EUI..."
            className="w-full bg-black/85 backdrop-blur-md border border-gray-700/80 rounded-lg pl-9 pr-9 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30 shadow-lg transition-colors" />
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          {searchTerm && (
            <button type="button" onClick={() => { setSearchTerm(''); setSearchOpen(false); }} title="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors">
              <IconX size={15} />
            </button>
          )}

          {searchOpen && searchTerm.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-black/95 backdrop-blur-md border border-gray-700/80 rounded-lg shadow-2xl overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-500">Sin coincidencias en el mapa</div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((d, i) => (
                      <button key={d.id} type="button"
                        onMouseEnter={() => setHighlightIdx(i)}
                        onClick={() => selectDevice(d)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === activeIdx ? 'bg-teal-400/10' : 'hover:bg-white/5'}`}>
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: rssiColorNeon(telemetryMap.get(d.id)?.rssi ?? null) }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-gray-100 truncate">{d.name}</span>
                          <span className="block text-[10px] text-gray-500 font-mono truncate">{d.dev_eui} · {d.type_device}</span>
                        </span>
                        <IconMapPin size={14} className="text-gray-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-600">
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
            className="rounded-lg border border-gray-700/80 bg-black/85 px-3 py-2 text-sm text-gray-100 shadow-lg outline-none backdrop-blur-md transition-colors focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30 scheme-dark" />
          <button type="button" onClick={() => setReportOpen(true)} disabled={!reportDia}
            title="Ver el reporte del día y descargarlo en Excel"
            className="flex items-center gap-2 rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-2 text-sm font-medium text-teal-300 shadow-lg transition-colors hover:bg-teal-500/25 disabled:opacity-40">
            <IconFileSpreadsheet size={16} /> Reporte del día
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: "400px", zIndex: 0, background: '#09090b' }} />
      </div>

      {/* Panel inferior del sensor (1/3 de altura) al hacer clic en un marcador */}
      {selectedDevice && (
        <MonitorSensorPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}

      {/* Reporte del día: vista previa + Excel */}
      {reportOpen && <MonitorDayReportModal dia={reportDia} onClose={() => setReportOpen(false)} />}
    </div>
  );
}