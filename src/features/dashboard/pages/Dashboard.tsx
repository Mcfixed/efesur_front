import BaseMap from "@/components/baseMap/components/BaseMap";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useState, useRef, useEffect } from "react";
import type { MapRef } from "react-map-gl";

// Custom Hooks
import { useDashboardData, useGatewayStatus, useAlertHistory, useAlertTimeline } from "../hooks/useDashboard";
import { useCriticalAlertSound } from "../hooks/useCriticalAlertSound";
import { useMapAutoZoom } from "../hooks/useMapAutoZoom";

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

  // Data fetching
  const { data, isLoading } = useDashboardData();
  const { data: gatewayData } = useGatewayStatus();
  const { data: historyData } = useAlertHistory("critica", "24h");
  const [timelineRange, setTimelineRange] = useState("24h");
  const { data: timelineData } = useAlertTimeline(timelineRange);

  // Side effects
  useCriticalAlertSound(data?.alerts?.critical?.length ?? 0);
  useMapAutoZoom(mapRef, mapLoaded, data);

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

  const gateways = gatewayData?.gateways || [];

  return (
    <div className="w-full h-full flex flex-col">
      <GatewayStatusBar gateways={gateways} />

      <div className={`flex-1 w-full ${isMobile ? "flex flex-row" : "grid grid-cols-12 overflow-hidden"}`}>
        <div className={`${!isMobile && "col-span-10"} h-full flex flex-col w-full relative min-h-0 overflow-hidden`}>
          
          <MapErrorBoundary>
            <BaseMap 
              onMapRef={(map) => { mapRef.current = map; setMapLoaded(!!map); }} 
              initialCenter={{ longitude: -71.0, latitude: -33.0 }} 
              initialZoom={5}
            >
              <MapOverlayInfo data={data} />
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
