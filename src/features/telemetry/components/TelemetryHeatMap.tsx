import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GatewayInfo {
  dev_eui: string;
  name: string;
  latitude_current: number;
  longitude_current: number;
}

interface Props {
  devicePosition?: { lat: number; lng: number } | null;
  deviceName?: string;
  gateways?: GatewayInfo[];
  /** gatewayId (dev_eui) seen in rxinfo for this device */
  activeGatewayIds?: string[];
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

export default function TelemetryMap({ devicePosition, deviceName, gateways, activeGatewayIds, zoom = 14 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const linesRef = useRef<L.Polyline[]>([]);
  const gwMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const pos: [number, number] = devicePosition
      ? [Number(devicePosition.lat), Number(devicePosition.lng)]
      : [-33.45, -70.65];

    const map = L.map(mapRef.current, {
      center: pos,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers & lines
  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;

    // Clear previous marker
    if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }

    // Clear previous lines
    linesRef.current.forEach(l => map.removeLayer(l));
    linesRef.current = [];

    // Clear previous gateway markers
    gwMarkersRef.current.forEach(m => map.removeLayer(m));
    gwMarkersRef.current = [];

    if (!devicePosition) return;

    const devLat = Number(devicePosition.lat);
    const devLng = Number(devicePosition.lng);

    // Device marker
    markerRef.current = L.marker([devLat, devLng], { icon: deviceIcon }).addTo(map);
    if (deviceName) {
      markerRef.current.bindPopup(
        `<div style="font-size:11px;font-weight:600;font-family:sans-serif">${deviceName}</div>` +
        `<div style="font-size:10px;color:#666">${devLat.toFixed(6)}, ${devLng.toFixed(6)}</div>`
      );
    }

    // Draw lines to active gateways
    if (gateways && activeGatewayIds && activeGatewayIds.length > 0) {
      const activeSet = new Set(activeGatewayIds.map(id => id.toLowerCase()));

      gateways.forEach(gw => {
        const gwEui = gw.dev_eui.toLowerCase();
        if (!activeSet.has(gwEui)) return;

        const gwLat = Number(gw.latitude_current);
        const gwLng = Number(gw.longitude_current);
        if (isNaN(gwLat) || isNaN(gwLng)) return;

        // Dashed line from device to gateway
        const line = L.polyline([[devLat, devLng], [gwLat, gwLng]], {
          color: "#3b82f6",
          weight: 1.5,
          opacity: 0.6,
          dashArray: "6 8",
          lineCap: "round",
        }).addTo(map);
        linesRef.current.push(line);

        // Arrow marker at 65% of the line (pointing to gateway)
        const arrowPct = 0.65;
        const aLat = devLat + (gwLat - devLat) * arrowPct;
        const aLng = devLng + (gwLng - devLng) * arrowPct;
        const angle = Math.atan2(gwLng - devLng, gwLat - devLat) * (180 / Math.PI);
        const arrowIcon = L.divIcon({
          html: `<div style="transform:rotate(${angle}deg)"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2 L12 7 L2 12 Z" fill="#3b82f6" opacity="0.8"/></svg></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([aLat, aLng], { icon: arrowIcon, interactive: false }).addTo(map);

        // Gateway marker
        const gMarker = L.marker([gwLat, gwLng], { icon: gatewayIcon }).addTo(map);
        gMarker.bindPopup(
          `<div style="font-size:11px;font-weight:600;font-family:sans-serif">${gw.name}</div>` +
          `<div style="font-size:10px;color:#666">${gwLat.toFixed(6)}, ${gwLng.toFixed(6)}</div>`
        );
        gwMarkersRef.current.push(gMarker);
      });
    }

    // Fit bounds to show device + all gateways
    const allPoints: L.LatLng[] = [L.latLng(devLat, devLng)];
    gwMarkersRef.current.forEach(m => allPoints.push(m.getLatLng()));
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: zoom });
    } else {
      map.setView([devLat, devLng], zoom);
    }
  }, [devicePosition?.lat, devicePosition?.lng, gateways, activeGatewayIds]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded"
      style={{ minHeight: "150px" }}
    />
  );
}
