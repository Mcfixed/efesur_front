import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export default function MonitorTelemetryMap({ devicePosition, deviceName, gateways, activeGatewayIds, sensors, zoom = 14 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const linesRef = useRef<L.Polyline[]>([]);
  const gwMarkersRef = useRef<L.Marker[]>([]);
  const sensorMarkersRef = useRef<L.Marker[]>([]);
  const heatCirclesRef = useRef<L.Circle[]>([]);

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

    if (!devicePosition) return;
    const devLat = Number(devicePosition.lat);
    const devLng = Number(devicePosition.lng);

    markerRef.current = L.marker([devLat, devLng], { icon: deviceIcon }).addTo(map);
    if (deviceName) {
      markerRef.current.bindPopup(`
        <div style="padding:10px 12px 8px; background: rgba(15,23,42,0.92); border-radius: 10px; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="font-size:12px; font-weight:700; margin-bottom:4px; color:#f8fafc;">${deviceName}</div>
          <div style="font-size:10px; color:#cbd5e1; letter-spacing:0.08em; text-transform:uppercase;">Sensor activo</div>
          <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${devLat.toFixed(6)}, ${devLng.toFixed(6)}</div>
        </div>
      `);
    }

    if (gateways && activeGatewayIds && activeGatewayIds.length > 0) {
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
          <div style="padding:10px 12px 8px; background: rgba(15,23,42,0.94); border-radius:10px; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; color:#f8fafc; margin-bottom:4px;">${gw.name}</div>
            <div style="font-size:10px; color:#93c5fd; letter-spacing:0.08em; text-transform:uppercase;">Gateway activo</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${gwLat.toFixed(6)}, ${gwLng.toFixed(6)}</div>
          </div>
        `);
        gwMarkersRef.current.push(gMarker);
      });
    }

    if (sensors && sensors.length > 0) {
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
          <div style="padding:10px 12px 8px; background: rgba(15,23,42,0.94); border-radius: 10px; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif;">
            <div style="font-size:12px; font-weight:700; color:#f8fafc; margin-bottom:6px;">${s.name}</div>
            <div style="display:flex; gap:10px; font-size:11px; margin: 4px 0;">
              <span style="color:#93c5fd; font-weight:600;">RSSI: ${rssiText}</span>
              <span style="color:#86efac; font-weight:600;">SNR: ${snrText}</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; margin-top:6px;">${new Date(s.ts).toLocaleString()}</div>
          </div>
        `);
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

    const allPoints: L.LatLng[] = [L.latLng(devLat, devLng)];
    gwMarkersRef.current.forEach(m => allPoints.push(m.getLatLng()));
    sensorMarkersRef.current.forEach(m => allPoints.push(m.getLatLng()));
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: zoom });
    } else {
      map.setView([devLat, devLng], zoom);
    }
    return () => {
      heatCirclesRef.current.forEach(c => map.removeLayer(c)); heatCirclesRef.current = [];
      sensorMarkersRef.current.forEach(m => map.removeLayer(m)); sensorMarkersRef.current = [];
    };
  }, [devicePosition?.lat, devicePosition?.lng, gatewaysKey, gatewayIdsKey, sensorsKey]);

  return <div ref={mapRef} className="telemetry-map-shell w-full h-full rounded" style={{ minHeight: "150px" }} />;
}
