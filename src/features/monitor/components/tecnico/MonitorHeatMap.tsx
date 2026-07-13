import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { useMonitorDevices, useMonitorLatestTelemetry } from "../../hooks/useMonitor";

function rssiIntensity(rssi: number | null): number {
  if (rssi === null) return 0.3;
  if (rssi >= -90) return 1.0;
  if (rssi >= -100) return 0.9;
  if (rssi >= -110) return 0.7;
  if (rssi >= -118) return 0.5;
  if (rssi >= -120) return 0.3;
  return 0.15;
}

function rssiColor(rssi: number | null): string {
  if (rssi === null) return '#9ca3af';
  if (rssi >= -100) return '#22c55e';
  if (rssi >= -110) return '#14b8a6';
  if (rssi >= -118) return '#3b82f6';
  if (rssi >= -120) return '#f59e0b';
  return '#ef4444';
}

export default function MonitorHeatMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);

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
    return (allDevices || []).filter(d =>
      d.latitude_current != null && d.longitude_current != null &&
      !isNaN(Number(d.latitude_current)) && !isNaN(Number(d.longitude_current))
    );
  }, [allDevices]);

  const heatPoints = useMemo((): [number, number, number][] => {
    return devicesWithPos.map(d => {
      const tel = telemetryMap.get(d.id);
      return [Number(d.latitude_current), Number(d.longitude_current), rssiIntensity(tel?.rssi ?? null)];
    });
  }, [devicesWithPos, telemetryMap]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [-33.45, -70.65], zoom: 12,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Limpiar capas anteriores
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    if (heatPoints.length === 0) return;

    // ── HEATMAP ──
    const heat = (L as any).heatLayer(heatPoints, {
      minOpacity: 0.3, maxZoom: 18, max: 1.0, radius: 40, blur: 25,
      gradient: { 0.0: '#22c55e', 0.2: '#14b8a6', 0.4: '#3b82f6', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#dc2626' },
    }).addTo(map);
    heatLayerRef.current = heat;

    // ── MARCADORES CLICKEABLES ──
    devicesWithPos.forEach(d => {
      const lat = Number(d.latitude_current);
      const lng = Number(d.longitude_current);
      if (isNaN(lat) || isNaN(lng)) return;

      const tel = telemetryMap.get(d.id);
      const rssi = tel?.rssi ?? null;
      const color = rssiColor(rssi);

      // Marcador pequeño con glow
      const icon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:rgba(15,23,42,0.8);
          border:2.5px solid ${color};
          box-shadow:0 0 10px ${color}88, 0 0 20px ${color}44;
          cursor:pointer;transition:all 0.15s;
        "></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const rssiText = rssi != null ? `${rssi.toFixed(1)} dBm` : '—';
      const snrText = tel?.snr != null ? `${tel.snr.toFixed(1)} dB` : '—';
      const typeIcon = d.type_device === 'Gateway' ? '📡' : d.type_device === 'Lector' ? '📖' : d.type_device === 'SubEstacion' ? '🏭' : '📍';

      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:170px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:16px">${typeIcon}</span>
            <span style="font-size:13px;font-weight:700">${d.name}</span>
          </div>
          <div style="font-size:10px;color:#666;margin-bottom:6px">${d.dev_eui} · ${d.type_device}</div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:11px">
            <span style="color:#3b82f6;font-weight:600">RSSI</span><span>${rssiText}</span>
            <span style="color:#22c55e;font-weight:600">SNR</span><span>${snrText}</span>
          </div>
          <div style="font-size:10px;color:#999;margin-top:4px;border-top:1px solid #eee;padding-top:4px">
            🕐 ${d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
          </div>
        </div>
      `, { maxWidth: 280, className: '' });

      markersRef.current.push(marker);
    });

    // Ajustar vista
    const bounds = L.latLngBounds(devicesWithPos.map(d =>
      L.latLng(Number(d.latitude_current), Number(d.longitude_current))
    ));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });

    // ── LEYENDA ──
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.innerHTML = `
        <div style="background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;font-family:sans-serif;font-size:10px;box-shadow:0 4px 16px rgba(0,0,0,0.4);min-width:130px">
          <div style="font-weight:700;color:white;margin-bottom:6px;font-size:11px;text-align:center">RSSI</div>
          <div style="height:12px;border-radius:6px;margin-bottom:4px;background:linear-gradient(to right, #22c55e, #14b8a6, #3b82f6, #f59e0b, #ef4444, #dc2626)"></div>
          <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:9px"><span>Buena</span><span>Media</span><span>Débil</span></div>
          <div style="border-top:1px solid rgba(255,255,255,0.05);margin-top:6px;padding-top:4px;color:#94a3b8;font-size:9px;text-align:center">${devicesWithPos.length} sensores · Click para ver</div>
        </div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
      markersRef.current.forEach(m => map.removeLayer(m));
      map.removeControl(legend);
    };
  }, [heatPoints, devicesWithPos, telemetryMap]);

  return (
    <div className="p-2 h-full flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-text-100">Mapa de calor RSSI</h1>
          <p className="text-[11px] text-text-300 mt-0.5">{devicesWithPos.length} sensores con ubicación</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border/30 shadow">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: "300px" }} />
      </div>
    </div>
  );
}
