import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  html: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#22c55e" opacity="0.25"/><circle cx="16" cy="16" r="7" fill="#22c55e" stroke="white" stroke-width="2.5"/></svg>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const gatewayIcon = L.divIcon({
  html: `<div style="background:#1e293b;border-radius:50%;padding:4px;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="1" fill="#60a5fa"/><path d="M3 9a17 17 0 0 1 18 0"/><path d="M6 13a10 10 0 0 1 12 0"/><path d="M9 16.5a5 5 0 0 1 6 0"/></svg></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function sensorIcon(rssi: number | null, snr: number | null) {
  const color = rssi !== null ? (rssi < -120 ? '#ef4444' : rssi < -118 ? '#f59e0b' : '#22c55e')
    : snr !== null ? (snr >= 10 ? '#22c55e' : snr >= 5 ? '#f59e0b' : '#ef4444')
    : '#9ca3af';
  return L.divIcon({
    html: `<div style="background:#1e293b;border:2.5px solid ${color};border-radius:50%;width:26px;height:26px;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:white">●</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const pos: [number, number] = devicePosition
      ? [Number(devicePosition.lat), Number(devicePosition.lng)]
      : [-33.45, -70.65];
    const map = L.map(mapRef.current, { center: pos, zoom, zoomControl: false, attributionControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; <a href='https://openstreetmap.org'>OpenStreetMap</a>" }).addTo(map);
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
      markerRef.current.bindPopup(`<div style="font-size:11px;font-weight:600;font-family:sans-serif">${deviceName}</div><div style="font-size:10px;color:#666">${devLat.toFixed(6)}, ${devLng.toFixed(6)}</div>`);
    }

    if (gateways && activeGatewayIds && activeGatewayIds.length > 0) {
      const activeSet = new Set(activeGatewayIds.map(id => String(id).toLowerCase()));
      gateways.forEach(gw => {
        const gwEui = gw.dev_eui.toLowerCase();
        if (!activeSet.has(gwEui)) return;
        const gwLat = Number(gw.latitude_current);
        const gwLng = Number(gw.longitude_current);
        if (isNaN(gwLat) || isNaN(gwLng)) return;
        const line = L.polyline([[devLat, devLng], [gwLat, gwLng]], { color: "#3b82f6", weight: 1.5, opacity: 0.6, dashArray: "6 8", lineCap: "round" }).addTo(map);
        linesRef.current.push(line);
        const arrowPct = 0.65;
        const aLat = devLat + (gwLat - devLat) * arrowPct;
        const aLng = devLng + (gwLng - devLng) * arrowPct;
        const angle = Math.atan2(gwLng - devLng, gwLat - devLat) * (180 / Math.PI);
        const arrowIcon = L.divIcon({ html: `<div style="transform:rotate(${angle}deg)"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2 L12 7 L2 12 Z" fill="#3b82f6" opacity="0.8"/></svg></div>`, className: "", iconSize: [14, 14], iconAnchor: [7, 7] });
        L.marker([aLat, aLng], { icon: arrowIcon, interactive: false }).addTo(map);
        const gMarker = L.marker([gwLat, gwLng], { icon: gatewayIcon }).addTo(map);
        gMarker.bindPopup(`<div style="font-size:11px;font-weight:600;font-family:sans-serif">${gw.name}</div><div style="font-size:10px;color:#666">${gwLat.toFixed(6)}, ${gwLng.toFixed(6)}</div>`);
        gwMarkersRef.current.push(gMarker);
      });
    }

    if (sensors && sensors.length > 0) {
      sensors.forEach(s => {
        if (!s.lat || !s.lng || isNaN(s.lat) || isNaN(s.lng)) return;
        const marker = L.marker([s.lat, s.lng], { icon: sensorIcon(s.rssi, s.snr) }).addTo(map);
        const lineColor = s.rssi !== null ? (s.rssi < -120 ? '#ef4444' : s.rssi < -118 ? '#f59e0b' : '#22c55e') : '#9ca3af';
        const line = L.polyline([[devLat, devLng], [s.lat, s.lng]], { color: lineColor, weight: 1.5, opacity: 0.5, dashArray: "4 6", lineCap: "round" }).addTo(map);
        linesRef.current.push(line);
        const snrText = s.snr !== null ? `${s.snr.toFixed(1)} dB` : '—';
        const rssiText = s.rssi !== null ? `${s.rssi.toFixed(1)} dBm` : '—';
        marker.bindPopup(`<div style="font-size:12px;font-weight:700;font-family:sans-serif;margin-bottom:4px">${s.name}</div><div style="font-size:11px;margin-top:4px"><span style="color:#3b82f6;font-weight:600">RSSI:</span> ${rssiText}&nbsp;&nbsp;<span style="color:#22c55e;font-weight:600">SNR:</span> ${snrText}</div><div style="font-size:10px;color:#999;margin-top:2px">${new Date(s.ts).toLocaleString()}</div>`);
        sensorMarkersRef.current.push(marker);
        if (s.rssi !== null) {
          const radius = Math.max(30, Math.min(250, 180 + s.rssi * 1.5));
          const opacity = Math.max(0.05, Math.min(0.25, (-s.rssi - 80) / 200));
          const color = s.rssi < -120 ? '#ef4444' : s.rssi < -118 ? '#f59e0b' : '#22c55e';
          const circle = L.circle([s.lat, s.lng], { radius: Math.abs(radius), color, fillColor: color, fillOpacity: opacity, weight: 1, opacity: opacity * 0.5 }).addTo(map);
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
  }, [devicePosition?.lat, devicePosition?.lng, gateways, activeGatewayIds, sensors]);

  return <div ref={mapRef} className="w-full h-full rounded" style={{ minHeight: "150px" }} />;
}
