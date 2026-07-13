import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAlertTracking } from "../hooks/useStatus";
import { IconX } from "@tabler/icons-react";

interface TrackingModalProps {
  alertId: number;
  alertTitle: string;
  onClose: () => void;
}

export default function TrackingModal({ alertId, alertTitle, onClose }: TrackingModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { data: tracking, isLoading } = useAlertTracking(alertId);

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

    // Convertir tracking a coordenadas
    const points: [number, number][] = tracking.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);

    // Limpiar capas anteriores
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Línea de ruta
    if (points.length >= 2) {
      L.polyline(points, {
        color: "#ef4444",
        weight: 2.5,
        opacity: 0.8,
      }).addTo(map);
    }

    // Puntos
    points.forEach((pos, i) => {
      const isFirst = i === 0;
      const isLast = i === points.length - 1;

      const color = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#3b82f6";
      const radius = isFirst || isLast ? 7 : 4;

      L.circleMarker(pos, {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
      })
        .bindPopup(`
          <b>${isFirst ? "Inicio" : isLast ? "Último" : `Punto ${i + 1}`}</b><br/>
          ${new Date(tracking[i].timestamp).toLocaleString()}<br/>
          Batería: ${tracking[i].battery ?? "—"}%
        `)
        .addTo(map);
    });

    // Ajustar vista
    map.fitBounds(points.map(p => L.latLng(p[0], p[1])), { padding: [40, 40] });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [tracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-100 border border-gray-500/30 shadow-2xl w-full max-w-3xl rounded-xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/20">
          <div>
            <h3 className="text-sm font-bold text-text-100">Trackeo de alerta</h3>
            <p className="text-[11px] text-text-300 mt-0.5">{alertTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconX size={18} />
          </button>
        </div>

        {/* Map */}
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

        {/* Info */}
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
