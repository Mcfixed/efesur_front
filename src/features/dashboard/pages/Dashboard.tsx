import BaseMap from "@/components/baseMap/components/BaseMap";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useFps } from "@/hooks/useFps";
import { useState, useRef, useEffect, useMemo } from "react";
import type { MapRef } from "react-map-gl";

// Custom Hooks
import { useDashboardData, useGatewayStatus, useAlertTimeline } from "../hooks/useDashboard";
import { useAlertSound } from "../hooks/useCriticalAlertSound";
import { useAlertVoice } from "../hooks/useAlertVoice";

// Components
import AlertTickerBanner from "../components/AlertTickerBanner";
import RightBarDashboard from "../components/RightBarDashboard";
import MapOverlayInfo from "../components/MapOverlayInfo";
import MapLayers from "../components/MapLayers";
import MapSearchBox from "../components/MapSearchBox";
import AlertsChart from "../components/AlertsChart";
import MapErrorBoundary from "../components/MapErrorBoundary";
import GatewayStatusBar from "../components/GatewayStatusBar";

export default function Dashboard() {
  const { isMobile } = useBreakpoint();
  const [isOpenRightBar, setOpenRightBar] = useState(false);
  const [showAllSensors, setShowAllSensors] = useState(false);
  const [mapZoom, setMapZoom] = useState(5);
  const [mapPitch, setMapPitch] = useState(69);
  const [mapBearing, setMapBearing] = useState(-55);
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const lastCriticalIds = useRef<string | null>(null);

  // Medidor de FPS en tiempo real (se muestra en el overlay del mapa)
  const fps = useFps(mapLoaded);

  // Data fetching
  const { data, isLoading } = useDashboardData();
  const { data: gatewayData } = useGatewayStatus();
  const [timelineRange, setTimelineRange] = useState("24h");
  const { data: timelineData } = useAlertTimeline(timelineRange);
  // Datos para el gráfico "Alertas por Sensor" (rango fijo 30d, independiente del timeline)
  const { data: chartTimeline } = useAlertTimeline("30d");
  const historyData = useMemo(() => ({
    alerts: chartTimeline?.alerts || [],
  }), [chartTimeline]);

  // Side effects
  useAlertSound({
    critical: (data?.alerts?.critical?.length ?? 0) + (data?.alerts?.apertura?.length ?? 0),
    atencion: (data?.alerts?.atencion?.length ?? 0) + (data?.alerts?.presencia?.length ?? 0),
    desconexionGW: (data?.alerts?.desconexionGW?.length ?? 0) + (data?.alerts?.desconexion220?.length ?? 0) + (data?.alerts?.desconexionbatGW?.length ?? 0),
    movimientos_anomalos: data?.alerts?.movimientos_anomalos?.length ?? 0,
  });

  // Voz de bienvenida y anuncio de alertas
  const { muted, toggleMute } = useAlertVoice({
    alerts: [
      ...(data?.alerts?.critical || []),
      ...(data?.alerts?.atencion || []),
    ],
  });

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

  // ─── TRACK MAP ZOOM ────────────────────────────────────────
  // IMPORTANTE: usamos 'moveend' (no 'move') para no hacer setState ~60 veces/seg
  // mientras se arrastra/rota el mapa, que re-renderizaba todo el dashboard.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onMoveEnd = () => { setMapZoom(map.getZoom()); setMapPitch(map.getPitch()); setMapBearing(map.getBearing()); };
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [mapLoaded]);

  // ─── AUTO ZOOM ─────────────────────────────────────────────
  // Lógica simple: si hay críticas → zoom a críticas, si no → zoom a todos
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !data) return;

    // Obtener solo gateways (por defecto)
    const gwItems = (gatewayData?.gateways || []).filter(g => g.latitude_current && g.longitude_current);

    // Obtener solo alertas críticas
    const criticalItems = (data.alerts?.critical || []).filter(a => a.latitude_current && a.longitude_current);

    // Decidir qué zoom hacer: críticas tienen prioridad, sino gateways
    const hasCritical = criticalItems.length > 0;
    const itemsToZoom = hasCritical ? criticalItems : gwItems;

    // Generar fingerprint de las alertas críticas para detectar cambios
    const criticalFingerprint = criticalItems.length > 0 ? criticalItems.map(a => a.id).sort().join(',') : 'none';

    // Solo hacer zoom si cambió el conjunto de críticas o es la primera vez (lastCriticalIds empieza null)
    if (criticalFingerprint !== lastCriticalIds.current && itemsToZoom.length > 0) {
      lastCriticalIds.current = criticalFingerprint;

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
      const padLng = Math.max((maxLng - minLng) * (hasCritical ? 0.02 : 0.1), 0.002);
      const padLat = Math.max((maxLat - minLat) * (hasCritical ? 0.02 : 0.1), 0.002);

      // Hacer zoom
      mapRef.current.fitBounds(
        [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]],
        { padding: hasCritical ? 10 : 60, maxZoom: 25, duration: 1000, pitch: 69, bearing: -55 }
      );
    }
  }, [data, mapLoaded, gatewayData]);

  const gateways = gatewayData?.gateways || [];

  // Determinar color del parpadeo del mapa
  const hasCritical = (data?.alerts?.critical?.length ?? 0) > 0;
  const hasMovements = (data?.alerts?.movimientos_anomalos?.length ?? 0) > 0;
  const pulseClass = hasCritical ? 'map-alert-pulse-red' : hasMovements ? 'map-alert-pulse-purple' : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <style>{`
        @keyframes map-alert-pulse-red {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.5; }
        }
        @keyframes map-alert-pulse-purple {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <AlertTickerBanner data={data} />

      {/* Botón de silenciar voz */}
      <button
        onClick={toggleMute}
        className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all shadow-lg hover:scale-110"
        style={{ background: muted ? "rgba(100,100,100,0.6)" : "rgba(34,197,94,0.6)" }}
        title={muted ? "Activar voz" : "Silenciar voz"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className={`flex-1 w-full min-h-0 ${isMobile ? "flex flex-row" : "grid grid-cols-12"} overflow-hidden`}>
        <div className={`${!isMobile && "col-span-10"} h-full flex flex-col w-full relative min-h-0 overflow-hidden`}>
          
          <MapErrorBoundary>
            <BaseMap 
              onMapRef={(map) => { mapRef.current = map; setMapLoaded(!!map); }} 
              initialCenter={{ longitude: -71.0, latitude: -33.0 }} 
              initialZoom={5}
              initialPitch={69}
              initialBearing={-55}
            >
              {pulseClass && (
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{ animation: `${pulseClass} 2s ease-in-out infinite`, borderRadius: 'inherit', background: hasCritical ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.25) 0%, transparent 70%)' : 'radial-gradient(ellipse at center, rgba(168,85,247,0.25) 0%, transparent 70%)' }}
                />
              )}
              <MapOverlayInfo data={data} />

              {/* Indicadores de inclinación, rotación y FPS */}
              <div className="absolute bottom-2 left-2 z-20 bg-black/70 border border-white/20 rounded px-3 py-1.5 text-[11px] font-mono text-white/90 shadow-lg space-y-0.5">
                <div className="flex items-center gap-2"><span className="text-white/50">Pitch</span><span className="font-bold text-cyan-300">{Math.round(mapPitch)}°</span></div>
                <div className="flex items-center gap-2"><span className="text-white/50">Bear</span><span className="font-bold text-amber-300">{Math.round(mapBearing)}°</span></div>
                <div className="flex items-center gap-2"><span className="text-white/50">FPS</span><span className="font-bold" style={{ color: fps === null ? '#9ca3af' : fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171' }}>{fps ?? '—'}</span></div>
              </div>

              {gateways.length > 0 && (
                <div className="absolute left-2 z-10" style={{ top: '120px' }}>
                  <GatewayStatusBar gateways={gateways} />
                </div>
              )}

              <MapSearchBox
                data={data}
                gateways={gateways}
                onFlyTo={(lng, lat) => {
                  mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
                }}
              />
              {/* Warning rojo flotante en esquina superior derecha del mapa */}
              {(data?.alerts?.critical?.length ?? 0) > 0 && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-red-950/80 border border-red-500/50 rounded-lg px-2.5 py-1.5 shadow-lg backdrop-blur-sm animate-pulse">
                  <svg width="18" height="18" viewBox="-9 -9 18 18">
                    <circle cx="0" cy="0" r="8" fill="#ef4444" />
                    <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">!</text>
                  </svg>
                  <span className="text-[11px] font-semibold text-red-400">{(data?.alerts?.critical?.length ?? 0)} críticas</span>
                </div>
              )}
              <MapLayers data={data} gateways={gateways} showAllSensors={showAllSensors} onToggleShowAll={() => setShowAllSensors(s => !s)} mapZoom={mapZoom} />
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
