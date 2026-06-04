import BaseMap from "@/components/baseMap/components/BaseMap";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useState, useRef, useEffect } from "react";
import type { MapRef } from "react-map-gl";

// Custom Hooks
import { useDashboardData, useGatewayStatus, useAlertHistory, useAlertTimeline } from "../hooks/useDashboard";
import { useCriticalAlertSound } from "../hooks/useCriticalAlertSound";

// Components
import GatewayStatusBar from "../components/GatewayStatusBar";
import RightBarDashboard from "../components/RightBarDashboard";
import MapOverlayInfo from "../components/MapOverlayInfo";
import MapLayers from "../components/MapLayers";
import AlertsChart from "../components/AlertsChart";
import MapErrorBoundary from "../components/MapErrorBoundary";

export default function Dashboard() {
  const { isMobile } = useBreakpoint();
  const [isOpenRightBar, setOpenRightBar] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const lastMode = useRef<'all'|'critical'|null>(null);

  // Data fetching
  const { data, isLoading } = useDashboardData();
  const { data: gatewayData } = useGatewayStatus();
  const { data: historyData } = useAlertHistory("critica", "24h");
  const [timelineRange, setTimelineRange] = useState("24h");
  const { data: timelineData } = useAlertTimeline(timelineRange);

  // Side effects
  useCriticalAlertSound(data?.alerts?.critical?.length ?? 0);

  // Global error handler para suprimir errores de Mapbox GL durante source cleanup
  useEffect(() => {
    const originalError = console.error;
    
    const errorHandler = (event: ErrorEvent) => {
      // Suprimir el error específico de Mapbox GL: updateTerrain
      if (
        event.error?.message?.includes('Cannot read properties of undefined') &&
        event.filename?.includes('mapbox-gl')
      ) {
        console.warn('[Mapbox] Error de terrain suppressado durante source cleanup');
        event.preventDefault?.();
        return;
      }
    };

    // Wrappear console.error para capturar errores de mapbox-gl
    console.error = function(...args: any[]) {
      const errorStr = String(args[0]);
      if (
        errorStr?.includes('Cannot read properties of undefined') &&
        (args[0]?.message?.includes('updateTerrain') || 
         String(args[1])?.includes('mapbox-gl') ||
         new Error().stack?.includes('mapbox-gl'))
      ) {
        console.warn('[Mapbox] Error capturado y suppressado: terrain/source cleanup');
        return;
      }
      return originalError.apply(console, args);
    };

    // Event listener para uncaught errors
    window.addEventListener('error', errorHandler);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // ─── AUTO ZOOM ─────────────────────────────────────────────
  // Lógica simple: si hay críticas → zoom a críticas, si no → zoom a todos
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !data) return;

    // Obtener todas las coordenadas
    const allItems = [
      ...(data.devices || []).filter(d => d.latitude_current && d.longitude_current),
      ...(gatewayData?.gateways || []).filter(g => g.latitude_current && g.longitude_current),
    ];

    // Obtener solo alertas críticas
    const criticalItems = (data.alerts?.critical || []).filter(a => a.latitude_current && a.longitude_current);

    // Decidir qué zoom hacer
    const newMode = criticalItems.length > 0 ? 'critical' : 'all';
    const itemsToZoom = newMode === 'critical' ? criticalItems : allItems;

    // Solo hacer zoom si cambió el modo
    if (newMode !== lastMode.current && itemsToZoom.length > 0) {
      lastMode.current = newMode;

      // Calcular bounds
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const item of itemsToZoom) {
        const lng = Number(item.longitude_current);
        const lat = Number(item.latitude_current);
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      // Agregar padding
      const padLng = Math.max((maxLng - minLng) * 0.2, 0.03);
      const padLat = Math.max((maxLat - minLat) * 0.2, 0.03);

      // Hacer zoom
      mapRef.current.fitBounds(
        [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]],
        { padding: newMode === 'critical' ? 100 : 120, maxZoom: 15, duration: 1000 }
      );
    }
  }, [data, mapLoaded, gatewayData]);

  const gateways = gatewayData?.gateways || [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <GatewayStatusBar gateways={gateways} />

      <div className={`flex-1 w-full min-h-0 ${isMobile ? "flex flex-row" : "grid grid-cols-12"} overflow-hidden`}>
        <div className={`${!isMobile && "col-span-10"} h-full flex flex-col w-full relative min-h-0 overflow-hidden`}>
          
          <MapErrorBoundary>
            <BaseMap 
              onMapRef={(map) => { mapRef.current = map; setMapLoaded(!!map); }} 
              initialCenter={{ longitude: -71.0, latitude: -33.0 }} 
              initialZoom={5}
            >
              <MapOverlayInfo data={data} />
              {/* Warning rojo flotante en esquina superior derecha del mapa */}
              {(data?.alerts?.critical?.length ?? 0) > 0 && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-red-950/80 border border-red-500/50 rounded-lg px-2.5 py-1.5 shadow-lg backdrop-blur-sm animate-pulse">
                  <svg width="18" height="18" viewBox="-9 -9 18 18">
                    <circle cx="0" cy="0" r="8" fill="#ef4444" />
                    <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">!</text>
                  </svg>
                  <span className="text-[11px] font-semibold text-red-400">{data.alerts.critical.length} críticas</span>
                </div>
              )}
              <MapLayers data={data} gateways={gateways} />
            </BaseMap>
          </MapErrorBoundary>

          <AlertsChart historyData={historyData} isLoading={isLoading} />
        </div>

        <RightBarDashboard 
          timelineData={timelineData?.alerts || []}
          timelineRange={timelineRange}
          setTimelineRange={setTimelineRange}
          isLoading={isLoading}
          isMobile={isMobile}
          isOpen={isOpenRightBar}
          setOpen={setOpenRightBar}
        />
      </div>
    </div>
  );
}
