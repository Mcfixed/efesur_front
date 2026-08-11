import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { Marker, Source, Layer, Popup } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type { DashboardData, GatewayDevice, GpsDevice } from "../types/dashboard.types";
import DevicePopup from "./DevicePopup";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

interface Props {
  data?: DashboardData;
  gateways: GatewayDevice[];
  showAllSensors?: boolean;
  onToggleShowAll?: () => void;
  mapZoom?: number;
  mapRef?: React.RefObject<MapRef | null>;
  mapLoaded?: boolean;
}

function createCircleGeoJSON(lng: number, lat: number, radiusKm: number) {
  const points = 48;
  const kmPerDegree = 111.32;
  const latRad = (lat * Math.PI) / 180;
  const lngDeg = radiusKm / (kmPerDegree * Math.cos(latRad));
  const latDeg = radiusKm / kmPerDegree;

  const coordinates: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dx = lngDeg * Math.cos(angle);
    const dy = latDeg * Math.sin(angle);
    coordinates.push([lng + dx, lat + dy]);
  }
  return { type: "Polygon" as const, coordinates: [coordinates] };
}

const ZOOM_THRESHOLD = 13;

export default function MapLayers({ data, gateways, showAllSensors, onToggleShowAll, mapZoom = 0, mapRef, mapLoaded }: Props) {
  const showSensors = showAllSensors || mapZoom >= ZOOM_THRESHOLD;
  const [selectedDevice, setSelectedDevice] = useState<GpsDevice | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<GatewayDevice | null>(null);
  const [selectedTrackingAlert, setSelectedTrackingAlert] = useState<number | null>(null);

  // ─── PRE-INDEXADO DE ALERTAS POR DEVICE (Fix: evita .some() O(N×M) por cada render) ───
  const alertsByDevice = useMemo(() => {
    const map = new Map<number, { critical?: boolean; atencion?: boolean; movimientos_anomalos?: boolean; apertura?: boolean; presencia?: boolean }>();
    const idx = (arr: any[] | undefined, key: 'critical' | 'atencion' | 'movimientos_anomalos' | 'apertura' | 'presencia') => {
      (arr || []).forEach(a => {
        if (a.device_id == null) return;
        const entry = map.get(a.device_id) || {};
        entry[key] = true;
        map.set(a.device_id, entry);
      });
    };
    idx(data?.alerts?.critical, 'critical');
    idx(data?.alerts?.atencion, 'atencion');
    idx(data?.alerts?.movimientos_anomalos, 'movimientos_anomalos');
    idx(data?.alerts?.apertura, 'apertura');
    idx(data?.alerts?.presencia, 'presencia');
    return map;
  }, [data?.alerts]);

  // Mapa device.id → device para el popup (evita .find() en cada click)
  const devicesById = useMemo(() => {
    const map = new Map<number, GpsDevice>();
    (data?.devices || []).forEach(d => map.set(d.id, d));
    return map;
  }, [data?.devices]);

  // Sensor normal SIN alerta → se pinta como capa GL (canvas) en lugar de <Marker> DOM
  const normalSensorsGeoJSON = useMemo(() => {
    if (!data?.devices) return null;
    const features: any[] = [];
    for (const device of data.devices) {
      if (!device.latitude_current || !device.longitude_current) continue;
      const dAlert = alertsByDevice.get(device.id);
      const hasAlert = !!(dAlert?.critical || dAlert?.atencion || dAlert?.movimientos_anomalos || dAlert?.apertura || dAlert?.presencia);
      if (hasAlert) continue; // con alerta → se renderiza como <Marker> individual
      if (!showSensors) continue; // sin alerta y zoom bajo → oculto
      const typeColors: Record<string, string> = {
        Gps: '#3b82f6', Gateway: '#10b981', SubEstacion: '#8b5cf6', Lector: '#f97316',
      };
      features.push({
        type: 'Feature',
        properties: {
          id: device.id,
          color: typeColors[device.type_device] || '#3b82f6',
          letter: device.type_device === 'SubEstacion' ? 'S' : (device.type_device?.[0] || 'G'),
        },
        geometry: { type: 'Point', coordinates: [Number(device.longitude_current), Number(device.latitude_current)] },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [data?.devices, alertsByDevice, showSensors]);

  // Click en la capa GL de sensores normales → abre popup del device
  const handleSensorLayerClick = useCallback((e: any) => {
    const feature = e?.features?.[0];
    if (!feature) return;
    const device = devicesById.get(feature.properties?.id);
    if (device) setSelectedDevice(device);
  }, [devicesById]);

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef?.current?.getMap?.();
    if (!map) return;
    map.on('click', 'normal-sensors-symbol', handleSensorLayerClick);
    return () => { map.off('click', 'normal-sensors-symbol', handleSensorLayerClick); };
  }, [mapRef, mapLoaded, handleSensorLayerClick]);

  // Cargar la imagen del pin (SDF) para la capa de sensores normales — una sola vez
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef?.current?.getMap?.();
    if (!map || map.hasImage('sensor-pin')) return;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 28 36">
        <path d="M14 1C6.8 1 1 6.8 1 14c0 9.5 13 19.5 13 19.5S27 23.5 27 14C27 6.8 21.2 1 14 1z"
          fill="#ffffff" fill-opacity="1" stroke="#ffffff" stroke-width="2"/>
      </svg>
    `;
    const url = 'data:image/svg+xml;base64,' + btoa(svg);
    map.loadImage(url, (err: any, image: any) => {
      if (err || !image) return;
      if (!map.hasImage('sensor-pin')) map.addImage('sensor-pin', image, { sdf: true });
    });
  }, [mapRef, mapLoaded]);

  // Tracking routes — solo para críticas
  const trackingRoutes = useMemo(() => {
    if (!data?.alerts?.critical) return [];
    return data.alerts.critical
      .filter(a => a.tracking_data && a.tracking_data.length >= 2)
      .map(alert => ({
        alertId: alert.id,
        geojson: {
          type: "Feature" as const,
          properties: { alertId: alert.id },
          geometry: {
            type: "LineString" as const,
            coordinates: alert.tracking_data!.map(p => [p.longitude, p.latitude]),
          },
        },
        // Punto más reciente (el tracking viene ORDER BY DESC, index 0 = más reciente)
        lastPoint: alert.tracking_data![0],
      }));
  }, [data?.alerts?.critical]);

  // Gateway coverage circles
  const gatewayCoverage = useMemo(() => {
    return gateways
      .filter(gw => gw.latitude_current && gw.longitude_current)
      .map(gw => ({
        id: gw.id,
        isOnline: gw.is_online,
        geojson: {
          type: "Feature" as const,
          properties: { id: gw.id, is_online: gw.is_online },
          geometry: createCircleGeoJSON(gw.longitude_current, gw.latitude_current, 5),
        },
      }));
  }, [gateways]);

  // ─── FUNCIONES DE RENDERIZADO DE ICONOS ─────────────────────────────────
  const renderAlertIcon = (type: 'critical' | 'atencion' | 'movimientos_anomalos' | 'apertura' | 'presencia') => {
    const isCrit = type === 'critical';
    const isMov = type === 'movimientos_anomalos';
    const isRed = type === 'apertura' || type === 'presencia';
    const color = isCrit ? '#ef4444' : isRed ? '#ef4444' : isMov ? '#a855f7' : '#eab308';
    const borderColor = isCrit ? '#b91c1c' : isRed ? '#b91c1c' : isMov ? '#7e22ce' : '#a16207';
    const size = isCrit ? 48 : isRed ? 42 : isMov ? 42 : 36;
    const glowColor = isCrit ? '#ef4444' : isRed ? '#ef4444' : isMov ? '#a855f7' : '#eab308';

    return (
      <div className="relative flex items-center justify-center cursor-pointer group">
        <span className="absolute rounded-full aura-ping"
          style={{
            width: size + 16,
            height: size + 16,
            backgroundColor: glowColor,
            opacity: 0.15,
            boxShadow: `0 0 16px 6px ${glowColor}44`,
          }} />
        <div className="relative drop-shadow-2xl transition-transform group-hover:scale-125">
          <svg width={size} height={size} viewBox="-24 -24 48 48">
            {isCrit ? (
              <>
                {/* Romboide rojo intenso */}
                <polygon points="0,-20 20,0 0,20 -20,0" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
                <polygon points="0,-15 14,0 0,15 -14,0" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
                <rect x="-3" y="-10" width="6" height="13" rx="2" fill="white" />
                <circle cx="0" cy="9" r="4" fill="white" />
              </>
            ) : isRed ? (
              <>
                {/* Romboide rojo (apertura/presencia) */}
                <polygon points="0,-18 18,0 0,18 -18,0" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
                <polygon points="0,-13 12,0 0,13 -12,0" fill="none" stroke="white" strokeWidth="0.8" opacity="0.2" />
                {type === 'apertura' ? (
                  <>
                    {/* Icono puerta abierta (rectángulo con línea) */}
                    <rect x="-5" y="-6" width="10" height="12" rx="1" fill="none" stroke="white" strokeWidth="1.8" />
                    <line x1="5" y1="-6" x2="5" y2="6" stroke="white" strokeWidth="1.8" />
                    <circle cx="2" cy="0" r="1" fill="white" />
                  </>
                ) : (
                  <>
                    {/* Icono persona (círculo + triángulo) */}
                    <circle cx="0" cy="-5" r="4" fill="none" stroke="white" strokeWidth="1.8" />
                    <path d="M-6 6 Q0 -1 6 6" fill="none" stroke="white" strokeWidth="1.8" />
                  </>
                )}
              </>
            ) : isMov ? (
              <>
                {/* Hexágono púrpura (movimientos anómalos) */}
                <polygon points="0,-18 15.5,-9 15.5,9 0,18 -15.5,9 -15.5,-9" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
                {/* Brillo interior */}
                <polygon points="0,-13 11,-6.5 11,6.5 0,13 -11,6.5 -11,-6.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
                {/* Reloj / movimiento */}
                <circle cx="0" cy="0" r="8" fill="none" stroke="white" strokeWidth="1.8" opacity="0.9" />
                <line x1="0" y1="0" x2="0" y2="-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="0" y1="0" x2="4" y2="1" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Triángulo amarillo (atencion) */}
                <path d="M0 -18 L20 14 L-20 14 Z" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
                <path d="M0 -12 L14 10 L-14 10 Z" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
                <rect x="-2.5" y="-9" width="5" height="11" rx="1.5" fill="white" />
                <circle cx="0" cy="7" r="3" fill="white" />
              </>
            )}
          </svg>
        </div>
      </div>
    );
  };

  // Mapa de alertas de lector por gateway (vía gateway_id)
  const gatewayAlertMap = useMemo(() => {
    const map = new Map<number, { apertura: boolean; presencia: boolean }>();
    const now = Date.now();
    const thirtyMin = 30 * 60 * 1000;
    (data?.alerts?.apertura || []).forEach(a => {
      if (a.gateway_id && (now - new Date(a.created_at).getTime()) < thirtyMin) {
        if (!map.has(a.gateway_id)) map.set(a.gateway_id, { apertura: false, presencia: false });
        map.get(a.gateway_id)!.apertura = true;
      }
    });
    (data?.alerts?.presencia || []).forEach(a => {
      if (a.gateway_id && (now - new Date(a.created_at).getTime()) < thirtyMin) {
        if (!map.has(a.gateway_id)) map.set(a.gateway_id, { apertura: false, presencia: false });
        map.get(a.gateway_id)!.presencia = true;
      }
    });
    return map;
  }, [data?.alerts?.apertura, data?.alerts?.presencia]);

  const renderGatewayIcon = (isOnline: boolean, gatewayId?: number) => {
    const lectorAlert = gatewayId ? gatewayAlertMap.get(gatewayId) : undefined;
    const hasLectorAlert = lectorAlert && (lectorAlert.apertura || lectorAlert.presencia);
    const color = hasLectorAlert ? '#ef4444' : (isOnline ? '#22c55e' : '#ef4444');

    return (
      <div className="relative flex items-center justify-center group cursor-default">
        <span className="absolute w-14 h-14 rounded-full"
          style={{
            animation: 'aura-ping 3s ease-out infinite',
            backgroundColor: color,
            opacity: hasLectorAlert ? 0.25 : 0.15,
            boxShadow: `0 0 14px 5px ${color}44`,
          }} />
        <div className="relative drop-shadow-xl transition-transform group-hover:scale-125">
          {hasLectorAlert ? (
            <svg width="38" height="38" viewBox="-19 -19 38 38">
              {/* Círculo rojo de alerta alrededor */}
              <circle cx="0" cy="0" r="17" fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.6" />
              <circle cx="0" cy="0" r="15" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
              {/* Icono WiFi */}
              <path d="M-9 -4 Q-5 -8 0 -8 Q5 -8 9 -4" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M-6 0 Q-3 -4 0 -4 Q3 -4 6 0" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <path d="M-3 4 Q-1.5 1 0 1 Q1.5 1 3 4" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="0" cy="7" r="2.5" fill="#ef4444" />
              {/* Iconos pequeños de alerta arriba-derecha */}
              {lectorAlert?.apertura && (
                <g transform="translate(10,-13)">
                  <rect x="-4" y="-4" width="8" height="9" rx="1" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                  <line x1="4" y1="-4" x2="4" y2="5" stroke="#ef4444" strokeWidth="1.5" />
                  <circle cx="1.5" cy="1" r="0.8" fill="#ef4444" />
                </g>
              )}
              {lectorAlert?.presencia && (
                <g transform={`translate(${lectorAlert?.apertura ? 16 : 10},-13)`}>
                  <circle cx="0" cy="-3" r="3" fill="none" stroke="#ef4444" strokeWidth="1.2" />
                  <path d="M-5 5 Q0 -1 5 5" fill="none" stroke="#ef4444" strokeWidth="1.2" />
                </g>
              )}
            </svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 34 34">
              <defs>
                <linearGradient id={`gw-${isOnline ? 'on' : 'off'}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <path d="M7 12 Q11 7 17 7 Q23 7 27 12" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
              <path d="M10 16 Q13 12 17 12 Q21 12 24 16" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M13 20 Q15 17 17 17 Q19 17 21 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <circle cx="17" cy="24" r="3" fill={color} />
            </svg>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .device-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: none !important;
          border: none !important;
        }
        .device-popup .mapboxgl-popup-tip {
          border-top-color: var(--bg-100) !important;
          border-width: 8px !important;
        }
        .device-popup .mapboxgl-popup-close-button {
          display: none !important;
        }
        .device-popup .mapboxgl-popup {
          background: transparent !important;
        }
        @keyframes aura-ping {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2); opacity: 0; }
        }
        .aura-ping {
          animation: aura-ping 2.5s ease-out infinite;
        }
      `}</style>

      {/* Tracking routes + marcador del punto más reciente */}
      {trackingRoutes.map(route => (
        <Fragment key={route.alertId}>
          <Source id={`tracking-${route.alertId}`} type="geojson" data={route.geojson}>
            <Layer
              id={`tracking-line-${route.alertId}`} type="line" source={`tracking-${route.alertId}`}
              paint={{ "line-color": "#ef4444", "line-width": 3, "line-opacity": 0.8, "line-blur": 0.5 }}
            />
            <Layer
              id={`tracking-glow-${route.alertId}`} type="line" source={`tracking-${route.alertId}`}
              paint={{ "line-color": "#ef4444", "line-width": 10, "line-opacity": 0.15, "line-blur": 4 }}
            />
          </Source>
          {/* Marcador de tracking - warning negro */}
          {route.lastPoint && (
            <Marker
              longitude={route.lastPoint.longitude}
              latitude={route.lastPoint.latitude}
              onClick={e => { e.originalEvent.stopPropagation(); setSelectedTrackingAlert(route.alertId); }}
            >
              <div className="relative flex items-center justify-center">
                {/* Ondas expansivas */}
                <span className="absolute w-10 h-10 rounded-full border-2 border-red-500/30"
                  style={{
                    animation: 'aura-ping 2s ease-out infinite',
                  }} />
                {/* Warning negro */}
                <svg width="32" height="32" viewBox="-16 -16 32 32" className="drop-shadow-xl">
                  {/* Círculo negro */}
                  <circle cx="0" cy="0" r="14" fill="#1a1a1a" />
                  {/* Triángulo de advertencia blanco */}
                  <path d="M0 -7.5 L6.5 5 L-6.5 5 Z" fill="white" />
                  {/* Signo de exclamación negro */}
                  <rect x="-1.3" y="-4.5" width="2.6" height="5.5" rx="0.9" fill="#1a1a1a" />
                  <circle cx="0" cy="3.5" r="1.6" fill="#1a1a1a" />
                </svg>
              </div>
            </Marker>
          )}
        </Fragment>
      ))}

      {/* Gateway coverage */}
      {gatewayCoverage.map(cov => (
        <Source key={cov.id} id={`gateway-aura-${cov.id}`} type="geojson" data={cov.geojson}>
          <Layer
            id={`gateway-aura-fill-${cov.id}`} type="fill" source={`gateway-aura-${cov.id}`}
            paint={{ "fill-color": cov.isOnline ? "#22c55e" : "#ef4444", "fill-opacity": 0.03 }}
          />
          <Layer
            id={`gateway-aura-border-${cov.id}`} type="line" source={`gateway-aura-${cov.id}`}
            paint={{ "line-color": cov.isOnline ? "#22c55e" : "#ef4444", "line-width": 1.5, "line-opacity": 0.2, "line-dasharray": [2, 4] }}
          />
        </Source>
      ))}

      {/* Toggle mostrar/ocultar sensores */}
      <div className="absolute top-20 left-2 z-20">
        <button
          onClick={onToggleShowAll}
          className="flex items-center gap-1.5 bg-bg-100/90 hover:bg-bg-100 border border-border/40 rounded-lg px-2.5 py-1.5 shadow-lg backdrop-blur-sm transition-all text-[11px] font-medium"
          title={showAllSensors ? "Ocultar sensores (solo gateways)" : "Mostrar todos los sensores"}
        >
          {showAllSensors ? <IconEyeOff size={14} className="text-text-300" /> : <IconEye size={14} className="text-text-300" />}
          <span className="text-text-200">{showAllSensors ? 'Ocultar sensores' : 'Mostrar sensores'}</span>
        </button>
      </div>

      {/* Sensores normales SIN alerta → capa GL (canvas). Mucho más rápido que <Marker> DOM */}
      {normalSensorsGeoJSON && normalSensorsGeoJSON.features.length > 0 && (
        <Source id="normal-sensors" type="geojson" data={normalSensorsGeoJSON}>
          <Layer
            id="normal-sensors-symbol"
            type="symbol"
            source="normal-sensors"
            layout={{
              "icon-image": "sensor-pin",
              "icon-size": 0.55,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "text-field": ["get", "letter"],
              "text-size": 8,
              "text-offset": [0, 0.6],
              "text-anchor": "top",
              "text-allow-overlap": true,
            }}
            paint={{
              "icon-color": ["get", "color"],
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,0.7)",
              "text-halo-width": 1,
            }}
          />
        </Source>
      )}

      {/* Device markers - con alerta no-crítica (siempre visibles) */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        const dAlert = alertsByDevice.get(device.id);
        const isAtencion = !!dAlert?.atencion;
        const isMovAnomalos = !!dAlert?.movimientos_anomalos;
        const isApertura = !!dAlert?.apertura;
        const isPresencia = !!dAlert?.presencia;
        const isCritical = !!dAlert?.critical;
        if (!isAtencion && !isMovAnomalos && !isApertura && !isPresencia) return null; // sin alerta → capa GL
        if (isCritical) return null; // Los críticos se renderizan al final

        return (
          <Marker
            key={device.id}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
          >
            {isMovAnomalos ? renderAlertIcon('movimientos_anomalos') : isApertura ? renderAlertIcon('apertura') : isPresencia ? renderAlertIcon('presencia') : renderAlertIcon('atencion')}
          </Marker>
        );
      })}

      {/* Device markers - críticos al final (siempre visibles si existen) */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        if (!alertsByDevice.get(device.id)?.critical) return null;

        return (
          <Marker
            key={`crit-${device.id}`}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
          >
            {renderAlertIcon('critical')}
          </Marker>
        );
      })}

      {/* Gateway markers + symbol layer para nombres */}
      {/* Fuente GeoJSON para nombres de gateways */}
      {(() => {
        const validGws = gateways.filter(gw => gw.latitude_current && gw.longitude_current);
        if (!validGws.length) return null;
        const geojson: any = {
          type: "FeatureCollection",
          features: validGws.map(gw => ({
            type: "Feature",
            properties: { name: gw.name, id: gw.id },
            geometry: { type: "Point", coordinates: [Number(gw.longitude_current), Number(gw.latitude_current)] },
          })),
        };
        return (
          <Source id="gateway-names-source" type="geojson" data={geojson}>
            <Layer
              id="gateway-names"
              type="symbol"
              source="gateway-names-source"
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 11,
                "text-offset": [1.8, 0],
                "text-anchor": "left",
                "text-optional": true,
              }}
              paint={{
                "text-color": "#22d3ee",
                "text-halo-color": "rgba(0,0,0,0.85)",
                "text-halo-width": 3,
              }}
            />
          </Source>
        );
      })()}

      {gateways.filter(gw => gw.latitude_current && gw.longitude_current).map(gw => (
        <Marker
          key={`gw-${gw.id}`}
          longitude={Number(gw.longitude_current)}
          latitude={Number(gw.latitude_current)}
          onClick={e => { e.originalEvent.stopPropagation(); setSelectedGateway(gw); }}
        >
          {renderGatewayIcon(gw.is_online, gw.id)}
        </Marker>
      ))}

      {/* Gateway popup */}
      {selectedGateway && (
        <Popup
          longitude={Number(selectedGateway.longitude_current)}
          latitude={Number(selectedGateway.latitude_current)}
          anchor="bottom"
          onClose={() => setSelectedGateway(null)}
          closeOnClick={false}
          className="device-popup"
          offset={15}
          maxWidth="280px"
        >
          <div className="bg-bg-100 border border-border/50 rounded-lg shadow-xl p-3 min-w-48 relative">
            <button onClick={() => setSelectedGateway(null)}
              className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-bg-300 border border-border/50 text-text-300 hover:text-text-100 shadow-md outline-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/30">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedGateway.is_online ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'}`} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-100 truncate">{selectedGateway.name}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-text-300">Estado:</span><span className={`font-medium ${selectedGateway.is_online ? 'text-green-400' : 'text-red-400'}`}>{selectedGateway.is_online ? 'Online' : 'Offline'}</span></div>
              {selectedGateway.ip_internal && <div className="flex justify-between"><span className="text-text-300">IP:</span><span className="text-text-100 font-medium font-mono text-[10px]">{selectedGateway.ip_internal}</span></div>}
              {selectedGateway.firmware_version && <div className="flex justify-between"><span className="text-text-300">Firmware:</span><span className="text-text-100 font-medium">{selectedGateway.firmware_version}</span></div>}
              <div className="flex justify-between"><span className="text-text-300">Último reporte:</span><span className="text-text-100 font-medium">{selectedGateway.last_seen ? new Date(selectedGateway.last_seen).toLocaleString() : 'N/A'}</span></div>
            </div>
          </div>
        </Popup>
      )}

      {/* Device popup */}
      {selectedDevice && (
        <Popup
          longitude={Number(selectedDevice.longitude_current)}
          latitude={Number(selectedDevice.latitude_current)}
          anchor="bottom"
          onClose={() => setSelectedDevice(null)}
          closeOnClick={false}
          className="device-popup"
          offset={15}
          maxWidth="320px"
        >
          <DevicePopup device={selectedDevice} alerts={data?.alerts} onClose={() => setSelectedDevice(null)} />
        </Popup>
      )}

      {/* Tracking alert popup */}
      {selectedTrackingAlert && (() => {
        const alert = data?.alerts?.critical?.find(a => a.id === selectedTrackingAlert);
        if (!alert) return null;
        return (
          <Popup
            longitude={alert.tracking_data?.[0]?.longitude ?? 0}
            latitude={alert.tracking_data?.[0]?.latitude ?? 0}
            anchor="bottom"
            onClose={() => setSelectedTrackingAlert(null)}
            closeOnClick={false}
            className="device-popup"
            offset={20}
            maxWidth="280px"
          >
            <div className="bg-bg-100 border border-red-500/30 rounded-lg shadow-xl p-3 min-w-48 relative">
              <button onClick={() => setSelectedTrackingAlert(null)}
                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-bg-300 border border-border/50 text-text-300 hover:text-text-100 shadow-md outline-none">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-red-500/20">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="7" x2="12" y2="15"/><circle cx="12" cy="19" r="1.5" fill="white"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-100 truncate">{alert.device_name}</p>
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Alerta Crítica</p>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-text-300">Inicio:</span>
                  <span className="text-text-100 font-medium">{new Date(alert.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-300">Puntos tracking:</span>
                  <span className="text-text-100 font-medium">{alert.tracking_data?.length ?? 0}</span>
                </div>
                {alert.metadata?.reason && (
                  <div className="pt-1 border-t border-border/20 mt-1">
                    <span className="text-text-300">Motivo:</span>
                    <p className="text-text-100 mt-0.5">{alert.metadata.reason}</p>
                  </div>
                )}
              </div>
            </div>
          </Popup>
        );
      })()}
    </>
  );
}