import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMonitorDevices, useMonitorLatestTelemetry } from "../../hooks/useMonitor";
import { renderToString } from "react-dom/server";
import MonitorSensorPanel from "./MonitorSensorPanel";
import { 
  IconAntenna, 
  IconBook, 
  IconBuildingFactory, 
  IconMapPin 
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

export default function MonitorRadarMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const hasSetBounds = useRef<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

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
      // Descartar coordenadas placeholder o inválidas (sin GPS real)
      if (lat === 0 && lng === 0) return false;
      // Rango geográfico del sistema (Chile / EFE SUR) para excluir outliers
      // que inflan el bounding box (p.ej. lat 0/0, lat -73, lng -79)
      if (lat < -57 || lat > -17 || lng < -77 || lng > -63) return false;
      return true;
    });
  }, [allDevices]);

  // Inicialización del Mapa
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [-33.45, -70.65], zoom: 12,
      zoomControl: false, attributionControl: false,
    });
    
    // Mapa base Dark Matter (Negro Mate)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { 
  maxZoom: 16, attribution: "&copy; Esri" 
}).addTo(map);
    
    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstance.current = map;
    // Cada mapa nuevo debe ajustarse a TODOS los marcadores (fitBounds),
    // aunque ya se haya hecho en una instancia anterior (StrictMode remonta el mapa)
    hasSetBounds.current = false;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Dibujado de Nodos y Animaciones
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    devicesWithPos.forEach(d => {
      const lat = Number(d.latitude_current);
      const lng = Number(d.longitude_current);
      if (isNaN(lat) || isNaN(lng)) return;

      const tel = telemetryMap.get(d.id);
      const rssi = tel?.rssi ?? null;
      const color = rssiColorNeon(rssi);
      const isGateway = d.type_device === 'Gateway';

      const size = isGateway ? 24 : 14;
      const borderRadius = '50%';
      const zIndexOffset = isGateway ? 1000 : 0;
      
      // Desfase aleatorio para que los pings no parpadeen todos exactamente al mismo tiempo
      const animationDelay = (Math.random() * 2).toFixed(2);

      // Ícono de antena para los gateways (mismo que en el popup)
      const gatewayIconSvg = isGateway ? renderToString(<IconAntenna size={14} stroke={2} />) : '';

      const icon = L.divIcon({
        html: `
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
          
          ${isGateway ? `<div style="display:flex;align-items:center;justify-content:center;color:${color};">${gatewayIconSvg}</div>` : ''}
        </div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset }).addTo(map);

      const rssiText = rssi != null ? `${rssi.toFixed(1)} dBm` : '—';
      const snrText = tel?.snr != null ? `${tel.snr.toFixed(1)} dB` : '—';
      
      const typeIcon = isGateway 
        ? renderToString(<IconAntenna size={18} stroke={1.5} />) 
        : d.type_device === 'Lector' 
        ? renderToString(<IconBook size={18} stroke={1.5} />) 
        : d.type_device === 'SubEstacion' 
        ? renderToString(<IconBuildingFactory size={18} stroke={1.5} />) 
        : renderToString(<IconMapPin size={18} stroke={1.5} />);

      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:180px;color:#f8fafc;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
            <span style="display:flex;align-items:center;color:${color};">
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
        </div>
      `, { maxWidth: 280, className: 'dark-popup' });

      // Click en el sensor → abre el panel inferior con historial
      marker.on('click', () => setSelectedDevice(d));
      markersRef.current.push(marker);
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
          <div style="font-weight:600;color:#f8fafc;margin-bottom:8px;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">Nivel de Señal</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:#94a3b8;">
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
            </div>
          </div>
        </div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      markersRef.current.forEach(m => map.removeLayer(m));
      map.removeControl(legend);
    };
  }, [devicesWithPos, telemetryMap]);

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
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <p className="text-xs text-gray-300 font-medium drop-shadow-md">{devicesWithPos.length} sensores activos</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: "400px", zIndex: 0, background: '#09090b' }} />
      </div>

      {/* Panel inferior del sensor (1/3 de altura) al hacer clic en un marcador */}
      {selectedDevice && (
        <MonitorSensorPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}
    </div>
  );
}