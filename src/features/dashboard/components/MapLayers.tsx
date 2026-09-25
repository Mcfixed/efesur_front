import { useState, useMemo, Fragment, useEffect, memo } from "react";
import { Marker, Source, Layer, Popup, useMap } from "react-map-gl";
import type { DashboardData, GatewayDevice, GpsDevice, MapFocusRequest } from "../types/dashboard.types";
import DevicePopup from "./DevicePopup";
import GatewayLectorInfo from "./GatewayLectorInfo";
import MapSearchBox, { type SearchItem } from "./MapSearchBox";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import roboIcon from "@/assets/iconsdashboard/robo.png";

interface Props {
  data?: DashboardData;
  gateways: GatewayDevice[];
  showAllSensors?: boolean;
  onToggleShowAll?: () => void;
  mapZoom?: number;
  focusRequest?: MapFocusRequest | null;
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

const SEARCH_ZOOM = 20;

// ─── COLORES Y CONFIGURACIÓN PARA LOS PINES WEBGL ───
const TYPE_COLORS: Record<string, { fill: string; stroke: string; letter: string }> = {
  Gps:         { fill: '#3b82f6', stroke: '#60a5fa', letter: 'G' },
  Gateway:     { fill: '#10b981', stroke: '#34d399', letter: 'G' },
  SubEstacion: { fill: '#8b5cf6', stroke: '#a78bfa', letter: 'S' },
  Lector:      { fill: '#f97316', stroke: '#fb923c', letter: 'L' },
};

const getAuraColor = (snr?: number | null) => {
  if (snr == null) return '#3b82f6';
  if (snr > -115) return '#22c55e';
  if (snr >= -120) return '#f97316';
  return '#ef4444';
};

function MapLayers({ data, gateways, showAllSensors, onToggleShowAll, mapZoom = 0, focusRequest }: Props) {
  const { current: map } = useMap();
  const showSensors = showAllSensors || mapZoom >= ZOOM_THRESHOLD;
  const [selectedDevice, setSelectedDevice] = useState<GpsDevice | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<GatewayDevice | null>(null);
  const [selectedTrackingAlert, setSelectedTrackingAlert] = useState<number | null>(null);

  // Foco pedido desde el panel de alertas: vuela al sitio y abre el popup correspondiente
  const focusNonce = focusRequest?.nonce ?? 0;
  useEffect(() => {
    if (!focusRequest) return;

    const flyTo = (lng: number, lat: number) => {
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        map?.flyTo({ center: [lng, lat], zoom: SEARCH_ZOOM, duration: 1600 });
      }
    };
    const select = (gw: GatewayDevice | null, dev: GpsDevice | null) => {
      setSelectedTrackingAlert(null);
      setSelectedGateway(gw);
      setSelectedDevice(dev);
    };

    // Alerta de lector: el pin vive en su gateway
    const gw = focusRequest.gatewayId != null ? gateways.find(g => g.id === focusRequest.gatewayId) : undefined;
    if (gw) { select(gw, null); flyTo(Number(gw.longitude_current), Number(gw.latitude_current)); return; }

    // Alerta de un GPS/sensor dibujado en el mapa
    const dev = focusRequest.deviceId != null ? data?.devices?.find(d => d.id === focusRequest.deviceId) : undefined;
    if (dev) { select(null, dev); flyTo(Number(dev.longitude_current), Number(dev.latitude_current)); return; }

    // Alerta de un gateway (sin lector asignado)
    const gwById = focusRequest.deviceId != null ? gateways.find(g => g.id === focusRequest.deviceId) : undefined;
    if (gwById) { select(gwById, null); flyTo(Number(gwById.longitude_current), Number(gwById.latitude_current)); return; }

    // Sin dispositivo en el mapa: al menos se acerca a las coordenadas de la alerta
    if (focusRequest.lng != null && focusRequest.lat != null) flyTo(focusRequest.lng, focusRequest.lat);
  // Solo debe dispararse con el botón del panel, no con cada refresco de datos (10 s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // ─── BUSCADOR ───
  // Hace lo mismo que el clic en el mapa: abre el popup y acerca la vista.
  const handleSearchSelect = (item: SearchItem) => {
    const numericId = Number(item.id.replace(/^(dev|gw)-/, ''));
    if (!Number.isFinite(numericId)) return;

    if (item.type === 'device') {
      const device = data?.devices?.find(d => d.id === numericId);
      if (!device) return;
      setSelectedGateway(null);
      setSelectedTrackingAlert(null);
      setSelectedDevice(device);
    } else {
      const gw = gateways.find(g => g.id === numericId);
      if (!gw) return;
      setSelectedDevice(null);
      setSelectedTrackingAlert(null);
      setSelectedGateway(gw);
    }

    map?.flyTo({ center: [item.lng, item.lat], zoom: SEARCH_ZOOM, duration: 1600 });
  };

  // ─── PINES SVG EN MAPBOX (WEBGL) ───
  useEffect(() => {
    if (!map) return;

    Object.entries(TYPE_COLORS).forEach(([type, colors]) => {
      const imageId = `pin-${type}`;
      if (map.hasImage(imageId)) return;

      const svgString = `
        <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-${type}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${colors.stroke}" />
              <stop offset="100%" stop-color="${colors.fill}" />
            </linearGradient>
          </defs>
          <path d="M14 1C6.8 1 1 6.8 1 14c0 9.5 13 19.5 13 19.5S27 23.5 27 14C27 6.8 21.2 1 14 1z" fill="url(#grad-${type})" stroke="${colors.fill}" stroke-width="1.3" />
          <circle cx="14" cy="13" r="6" fill="white" />
          <text x="14" y="16.5" text-anchor="middle" fill="${colors.fill}" font-size="8" font-weight="800" font-family="sans-serif">${colors.letter}</text>
        </svg>
      `;

      const img = new Image(28, 36);
      img.onload = () => {
        if (!map.hasImage(imageId)) {
          map.addImage(imageId, img);
        }
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    });
  }, [map]);

  // ─── PRE-INDEXADO DE ALERTAS ───
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

  // Tracking routes
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
        lastPoint: alert.tracking_data![0],
      }));
  }, [data?.alerts?.critical]);

  const gatewayCoverageGeoJSON = useMemo(() => {
    const validGws = gateways.filter(gw => gw.latitude_current && gw.longitude_current);
    return {
      type: "FeatureCollection" as const,
      features: validGws.map(gw => ({
        type: "Feature" as const,
        properties: { id: gw.id, is_online: gw.is_online },
        geometry: createCircleGeoJSON(Number(gw.longitude_current), Number(gw.latitude_current), 5),
      }))
    };
  }, [gateways]);

  // ─── FUENTE DE DATOS PARA SENSORES NORMALES (WEBGL) ───
  const normalDevicesGeoJSON = useMemo(() => {
    const features: any[] = [];
    
    if (!showSensors) return { type: "FeatureCollection", features };

    (data?.devices || []).forEach(device => {
      if (!device.latitude_current || !device.longitude_current) return;
      
      const dAlert = alertsByDevice.get(device.id);
      const hasAnyAlert = !!dAlert?.critical || !!dAlert?.atencion || 
                          !!dAlert?.movimientos_anomalos || !!dAlert?.apertura || 
                          !!dAlert?.presencia;

      if (hasAnyAlert) return; // Se dibuja como <Marker> HTML más abajo

      const auraColor = getAuraColor(device.best_snr);
      const iconId = `pin-${device.type_device || 'Gps'}`;

      features.push({
        type: "Feature",
        geometry: { 
          type: "Point", 
          coordinates: [Number(device.longitude_current), Number(device.latitude_current)] 
        },
        properties: {
          deviceId: device.id,
          iconId: iconId,
          auraColor: auraColor,
        }
      });
    });

    return { type: "FeatureCollection", features };
  }, [data?.devices, alertsByDevice, showSensors]);

  // ─── INTERACTIVIDAD CLICS (WEBGL) ───
  useEffect(() => {
    if (!map) return;

    const onLayerClick = (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const deviceId = e.features[0].properties?.deviceId;
      
      const device = data?.devices?.find(d => d.id === deviceId);
      if (device) {
        e.originalEvent.stopPropagation(); 
        setSelectedDevice(device);
      }
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', 'normal-devices-icon', onLayerClick);
    map.on('mouseenter', 'normal-devices-icon', onMouseEnter);
    map.on('mouseleave', 'normal-devices-icon', onMouseLeave);

    return () => {
      map.off('click', 'normal-devices-icon', onLayerClick);
      map.off('mouseenter', 'normal-devices-icon', onMouseEnter);
      map.off('mouseleave', 'normal-devices-icon', onMouseLeave);
    };
  }, [map, data?.devices]);

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
        }}
      />
      <div className="relative transition-transform group-hover:scale-125">
        <svg width={size} height={size} viewBox="-24 -24 48 48">
          {isCrit ? (
            // CRITICAL (Rombo rojo)
            <>
              <polygon points="0,-20 20,0 0,20 -20,0" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
              <polygon points="0,-15 14,0 0,15 -14,0" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
              <rect x="-3" y="-10" width="6" height="13" rx="2" fill="white" />
              <circle cx="0" cy="9" r="4" fill="white" />
            </>
          ) : isRed ? (
            // APERTURA / PRESENCIA (Rombo rojo con icono)
            <>
              <polygon points="0,-18 18,0 0,18 -18,0" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
              <polygon points="0,-13 12,0 0,13 -12,0" fill="none" stroke="white" strokeWidth="0.8" opacity="0.2" />
              {type === 'apertura' ? (
                // Icono de puerta abierta
                <>
                  <rect x="-5" y="-6" width="10" height="12" rx="1" fill="none" stroke="white" strokeWidth="1.8" />
                  <line x1="5" y1="-6" x2="5" y2="6" stroke="white" strokeWidth="1.8" />
                  <circle cx="2" cy="0" r="1" fill="white" />
                </>
              ) : (
                // Icono de presencia (silueta de persona)
                <>
                  <circle cx="0" cy="-5" r="4" fill="none" stroke="white" strokeWidth="1.8" />
                  <path d="M-6 6 Q0 -1 6 6" fill="none" stroke="white" strokeWidth="1.8" />
                </>
              )}
            </>
          ) : isMov ? (
            // MOVIMIENTOS ANÓMALOS (Hexágono morado)
          <>
            <polygon points="0,-18 15.5,-9 15.5,9 0,18 -15.5,9 -15.5,-9" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
            <polygon points="0,-13 11,-6.5 11,6.5 0,13 -11,6.5 -11,-6.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
            <path d="M-4,-5 C-4,-9 4,-9 4,-5 C4,-2 0,-1 0,2" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="0" cy="6" r="2" fill="white" />
          </>
          ) : (
            // ATENCIÓN (Triángulo amarillo clásico)
           <>
            <polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
            <polygon points="0,-15 12,-7 12,7 0,15 -12,7 -12,-7" fill="none" stroke="white" strokeWidth="1" opacity="0.25" />
            <rect x="-3" y="-9" width="6" height="11" rx="1.5" fill="white" />
            <circle cx="0" cy="9" r="2.5" fill="white" />
          </>
          )}
        </svg>
      </div>
    </div>
  );
};

  // ─── PRIORIDAD VISUAL DE ALERTAS SOBRE UN GATEWAY ───
  // Con varias alertas a la vez se muestra solo la de mayor jerarquía
  // (apertura > presencia > CA 220 > batería GW).
  const GW_ALERT_PRIORITY = ['apertura', 'presencia', 'desconexion220', 'desconexionbatGW'] as const;
  type GwAlertKey = typeof GW_ALERT_PRIORITY[number];

  const gatewayAlertMap = useMemo(() => {
    const map = new Map<number, Record<GwAlertKey, boolean>>();

    const gwById = new Map(gateways.map(gw => [gw.id, gw]));
    const gwByName = new Map(gateways.map(gw => [String(gw.name || '').toLowerCase(), gw]));

    const resolveGw = (a: any): { id: number; gw?: any } | null => {
      // 1) gateway_id explícito (backend lo deriva para alertas sobre el lector)
      if (a.gateway_id != null && gwById.has(a.gateway_id)) return { id: a.gateway_id, gw: gwById.get(a.gateway_id) };
      // 2) el propio alert apunta al gateway (device_id = gateway)
      if (a.device_id != null && gwById.has(a.device_id)) return { id: a.device_id, gw: gwById.get(a.device_id) };
      // 3) por nombre del dispositivo
      if (a.device_name) {
        const gw = gwByName.get(String(a.device_name).toLowerCase());
        if (gw) return { id: gw.id, gw };
      }
      return null;
    };

    const mark = (a: any, key: GwAlertKey) => {
      const hit = resolveGw(a);
      if (!hit) return;
      const entry = map.get(hit.id) || { apertura: false, presencia: false, desconexion220: false, desconexionbatGW: false };
      entry[key] = true;
      map.set(hit.id, entry);
    };

    // El wifi del gateway comunica SU conectividad; el badge rojo, un EVENTO del sitio
    // (apertura, presencia, CA 220 o batería GW). Son dos hechos distintos: el badge sigue
    // rojo mientras la alerta esté 'active', aunque el gateway vuelva (wifi verde).
    const isLive = (a: any) => a.status === 'active';
    (data?.alerts?.apertura || []).forEach(a => { if (isLive(a)) mark(a, 'apertura'); });
    (data?.alerts?.presencia || []).forEach(a => { if (isLive(a)) mark(a, 'presencia'); });
    (data?.alerts?.desconexion220 || []).forEach(a => { if (isLive(a)) mark(a, 'desconexion220'); });
    (data?.alerts?.desconexionbatGW || []).forEach(a => { if (isLive(a)) mark(a, 'desconexionbatGW'); });
    return map;
  }, [data?.alerts?.apertura, data?.alerts?.presencia, data?.alerts?.desconexion220, data?.alerts?.desconexionbatGW, gateways]);

  const renderGatewayIcon = (isOnline: boolean, gatewayId?: number) => {
    const gwAlert = gatewayId ? gatewayAlertMap.get(gatewayId) : undefined;
    const topAlert = gwAlert ? GW_ALERT_PRIORITY.find(k => gwAlert[k]) : undefined;
    // Wifi = conectividad real; el badge de alerta es un evento del sitio.
    const connColor = isOnline ? '#22c55e' : '#ef4444';

    return (
      <div className="relative flex items-center justify-center group cursor-default">
        <span className="absolute marker-pulse-gw"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: `2px solid ${connColor}`,
            top: '50%',
            left: '50%',
          }} />
        <div className="relative transition-transform group-hover:scale-125">
          <svg width="34" height="34" viewBox="0 0 34 34">
            <path d="M7 12 Q11 7 17 7 Q23 7 27 12" fill="none" stroke={connColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M10 16 Q13 12 17 12 Q21 12 24 16" fill="none" stroke={connColor} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M13 20 Q15 17 17 17 Q19 17 21 20" fill="none" stroke={connColor} strokeWidth="2" strokeLinecap="round" />
            <circle cx="17" cy="24" r="3" fill={connColor} />
          </svg>
          {/* Badge de alerta (evento del sitio, no que el gateway esté caído) */}
          {topAlert && (
            <span
              title={`${topAlert === 'apertura' ? 'Apertura' : topAlert === 'presencia' ? 'Presencia' : topAlert === 'desconexion220' ? 'CA 220 Off' : 'Batería GW Off'} (alerta del lector) · Gateway ${isOnline ? 'online' : 'offline'}`}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-bg-100 shadow-[0_0_6px_rgba(239,68,68,0.7)] flex items-center justify-center animate-pulse"
            >
              {topAlert === 'apertura' && (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="white" strokeWidth="1.3" />
                  <line x1="5.5" y1="1.5" x2="5.5" y2="10.5" stroke="white" strokeWidth="1.3" />
                  <circle cx="3.3" cy="6" r="0.9" fill="white" />
                </svg>
              )}
              {topAlert === 'presencia' && (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <circle cx="6" cy="4.2" r="1.9" fill="none" stroke="white" strokeWidth="1.3" />
                  <path d="M2.2 10.4 Q6 6.4 9.8 10.4" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              )}
              {topAlert === 'desconexion220' && (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="2.5" y="4.2" width="7" height="5" rx="1" fill="none" stroke="white" strokeWidth="1.3" />
                  <line x1="4.5" y1="4.2" x2="4.5" y2="2.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="7.5" y1="4.2" x2="7.5" y2="2.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              )}
              {topAlert === 'desconexionbatGW' && (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="1.5" y="3" width="8" height="6" rx="1" fill="none" stroke="white" strokeWidth="1.3" />
                  <line x1="9.5" y1="5" x2="10.8" y2="5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="9.5" y1="7" x2="10.8" y2="7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <rect x="3" y="4.5" width="2.4" height="3" fill="white" />
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>

      {/* Tracking routes + marcador */}
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
          {route.lastPoint && (
            <Marker
              longitude={route.lastPoint.longitude}
              latitude={route.lastPoint.latitude}
              onClick={e => { e.originalEvent.stopPropagation(); setSelectedTrackingAlert(route.alertId); }}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute w-10 h-10 rounded-full border-2 border-red-500/30"
                  style={{ animation: 'aura-ping 3.5s ease-out infinite' }} />
                <img src={roboIcon} alt="Robo" width={34} height={34}
                  className="relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              </div>
            </Marker>
          )}
        </Fragment>
      ))}

      {/* Gateway coverage */}
      <Source id="gateway-auras" type="geojson" data={gatewayCoverageGeoJSON as any}>
        <Layer
          id="gateway-aura-fill"
          type="fill"
          paint={{
            "fill-color": ["case", ["==", ["get", "is_online"], true], "#22c55e", "#ef4444"],
            "fill-opacity": 0.03
          }}
        />
        <Layer
          id="gateway-aura-border"
          type="line"
          paint={{
            "line-color": ["case", ["==", ["get", "is_online"], true], "#22c55e", "#ef4444"],
            "line-width": 1.5,
            "line-opacity": 0.2,
            "line-dasharray": [2, 4]
          }}
        />
      </Source>

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

      {/* ─── RENDERIZADO WEBGL PARA SENSORES NORMALES ─── */}
      <Source id="normal-devices-source" type="geojson" data={normalDevicesGeoJSON as any}>
        {/* Aura de SNR */}
        <Layer
          id="normal-devices-aura"
          type="circle"
          paint={{
            "circle-color": "transparent",
            "circle-radius": 4,
            "circle-stroke-width": 2,
            "circle-stroke-color": ["get", "auraColor"],
            "circle-stroke-opacity": 0.8
          }}
        />
        {/* Pin SVG */}
        <Layer
          id="normal-devices-icon"
          type="symbol"
          layout={{
            "icon-image": ["get", "iconId"],
            "icon-allow-overlap": true,
            "icon-size": 0.60,
            // La imagen es una lágrima: compensa la posición
            "icon-offset": [0, -10]
          }}
        />
      </Source>

      {/* ─── RENDERIZADO DOM (MARKERS) SOLO PARA ALERTAS ─── */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        const dAlert = alertsByDevice.get(device.id);
        
        const isCritical = !!dAlert?.critical;
        const isAtencion = !!dAlert?.atencion;
        const isMovAnomalos = !!dAlert?.movimientos_anomalos;
        const isApertura = !!dAlert?.apertura;
        const isPresencia = !!dAlert?.presencia;
        
        const hasAnyAlert = isCritical || isAtencion || isMovAnomalos || isApertura || isPresencia;
        
        // Si no tiene alerta, lo ignora porque ya lo dibujó WebGL
        if (!hasAnyAlert) return null; 
        if (isCritical) return null; // Los críticos se renderizan al final para z-index

        return (
          <Marker
            key={`alert-${device.id}`}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
          >
            {isMovAnomalos ? renderAlertIcon('movimientos_anomalos') : isApertura ? renderAlertIcon('apertura') : isPresencia ? renderAlertIcon('presencia') : renderAlertIcon('atencion')}
          </Marker>
        );
      })}

      {/* Críticos al final */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        if (!alertsByDevice.get(device.id)?.critical) return null;

        return (
          <Marker
            key={`crit-${device.id}`}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
            style={{ zIndex: 50 }}
          >
            {renderAlertIcon('critical')}
          </Marker>
        );
      })}

      {/* Gateway markers + Nombres */}
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

      {/* Buscador */}
      <MapSearchBox data={data} gateways={gateways} onSelect={handleSearchSelect} />

      {/* Popups */}
      {selectedGateway && (
        <Popup longitude={Number(selectedGateway.longitude_current)} latitude={Number(selectedGateway.latitude_current)} anchor="bottom" onClose={() => setSelectedGateway(null)} closeOnClick={false} className="device-popup" offset={15} maxWidth="280px">
          <div className="bg-bg-100 border border-border/50 rounded-lg shadow-xl p-3 min-w-48 relative">
            <button onClick={() => setSelectedGateway(null)} className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-bg-300 border border-border/50 text-text-300 hover:text-text-100 shadow-md outline-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-300 mb-1">Gateway</p>
            <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/30">
              <span className={`w-2 h-2 rounded-full shrink-0 ${selectedGateway.is_online ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-[13px] font-bold text-text-100 truncate min-w-0">{selectedGateway.name}</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-text-300">Estado:</span><span className={`font-medium ${selectedGateway.is_online ? 'text-green-400' : 'text-red-400'}`}>{selectedGateway.is_online ? 'Online' : 'Offline'}</span></div>
              {selectedGateway.ip_internal && <div className="flex justify-between"><span className="text-text-300">IP:</span><span className="text-text-100 font-medium font-mono text-[10px]">{selectedGateway.ip_internal}</span></div>}
              {selectedGateway.firmware_version && <div className="flex justify-between"><span className="text-text-300">Firmware:</span><span className="text-text-100 font-medium">{selectedGateway.firmware_version}</span></div>}
              <div className="flex justify-between"><span className="text-text-300">Último reporte:</span><span className="text-text-100 font-medium">{selectedGateway.last_seen ? new Date(selectedGateway.last_seen).toLocaleString() : 'N/A'}</span></div>
            </div>

            <GatewayLectorInfo gatewayId={selectedGateway.id} />
          </div>
        </Popup>
      )}

      {selectedDevice && (
        <Popup longitude={Number(selectedDevice.longitude_current)} latitude={Number(selectedDevice.latitude_current)} anchor="bottom" onClose={() => setSelectedDevice(null)} closeOnClick={false} className="device-popup" offset={15} maxWidth="320px">
          <DevicePopup device={selectedDevice} alerts={data?.alerts} onClose={() => setSelectedDevice(null)} />
        </Popup>
      )}
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

export default memo(MapLayers);