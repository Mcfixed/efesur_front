import BaseMap from "@/components/baseMap/components/BaseMap";
import { useTheme } from "@/context/ThemeContext";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useState, useRef, useEffect, useMemo } from "react";
import type { MapRef } from "react-map-gl";
import { toast } from "sonner";
import { IconVolume3 } from "@tabler/icons-react";
import { useCallback } from "react";
import { useDashboardData, useGatewayStatus, useAlertTimeline } from "../hooks/useDashboard";
import { useAlertVoice } from "../hooks/useAlertVoice";

// Audio
import { isAudioBlocked, registerAudioUnlock } from "../utils/audio";

// Components
import AlertTickerBanner from "../components/AlertTickerBanner";
import RightBarDashboard from "../components/RightBarDashboard";
import MapOverlayInfo from "../components/MapOverlayInfo";
import MapLayers from "../components/MapLayers";
import type { Alert, MapFocusRequest } from "../types/dashboard.types";
import AlertsChart from "../components/AlertsChart";
import FpsIndicator from "../components/FpsIndicator";
import MapErrorBoundary from "../components/MapErrorBoundary";
import GatewayStatusBar from "../components/GatewayStatusBar";
import CriticalAlertCounters from "../components/CriticalAlertCounters";

// Umbral de zoom a partir del cual se dibujan todos los sensores (igual que MapLayers)
const ZOOM_SENSORES = 13;

export default function Dashboard() {
  const { isMobile } = useBreakpoint();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isOpenRightBar, setOpenRightBar] = useState(false);
  const [showAllSensors, setShowAllSensors] = useState(false);
  // Se guarda solo el booleano del umbral, no el zoom: así un paneo normal no cambia
  // ningún estado y no re-renderiza el dashboard completo al soltar el mapa.
  const [zoomShowsSensors, setZoomShowsSensors] = useState(false);
  const [mapPitch, setMapPitch] = useState(45);
  const [mapBearing, setMapBearing] = useState(-55);
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // Se incrementa en cada (re)montaje del mapa: al cambiar de capa BaseMap lo remonta
  // (key={selectedLayer}) y hay que volver a enganchar listeners y rehacer el autozoom.
  const [mapNonce, setMapNonce] = useState(0);
  const lastCriticalIds = useRef<string | null>(null);


  const { data, isLoading } = useDashboardData();
  const { data: gatewayData } = useGatewayStatus();
  const [timelineRange, setTimelineRange] = useState("24h");
  const { data: timelineData } = useAlertTimeline(timelineRange);
  // Referencia estable: si se pasa `timelineData?.alerts || []` se crea un arreglo nuevo en
  // cada render y el memo de RightBarDashboard no sirve de nada.
  const timelineAlerts = useMemo(() => timelineData?.alerts ?? [], [timelineData]);
  // Gráfico "Alertas por Sensor": 30d fijo, independiente del timeline
  const { data: chartTimeline } = useAlertTimeline("30d");
  const historyData = useMemo(() => ({
    alerts: chartTimeline?.alerts || [],
  }), [chartTimeline]);

  // Voz de bienvenida y anuncio de alertas (TTS: todas las alertas con nombre)
  const voiceAlerts = useMemo(() => [
    ...(data?.alerts?.critical || []),
    ...(data?.alerts?.atencion || []),
    ...(data?.alerts?.apertura || []),
    ...(data?.alerts?.presencia || []),
    ...(data?.alerts?.movimientos_anomalos || []),
    ...(data?.alerts?.desconexionGW || []),
    ...(data?.alerts?.desconexion220 || []),
    ...(data?.alerts?.desconexionbatGW || []),
  ], [data?.alerts]);

  const { muted, toggleMute } = useAlertVoice({ alerts: voiceAlerts });

  // Foco en el mapa pedido desde el panel de alertas ("ver ubicación")
  const [mapFocus, setMapFocus] = useState<MapFocusRequest | null>(null);
  const focusNonce = useRef(0);
  const handleFocusAlert = useCallback((alert: Alert) => {
    setMapFocus({
      alertId: alert.id,
      deviceId: alert.device_id,
      gatewayId: alert.gateway_id ?? null,
      lng: alert.longitude_current,
      lat: alert.latitude_current,
      nonce: ++focusNonce.current,
    });
  }, []);

  // Aviso de esquina (sonner) solo si el navegador bloquea la voz.
  const AUDIO_TOAST_ID = "audio-blocked-toast";
  const audioToastShown = useRef(false);
  useEffect(() => {
    let active = true;
    const check = () => {
      const blocked = isAudioBlocked();
      if (blocked && !audioToastShown.current && !muted) {
        audioToastShown.current = true;
        toast.error(
          <div className="flex items-center gap-3 py-1">
            <IconVolume3
              size={40}
              stroke={1.8}
              className="shrink-0 text-red-400"
            />
            <span className="text-sm">
              Haz clic para activar el sonido y escuchar las alertas de monitoreo de catenarias
            </span>
          </div>,
          { id: AUDIO_TOAST_ID, duration: Infinity, position: "top-center" }
        );
      } else if (!blocked && audioToastShown.current) {
        audioToastShown.current = false;
        toast.dismiss(AUDIO_TOAST_ID);
      }
    };
    const initial = setTimeout(check, 1500);
    const interval = setInterval(check, 1500);
    registerAudioUnlock(() => {
      if (active) {
        audioToastShown.current = false;
        toast.dismiss(AUDIO_TOAST_ID);
      }
    });
    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [muted]);

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

    window.addEventListener('error', errorHandler);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // ─── TRACK MAP ZOOM ────────────────────────────────────────
  // 'moveend' (no 'move'): con 'move' hacíamos setState ~60 veces/seg y re-renderizaba todo.
  // Además sólo se actualiza cuando el valor realmente cambia: React descarta los setState
  // con el mismo valor, así que un paneo simple ya no cuesta un re-render del dashboard.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onMoveEnd = () => {
      const showsSensors = map.getZoom() >= ZOOM_SENSORES;
      setZoomShowsSensors(prev => (prev === showsSensors ? prev : showsSensors));
      const pitch = Math.round(map.getPitch());
      const bearing = Math.round(map.getBearing());
      setMapPitch(prev => (prev === pitch ? prev : pitch));
      setMapBearing(prev => (prev === bearing ? prev : bearing));
    };
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [mapLoaded, mapNonce]);

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
        { padding: hasCritical ? 10 : 60, maxZoom: 25, duration: 1000, pitch: 45, bearing: -55 }
      );
    }
  }, [data, mapLoaded, gatewayData, mapNonce]);

  //const gateways = gatewayData?.gateways || [];

  const handleToggleShowAll = useCallback(() => {
    setShowAllSensors(s => !s);
  }, []);

  // Referencia estable del arreglo de gateways
  const gateways = useMemo(() => gatewayData?.gateways || [], [gatewayData?.gateways]);



  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isDark ? "bg-bg-100" : "bg-bg-200"}`}>
      <AlertTickerBanner data={data} />

      <button
        onClick={toggleMute}
        className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all shadow-lg hover:scale-110"
        style={{ background: muted ? "rgba(100,100,100,0.6)" : "rgba(34,197,94,0.6)" }}
        title={muted ? "Activar voz" : "Silenciar voz"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className={`flex-1 w-full min-h-0 ${isMobile ? "flex flex-row" : "grid grid-cols-12"} overflow-hidden ${isDark ? "" : "bg-gradient-to-br from-bg-100 via-bg-200 to-bg-100"}`}>
        <div className={`${!isMobile && "col-span-10"} h-full flex flex-col w-full relative min-h-0 overflow-hidden ${isDark ? "" : "border-r border-border/70"}`}>
          
          <MapErrorBoundary>
            <BaseMap 
              onMapRef={(map) => {
                mapRef.current = map;
                setMapLoaded(!!map);
                // Mapa nuevo → se invalida el fingerprint para que el autozoom se repita
                if (map) { lastCriticalIds.current = null; setMapNonce(n => n + 1); }
              }} 
              initialCenter={{ longitude: -71.0, latitude: -33.0 }} 
              initialZoom={5}
              initialPitch={45}
              initialBearing={-55}
            >
              {/* Se quitó el overlay de pulso a pantalla completa: era una capa del tamaño del
                  viewport mezclándose sobre el canvas WebGL en cada frame sin aportar nada
                  visible sobre la imagen satelital. */}
              <MapOverlayInfo data={data} />

              {/* Indicadores de inclinación, rotación y FPS */}
<div className={`absolute bottom-2 left-2 z-20 border rounded px-2 py-1 text-[10px] font-mono shadow-lg flex items-center gap-3 ${isDark ? "bg-black/70 border-white/20 text-white/90" : "bg-white/85 border-slate-200 text-slate-700"}`}>
  <div className="flex items-center gap-1">
    <span className={isDark ? "text-white/50" : "text-slate-500"}>Pitch</span>
    <span className={`font-bold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>{Math.round(mapPitch)}°</span>
  </div>
  <div className="flex items-center gap-1">
    <span className={isDark ? "text-white/50" : "text-slate-500"}>Bear</span>
    <span className={`font-bold ${isDark ? "text-amber-300" : "text-amber-700"}`}>{Math.round(mapBearing)}°</span>
  </div>
  
  <FpsIndicator mapLoaded={mapLoaded} />
</div>

              {gateways.length > 0 && (
                <div className="absolute left-2 z-10" style={{ top: '120px' }}>
                  <GatewayStatusBar gateways={gateways} />
                </div>
              )}

              {/* El buscador de sensores vive en MapLayers (es quien controla el popup) */}
              {/* Alertas críticas con su contador, arriba a la derecha del mapa */}
              {(data?.alerts?.critical?.length ?? 0) > 0 && (
                <div className={`absolute top-12 right-12 z-20 flex flex-col rounded-lg px-3 py-2 shadow-lg min-w-44 max-w-64 max-h-[55vh] overflow-y-auto ${isDark ? "bg-red-950/90 border border-red-500/50" : "bg-red-50 border border-red-200 shadow-[0_12px_30px_rgba(239,68,68,0.12)]"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="16" height="16" viewBox="-9 -9 18 18" className="animate-pulse shrink-0">
                      <circle cx="0" cy="0" r="8" fill="#ef4444" />
                      <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">!</text>
                    </svg>
                    <span className="text-[11px] font-semibold text-red-400">{(data?.alerts?.critical?.length ?? 0)} críticas</span>
                  </div>
                  <CriticalAlertCounters alerts={data?.alerts?.critical || []} />
                </div>
              )}
              <MapLayers data={data} gateways={gateways} showAllSensors={showAllSensors} onToggleShowAll={handleToggleShowAll} showSensorsFromZoom={zoomShowsSensors} focusRequest={mapFocus} />
            </BaseMap>
          </MapErrorBoundary>

          <AlertsChart historyData={historyData} isLoading={isLoading} />
        </div>

        <RightBarDashboard 
          timelineData={timelineAlerts}
          timelineRange={timelineRange}
          setTimelineRange={setTimelineRange}
          isLoading={isLoading}
          isMobile={isMobile}
          isOpen={isOpenRightBar}
          setOpen={setOpenRightBar}
          onFocusAlert={handleFocusAlert}
        />
      </div>
    </div>
  );
}
