import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMonitorAlertTracking } from "../../hooks/useMonitor";
import { IconX } from "@tabler/icons-react";

interface Props {
  alertId: number;
  alertTitle: string;
  onClose: () => void;
}

export default function MonitorTrackingModal({ alertId, alertTitle, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { data: tracking, isLoading } = useMonitorAlertTracking(alertId);

  useEffect(() => {
    if (!mapRef.current || !tracking || tracking.length === 0) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    // Se filtran los puntos con coordenadas válidas (evita NaN en Leaflet) quedándose con su
    // fecha y batería: antes se filtraba `points` pero se leía `tracking[i]`, así que si se
    // descartaba un punto los popups mostraban la fecha de otro.
    const validos = tracking
      .map(p => ({
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        ts: p.timestamp,
        battery: p.battery,
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180);
    const points: [number, number][] = validos.map(p => [p.lat, p.lng]);

    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    if (points.length >= 2) {
      L.polyline(points, { color: "#ef4444", weight: 2.5, opacity: 0.8 }).addTo(map);
    }

    validos.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === validos.length - 1;
      const color = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#3b82f6";
      const radius = isFirst || isLast ? 7 : 4;
      const hora = p.ts ? new Date(p.ts).toLocaleString("es-CL") : "—";
      L.circleMarker([p.lat, p.lng], { radius, color, fillColor: color, fillOpacity: 0.8, weight: 2 })
        .bindPopup(`<b>${isFirst ? "Inicio" : isLast ? "Último" : `Punto ${i + 1}`}</b><br/>${hora}<br/>Batería: ${p.battery ?? "—"}%`)
        .addTo(map);
    });

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView([points[0][0], points[0][1]], 15);
    }

    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [tracking]);

  useEffect(() => {
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-100 border border-gray-500/30 shadow-2xl w-full max-w-3xl rounded-xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/20">
          <div>
            <h3 className="text-sm font-bold text-text-100">Trackeo de alerta</h3>
            <p className="text-[11px] text-text-300 mt-0.5">{alertTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconX size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-text-400 animate-pulse">Cargando trackeo...</p>
            </div>
          ) : !tracking || tracking.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-text-400">Sin datos de trackeo para esta alerta</p>
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" style={{ minHeight: "400px" }} />
          )}
        </div>
        {tracking && tracking.length > 0 && (
          <div className="shrink-0 px-5 py-2.5 border-t border-border/20 flex items-center gap-4 text-[11px] text-text-300">
            <span>📍 {tracking.length} puntos</span>
            <span>🔋 {tracking[tracking.length - 1]?.battery ?? "—"}% batería</span>
            <span>🕐 {new Date(tracking[0].timestamp).toLocaleTimeString()} — {new Date(tracking[tracking.length - 1].timestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
