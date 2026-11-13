import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MonitorTrackPoint } from "../../types/monitor.types";
import { formatBattery } from "../../utils/battery";

const mapStyles = `
  .telemetry-map-shell {
    background: radial-gradient(circle at top, rgba(59,130,246,0.18), rgba(15,23,42,0.95) 45%, rgba(2,6,23,1) 100%);
  }
  .telemetry-map-shell .leaflet-container {
    background: #0b1120;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .telemetry-map-shell .leaflet-popup-content-wrapper,
  .telemetry-map-shell .leaflet-popup-tip {
    background: rgba(15, 23, 42, 0.96);
    border: 1px solid rgba(148, 163, 184, 0.18);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.48);
  }
  .telemetry-map-shell .leaflet-popup-content {
    margin: 0;
    padding: 0;
    min-width: 180px;
  }
  .map-pulse-ring {
    position: absolute;
    inset: -14px;
    border-radius: 9999px;
    border: 1.5px solid rgba(96, 165, 250, 0.7);
    animation: mapSignalPulse 2.5s ease-out infinite;
  }
  .map-pulse-ring.gw {
    border-color: rgba(96, 165, 250, 0.7);
  }
  .map-pulse-ring.sensor {
    border-color: rgba(34, 197, 94, 0.9);
  }
  .map-pulse-ring.warning {
    border-color: rgba(245, 158, 11, 0.7);
  }
  .map-pulse-ring.danger {
    border-color: rgba(239, 68, 68, 0.9);
  }
  @keyframes mapSignalPulse {
    0% { transform: scale(0.7); opacity: 0.9; }
    60% { transform: scale(1.2); opacity: 0.5; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes mapRadarPulse {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(3.5); opacity: 0; }
  }
  .map-radar {
    animation: mapRadarPulse 8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }
  .map-sensor-core,
  .map-gateway-core {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.45);
  }
  .map-sensor-core {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.9);
    color: white;
    font-size: 9px;
    font-weight: 700;
    background: rgba(15, 23, 42, 0.92);
  }
  .map-gateway-core {
    width: 22px;
    height: 22px;
    background: rgba(15, 23, 42, 0.96);
    border: 2px solid rgba(96, 165, 250, 0.9);
  }
  .map-gateway-core svg {
    width: 12px;
    height: 12px;
  }
  .leaflet-control-zoom {
    border: 1px solid rgba(148,163,184,0.18) !important;
    border-radius: 12px !important;
    overflow: hidden;
    box-shadow: 0 8px 14px rgba(15, 23, 42, 0.35) !important;
  }
  .leaflet-control-zoom a {
    background: rgba(15,23,42,0.88) !important;
    color: #e2e8f0 !important;
    border-bottom: 1px solid rgba(148,163,184,0.12) !important;
  }
  .leaflet-control-zoom a:hover {
    background: rgba(30,41,59,0.96) !important;
  }
  /* Popups iguales a los del dashboard: fondo oscuro fijo, borde suave y sombra */
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
    color: #94a3b8 !important;
    padding: 6px 6px 0 0 !important;
  }
`;

interface GatewayInfo {
  dev_eui: string;
  name: string;
  latitude_current: number;
  longitude_current: number;
}

interface SensorInfo {
  id: number;
  name: string;
  dev_eui: string;
  lat: number;
  lng: number;
  snr: number | null;
  rssi: number | null;
  ts: string;
}

interface Props {
  devicePosition?: { lat: number; lng: number } | null;
  deviceName?: string;
  gateways?: GatewayInfo[];
  activeGatewayIds?: string[];
  sensors?: SensorInfo[];
  zoom?: number;
  /** Lecturas GPS del sensor (telemetry_data_all). Si viene, el pin del equipo pasa a ser el de la BD. */
  gpsHistorial?: MonitorTrackPoint[];
  /** Punto GPS al que hay que volar (al hacer clic en la tabla). `tick` fuerza el re-vuelo. */
  focusGps?: { ts: string; tick: number } | null;
}

const deviceIcon = L.divIcon({
  html: `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <span class="map-pulse-ring sensor" style="background:rgba(34,197,94,0.08);"></span>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#22c55e" opacity="0.20"/>
        <circle cx="16" cy="16" r="7" fill="#22c55e" stroke="white" stroke-width="2.5"/>
      </svg>
    </div>
  `,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/**
 * Mismo icono que usa el dashboard general para los sensores: círculo oscuro con borde y glow
 * del color del punto, y anillo de radar animado cuando el punto es "vivo" (última lectura GPS).
 */
function mapDot(kind: "db" | "gps") {
  const color = kind === "db" ? "#a855f7" : "#22c55e";
  const size = 16;
  const hit = size + 12;
  const delay = (Math.random() * 2).toFixed(2);
  return L.divIcon({
    html: `
      <div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;
                    background:rgba(15,23,42,1);border:2px solid ${color};
                    box-shadow:0 0 12px ${color}aa;">
          ${kind === "gps"
            ? `<div class="map-radar" style="position:absolute;top:-2px;left:-2px;right:-2px;bottom:-2px;border-radius:50%;border:1px solid ${color};animation-delay:${delay}s;"></div>`
            : ""}
        </div>
      </div>`,
    className: "",
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
  });
}

/** Pin de la posición guardada en la BD (instalación manual del sensor). */
const dbPinIcon = mapDot("db");

/** Pin de la última lectura GPS real del equipo (el "vivo", con radar). */
function gpsPinIcon() {
  return mapDot("gps");
}

/** Popup con toda la data del punto GPS (fecha, coords, batería, satélites, gateways...). */
function gpsPopupHtml(p: MonitorTrackPoint, deviceName?: string): string {
  const d = new Date(p.ts);
  const fecha = `${d.toLocaleDateString("es-CL")} · ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
  const filas: Array<[string, string]> = [
    ["Fecha", fecha],
    ["Coordenadas", `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`],
  ];
  if (p.satelites != null) filas.push(["Satélites", String(p.satelites)]);
  if (p.bateria_mv != null) filas.push(["Batería", formatBattery(p.bateria_mv)]);
  if (p.temperatura_c != null) filas.push(["Temperatura", `${Number(p.temperatura_c).toFixed(1)} °C`]);
  if (p.modo) filas.push(["Modo", p.modo]);
  if (p.alt != null) filas.push(["Altitud", `${Number(p.alt).toFixed(0)} m`]);
  filas.push(["Paquete", p.packet_type || "—"]);
  const evento = p.freefall ? "Caída libre" : p.motion ? "Movimiento" : "Lectura GPS programada";
  filas.push(["Evento", evento]);

  const tabla = filas.map(([k, v]) => `
    <div style="display:flex; justify-content:space-between; gap:10px; font-size:10px; line-height:15px;">
      <span style="color:#94a3b8;">${k}</span>
      <span style="color:#e2e8f0; font-weight:600; text-align:right;">${v}</span>
    </div>`).join("");

  const gws = (p.gateways || []).length
    ? p.gateways.map(g => {
        const nombre = g.name || (g.eui ? g.eui.slice(-6) : "GW");
        const senal = [
          g.snr != null ? `SNR ${Number(g.snr).toFixed(1)}` : null,
          g.rssi != null ? `RSSI ${Number(g.rssi).toFixed(0)}` : null,
        ].filter(Boolean).join(" · ");
        return `<div style="display:flex; justify-content:space-between; gap:10px; font-size:10px; line-height:15px;">
          <span style="color:#e2e8f0;">${nombre}</span>
          <span style="color:#93c5fd;">${senal || "—"}</span>
        </div>`;
      }).join("")
    : `<div style="font-size:10px; color:#94a3b8;">Sin gateways registrados</div>`;

  return `
    <div style="color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; min-width: 220px;">
            <div style="font-size:12px; font-weight:700; margin-bottom:2px; color:#f8fafc;">${deviceName || "Sensor"}</div>
      <div style="font-size:9px; color:#86efac; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:6px;">Lectura GPS</div>
      ${tabla}
      <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(148,163,184,0.18);">
        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:2px;">Gateways (${(p.gateways || []).length})</div>
        ${gws}
      </div>
    </div>`;
}

const gatewayIcon = L.divIcon({
  html: `
    <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">
      <span class="map-pulse-ring gw" style="background:rgba(96,165,250,0.08);"></span>
      <div class="map-gateway-core" style="border-color: rgba(96,165,250,0.9); background: rgba(15,23,42,0.95);">
        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="18" r="1" fill="#60a5fa"/>
          <path d="M3 9a17 17 0 0 1 18 0"/>
          <path d="M6 13a10 10 0 0 1 12 0"/>
          <path d="M9 16.5a5 5 0 0 1 6 0"/>
        </svg>
      </div>
    </div>
  `,
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function sensorIcon(rssi: number | null, snr: number | null) {
  const color = rssi !== null ? (rssi < -120 ? '#ef4444' : rssi < -118 ? '#f59e0b' : '#22c55e')
    : snr !== null ? (snr >= 10 ? '#22c55e' : snr >= 5 ? '#f59e0b' : '#ef4444')
    : '#9ca3af';
  const ringClass = rssi !== null ? (rssi < -120 ? 'danger' : rssi < -118 ? 'warning' : 'sensor') : 'sensor';
  return L.divIcon({
    html: `
      <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
        <span class="map-pulse-ring ${ringClass}" style="background: rgba(34, 197, 94, 0.06);"></span>
        <div class="map-sensor-core" style="background: rgba(15,23,42,0.96); border-color: ${color}; box-shadow: 0 0 12px ${color}66;">●</div>
      </div>
    `,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function MonitorTelemetryMap({ devicePosition, deviceName, gateways, activeGatewayIds, sensors, gpsHistorial, focusGps, zoom = 14 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const linesRef = useRef<L.Polyline[]>([]);
  const gwMarkersRef = useRef<L.Marker[]>([]);
  const sensorMarkersRef = useRef<L.Marker[]>([]);
  const heatCirclesRef = useRef<L.Circle[]>([]);
  const gpsLayersRef = useRef<L.Layer[]>([]);
  // Índice ts → marca del punto GPS, para poder volar a él desde la tabla de registros
  const gpsPorTsRef = useRef<Map<number, L.Layer>>(new Map());

  // La telemetría se refresca cada pocos segundos y cambia la identidad de los arrays:
  // estas firmas evitan destruir y recrear cientos de marcadores cuando el contenido es el mismo.
  const sensorsKey = useMemo(
    () => (sensors || []).map((s: any) => `${s.id}:${s.rssi ?? ""}:${s.snr ?? ""}:${s.ts ?? ""}`).join("|"),
    [sensors],
  );
  const gatewaysKey = useMemo(
    () => (gateways || []).map((g: any) => `${g.dev_eui}:${g.latitude_current}:${g.longitude_current}`).join("|"),
    [gateways],
  );
  const gatewayIdsKey = useMemo(() => (activeGatewayIds || []).join(","), [activeGatewayIds]);
  const gpsKey = useMemo(
    () => (gpsHistorial || []).map(p => `${p.ts}:${p.lat}:${p.lng}`).join("|"),
    [gpsHistorial],
  );
  // Cuando llega el historial GPS el marcador del equipo deja de ser el "sensor activo" y pasa a
  // ser el pin de la posición guardada en la BD, para no confundir la instalación con la lectura.
  const mostrarPinDb = gpsHistorial !== undefined;

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.textContent = mapStyles;
    document.head.appendChild(styleTag);
    return () => { document.head.removeChild(styleTag); };
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const pos: [number, number] = devicePosition
      ? [Number(devicePosition.lat), Number(devicePosition.lng)]
      : [-33.45, -70.65];
    const map = L.map(mapRef.current, { center: pos, zoom, zoomControl: false, attributionControl: false, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abc",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
    linesRef.current.forEach(l => map.removeLayer(l)); linesRef.current = [];
    gwMarkersRef.current.forEach(m => map.removeLayer(m)); gwMarkersRef.current = [];
    sensorMarkersRef.current.forEach(m => map.removeLayer(m)); sensorMarkersRef.current = [];
    heatCirclesRef.current.forEach(c => map.removeLayer(c)); heatCirclesRef.current = [];
    gpsLayersRef.current.forEach(l => map.removeLayer(l)); gpsLayersRef.current = [];
    gpsPorTsRef.current = new Map();

    const gpsLatLngs: L.LatLng[] = [];
    const tieneDb = devicePosition != null
      && Number.isFinite(Number(devicePosition.lat))
      && Number.isFinite(Number(devicePosition.lng));
    if (!tieneDb && !gpsKey) return;

    const devLat = tieneDb ? Number(devicePosition!.lat) : NaN;
    const devLng = tieneDb ? Number(devicePosition!.lng) : NaN;

    if (tieneDb) {
      markerRef.current = L.marker([devLat, devLng], { icon: mostrarPinDb ? dbPinIcon : deviceIcon }).addTo(map);
      if (deviceName) {
        markerRef.current.bindPopup(mostrarPinDb ? `
          <div style="color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; margin-bottom:4px; color:#f8fafc;">${deviceName}</div>
            <div style="font-size:10px; color:#d8b4fe; letter-spacing:0.08em; text-transform:uppercase;">Posición en BD (instalación)</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${devLat.toFixed(6)}, ${devLng.toFixed(6)}</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Coordenada cargada manualmente; no cambia con las lecturas GPS.</div>
          </div>
        ` : `
          <div style="color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; margin-bottom:4px; color:#f8fafc;">${deviceName}</div>
            <div style="font-size:10px; color:#cbd5e1; letter-spacing:0.08em; text-transform:uppercase;">Sensor activo</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${devLat.toFixed(6)}, ${devLng.toFixed(6)}</div>
          </div>
        `, { maxWidth: 320, className: "dark-popup" });
      }
    }

    // ── Historial GPS del sensor: polilínea de lecturas + un punto por paquete ──
    if (gpsHistorial && gpsHistorial.length > 0) {
      const puntos = gpsHistorial
        .map(p => ({ p, lat: Number(p.lat), lng: Number(p.lng) }))
        .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng) && !(x.lat === 0 && x.lng === 0))
        .sort((a, b) => new Date(a.p.ts).getTime() - new Date(b.p.ts).getTime());

      if (puntos.length > 0) {
        if (puntos.length > 1) {
          const trazo = L.polyline(puntos.map(x => [x.lat, x.lng] as [number, number]), {
            color: "#22c55e",
            weight: 3,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
          gpsLayersRef.current.push(trazo);
        }
        puntos.forEach((x, i) => {
          gpsLatLngs.push(L.latLng(x.lat, x.lng));
          const esUltimo = i === puntos.length - 1;
          if (esUltimo) {
            const pin = L.marker([x.lat, x.lng], { icon: gpsPinIcon(), zIndexOffset: 400 }).addTo(map);
            pin.bindPopup(gpsPopupHtml(x.p, deviceName), { maxWidth: 320, className: "dark-popup" });
            gpsLayersRef.current.push(pin);
            gpsPorTsRef.current.set(new Date(x.p.ts).getTime(), pin);
            return;
          }
          const dot = L.circleMarker([x.lat, x.lng], {
            radius: 4.5,
            color: "#22c55e",
            weight: 1.6,
            fillColor: "#0b1120",
            fillOpacity: 1,
          }).addTo(map);
          dot.bindPopup(gpsPopupHtml(x.p, deviceName), { maxWidth: 320, className: "dark-popup" });
          dot.on("mouseover", () => dot.openPopup());
          gpsLayersRef.current.push(dot);
          gpsPorTsRef.current.set(new Date(x.p.ts).getTime(), dot);
        });
      }
    }

    if (tieneDb && gateways && activeGatewayIds && activeGatewayIds.length > 0) {
      const activeSet = new Set(activeGatewayIds.map(id => String(id).toLowerCase()));
      gateways.forEach(gw => {
        const gwEui = gw.dev_eui.toLowerCase();
        if (!activeSet.has(gwEui)) return;
        const gwLat = Number(gw.latitude_current);
        const gwLng = Number(gw.longitude_current);
        if (isNaN(gwLat) || isNaN(gwLng)) return;
        const line = L.polyline([[devLat, devLng], [gwLat, gwLng]], {
          color: "#60a5fa",
          weight: 2,
          opacity: 0.7,
          dashArray: "8 10",
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.4,
        }).addTo(map);
        linesRef.current.push(line);

        const arrowPct = 0.67;
        const aLat = devLat + (gwLat - devLat) * arrowPct;
        const aLng = devLng + (gwLng - devLng) * arrowPct;
        const angle = Math.atan2(gwLng - devLng, gwLat - devLat) * (180 / Math.PI);
        const arrowIcon = L.divIcon({
          html: `<div style="transform:rotate(${angle}deg); display:flex; align-items:center; justify-content:center; width:18px; height:18px; filter: drop-shadow(0 4px 8px rgba(96,165,250,0.35));"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 3 L15 9 L4 15 Z" fill="#60a5fa" opacity="0.95"/></svg></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([aLat, aLng], { icon: arrowIcon, interactive: false }).addTo(map);

        const gMarker = L.marker([gwLat, gwLng], { icon: gatewayIcon }).addTo(map);
        gMarker.bindPopup(`
          <div style="color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; color:#f8fafc; margin-bottom:4px;">${gw.name}</div>
            <div style="font-size:10px; color:#93c5fd; letter-spacing:0.08em; text-transform:uppercase;">Gateway activo</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${gwLat.toFixed(6)}, ${gwLng.toFixed(6)}</div>
          </div>
        `, { maxWidth: 320, className: "dark-popup" });
        gwMarkersRef.current.push(gMarker);
      });
    }

    if (tieneDb && sensors && sensors.length > 0) {
      sensors.forEach(s => {
        if (!s.lat || !s.lng || isNaN(s.lat) || isNaN(s.lng)) return;
        const marker = L.marker([s.lat, s.lng], { icon: sensorIcon(s.rssi, s.snr) }).addTo(map);
        const lineColor = s.rssi !== null ? (s.rssi < -120 ? '#ef4444' : s.rssi < -118 ? '#f59e0b' : '#22c55e') : '#9ca3af';
        const line = L.polyline([[devLat, devLng], [s.lat, s.lng]], {
          color: lineColor,
          weight: 2,
          opacity: 0.7,
          dashArray: "5 8",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        linesRef.current.push(line);

        const snrText = s.snr !== null ? `${s.snr.toFixed(1)} dB` : '—';
        const rssiText = s.rssi !== null ? `${s.rssi.toFixed(1)} dBm` : '—';
        marker.bindPopup(`
          <div style="color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; color:#f8fafc; margin-bottom:6px;">${s.name}</div>
            <div style="display:flex; gap:10px; font-size:11px; margin: 4px 0;">
              <span style="color:#93c5fd; font-weight:600;">RSSI: ${rssiText}</span>
              <span style="color:#86efac; font-weight:600;">SNR: ${snrText}</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${new Date(s.ts).toLocaleString()}</div>
          </div>
        `, { maxWidth: 320, className: "dark-popup" });
        sensorMarkersRef.current.push(marker);

        if (s.rssi !== null) {
          const radius = Math.max(40, Math.min(260, 180 + s.rssi * 1.5));
          const opacity = Math.max(0.06, Math.min(0.22, (-s.rssi - 80) / 200));
          const color = s.rssi < -120 ? '#ef4444' : s.rssi < -118 ? '#f59e0b' : '#22c55e';
          const circle = L.circle([s.lat, s.lng], {
            radius: Math.abs(radius),
            color,
            fillColor: color,
            fillOpacity: opacity,
            weight: 1.2,
            opacity: opacity * 1.6,
          }).addTo(map);
          heatCirclesRef.current.push(circle);
        }
      });
    }

    const allPoints: L.LatLng[] = [];
    if (tieneDb) allPoints.push(L.latLng(devLat, devLng));
    gpsLatLngs.forEach(p => allPoints.push(p));
    gwMarkersRef.current.forEach(m => allPoints.push(m.getLatLng()));
    sensorMarkersRef.current.forEach(m => allPoints.push(m.getLatLng()));
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: zoom });
    } else if (allPoints.length === 1) {
      map.setView(allPoints[0], zoom);
    }
    return () => {
      heatCirclesRef.current.forEach(c => map.removeLayer(c)); heatCirclesRef.current = [];
      sensorMarkersRef.current.forEach(m => map.removeLayer(m)); sensorMarkersRef.current = [];
      gpsLayersRef.current.forEach(l => map.removeLayer(l)); gpsLayersRef.current = [];
    };
  }, [devicePosition?.lat, devicePosition?.lng, gatewaysKey, gatewayIdsKey, sensorsKey, gpsKey, mostrarPinDb]);

  // Volar al punto GPS elegido en la tabla de registros y abrir su popup
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !focusGps) return;
    const layer = gpsPorTsRef.current.get(new Date(focusGps.ts).getTime());
    if (!layer) return;
    const ll = (layer as L.Marker).getLatLng?.();
    if (!ll) return;
    map.flyTo(ll, Math.max(map.getZoom(), 16), { duration: 0.8 });
    window.setTimeout(() => (layer as L.Marker).openPopup?.(), 850);
  }, [focusGps]);

  return <div ref={mapRef} className="telemetry-map-shell w-full h-full rounded" style={{ minHeight: "150px" }} />;
}
