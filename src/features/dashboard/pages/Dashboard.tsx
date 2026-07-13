import BaseMap from "@/components/baseMap/components/BaseMap";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useState, useRef, useEffect, useMemo } from "react";
import type { MapRef } from "react-map-gl";

// Custom Hooks
import { useDashboardData, useGatewayStatus, useAlertHistory, useAlertTimeline } from "../hooks/useDashboard";
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

export default function Dashboard() {
  const { isMobile } = useBreakpoint();
  const [isOpenRightBar, setOpenRightBar] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const lastCriticalIds = useRef<string | null>(null);

  // Data fetching
  const { data, isLoading } = useDashboardData();
  const { data: gatewayData } = useGatewayStatus();
  const { data: criticaHistory } = useAlertHistory("critica", "total");
  const { data: atencionHistory } = useAlertHistory("atencion", "total");
  const { data: movimientosHistory } = useAlertHistory("movimientos_anomalos", "total");
  const [timelineRange, setTimelineRange] = useState("24h");
  const { data: timelineData } = useAlertTimeline(timelineRange);
  // Unificar historial de todos los tipos para el gráfico
  const historyData = useMemo(() => {
    const alerts = [
      ...(criticaHistory?.alerts || []),
      ...(atencionHistory?.alerts || []),
      ...(movimientosHistory?.alerts || []),
    ];
    return { alerts };
  }, [criticaHistory, atencionHistory, movimientosHistory]);

  // Side effects
  useAlertSound({
    critical: data?.alerts?.critical?.length ?? 0,
    atencion: data?.alerts?.atencion?.length ?? 0,
    desconexionGW: data?.alerts?.desconexionGW?.length ?? 0,
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
    const hasCritical = criticalItems.length > 0;
    const itemsToZoom = hasCritical ? criticalItems : allItems;

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
        { padding: hasCritical ? 10 : 60, maxZoom: 25, duration: 1000 }
      );
    }
  }, [data, mapLoaded, gatewayData]);

  const gateways = gatewayData?.gateways || [];

  // Determinar color del parpadeo del mapa
  const pulseColor = (data?.alerts?.critical?.length ?? 0) > 0
    ? '255, 68, 68'   // rojo
    : (data?.alerts?.movimientos_anomalos?.length ?? 0) > 0
      ? '168, 85, 247' // púrpura
      : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Keyframes para el parpadeo del mapa */}
      <style>{`
        @keyframes map-alert-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(${pulseColor || '0,0,0'}, 0); }
          25% { box-shadow: inset 0 0 120px 20px rgba(${pulseColor || '0,0,0'}, 0.4); }
          50% { box-shadow: inset 0 0 150px 30px rgba(${pulseColor || '0,0,0'}, 0.25); }
          75% { box-shadow: inset 0 0 120px 20px rgba(${pulseColor || '0,0,0'}, 0.4); }
        }
        @keyframes map-alert-pulse-off {
          0%, 100% { box-shadow: none; }
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
            >
              {/* Parpadeo de alerta que cubre todo el mapa */}
              {pulseColor && (
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 0 0 rgba(${pulseColor}, 0)`,
                    animation: 'map-alert-pulse 2s ease-in-out infinite',
                    borderRadius: 'inherit',
                  }}
                />
              )}
              <MapOverlayInfo data={data} />

              {/* Gateway status panel — separado debajo del resumen */}
              {gateways.length > 0 && (
                <div className="absolute left-2 z-10 flex flex-col gap-1.5"
                  style={{ top: '195px' }}>
                  <div className="flex items-center gap-2 text-[13px] text-text-100 font-bold uppercase tracking-wider bg-bg-100/80 backdrop-blur-sm border border-border/30 rounded-lg px-2.5 py-1.5 shadow-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="18" r="1"/><path d="M3 9a17 17 0 0 1 18 0"/><path d="M6 13a10 10 0 0 1 12 0"/></svg>
                    Gateways
                    <span className="font-bold text-green-400 text-[12px] ml-1">{gateways.filter(g => g.is_online).length}/{gateways.length}</span>
                  </div>
                  {/* Online: puntitos con contorno */}
                  {gateways.filter(g => g.is_online).length > 0 && (
                    <div className="bg-bg-100/80 backdrop-blur-sm border border-border/30 rounded-lg px-2.5 py-1.5 shadow-lg inline-flex flex-wrap gap-1.5 w-fit">
                      {gateways.filter(g => g.is_online).map(gw => (
                        <div key={gw.id} className="w-5 h-5 rounded-full bg-green-500/15 border border-green-400/30 flex items-center justify-center" title={gw.name}>
                          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Offline: cada uno con su propio contenedor */}
                  {gateways.filter(g => !g.is_online).map(gw => (
                    <div key={gw.id} className="flex items-center gap-2 text-[13px] bg-red-950/70 backdrop-blur-sm border border-red-500/30 rounded-lg px-2.5 py-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-red-400 animate-pulse" />
                      <span className="text-red-300 truncate max-w-28 font-medium">{gw.name.replace(/^Gateway\s/, 'GW ')}</span>
                      <span className="text-[11px] font-bold text-red-400">OFF</span>
                    </div>
                  ))}
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
