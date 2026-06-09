import { useState, useMemo, Fragment } from "react";
import { Marker, Source, Layer, Popup } from "react-map-gl";
import type { DashboardData, GatewayDevice, GpsDevice } from "../types/dashboard.types";
import DevicePopup from "./DevicePopup";

interface Props {
  data?: DashboardData;
  gateways: GatewayDevice[];
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

export default function MapLayers({ data, gateways }: Props) {
  const [selectedDevice, setSelectedDevice] = useState<GpsDevice | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<GatewayDevice | null>(null);
  const [selectedTrackingAlert, setSelectedTrackingAlert] = useState<number | null>(null);

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
  const renderAlertIcon = (type: 'critical' | 'atencion') => {
    const isCrit = type === 'critical';
    const color = isCrit ? '#ef4444' : '#eab308';
    const borderColor = isCrit ? '#b91c1c' : '#a16207';
    const size = isCrit ? 48 : 36;
    const glowColor = isCrit ? '#ef4444' : '#eab308';

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
                {/* Romboide rojo */}
                <polygon points="0,-20 20,0 0,20 -20,0" fill={color} stroke={borderColor} strokeWidth="2" strokeLinejoin="round" />
                {/* Brillo interior */}
                <polygon points="0,-15 14,0 0,15 -14,0" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
                {/* Signo de exclamación */}
                <rect x="-3" y="-10" width="6" height="13" rx="2" fill="white" />
                <circle cx="0" cy="9" r="4" fill="white" />
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

  const renderDeviceIcon = (tc: { fill: string; stroke: string; glow: string }, name: string) => {
    return (
      <div className="relative flex items-center justify-center cursor-pointer group">
        <span className="absolute w-12 h-12 rounded-full aura-ping"
          style={{
            backgroundColor: tc.fill,
            opacity: 0.2,
            boxShadow: `0 0 12px 4px ${tc.fill}44`,
          }} />
        <div className="relative transition-all duration-200 group-hover:scale-125 hover:-translate-y-1">
          <svg width="28" height="36" viewBox="0 0 28 36" className="drop-shadow-md">
            <defs>
              <linearGradient id={`pin-${tc.fill.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={tc.stroke} />
                <stop offset="100%" stopColor={tc.fill} />
              </linearGradient>
            </defs>
            {/* Pin Google Maps style */}
            <path d="M14 1C6.8 1 1 6.8 1 14c0 9.5 13 19.5 13 19.5S27 23.5 27 14C27 6.8 21.2 1 14 1z"
              fill={`url(#pin-${tc.fill.slice(1)})`} stroke={tc.fill} strokeWidth="1.3" />
            {/* Círculo interior blanco */}
            <circle cx="14" cy="13" r="6" fill="white" />
            {/* Letra inicial del tipo */}
            <text x="14" y="16" textAnchor="middle" fill={tc.fill} fontSize="8" fontWeight="800" fontFamily="sans-serif">
              {name === 'SubEstacion' ? 'S' : name[0]}
            </text>
          </svg>
        </div>
      </div>
    );
  };

  const renderGatewayIcon = (isOnline: boolean) => {
    const color = isOnline ? '#22c55e' : '#ef4444';

    return (
      <div className="relative flex items-center justify-center group cursor-default">
        <span className="absolute w-14 h-14 rounded-full"
          style={{
            animation: 'aura-ping 3s ease-out infinite',
            backgroundColor: color,
            opacity: 0.15,
            boxShadow: `0 0 14px 5px ${color}44`,
          }} />
        <div className="relative drop-shadow-xl transition-transform group-hover:scale-125">
          <svg width="34" height="34" viewBox="0 0 34 34">
            <defs>
              <linearGradient id={`gw-${isOnline ? 'on' : 'off'}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={color} stopOpacity="0.5" />
              </linearGradient>
            </defs>
            {/* Icono WiFi - 3 arcos + punto */}
            <path d="M7 12 Q11 7 17 7 Q23 7 27 12" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
            <path d="M10 16 Q13 12 17 12 Q21 12 24 16" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M13 20 Q15 17 17 17 Q19 17 21 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="17" cy="24" r="3" fill={color} />
          </svg>
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

      {/* Device markers - normales primero */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        const isCritical = data.alerts?.critical?.some(a => a.device_id === device.id);
        const isAtencion = data.alerts?.atencion?.some(a => a.device_id === device.id);
        if (isCritical) return null; // Los críticos se renderizan al final

        // Color del pin por tipo de dispositivo
        const typeColors: Record<string, { fill: string; stroke: string; glow: string }> = {
          Gps:         { fill: '#3b82f6', stroke: '#60a5fa', glow: 'bg-blue-500' },
          Gateway:     { fill: '#10b981', stroke: '#34d399', glow: 'bg-emerald-500' },
          SubEstacion: { fill: '#8b5cf6', stroke: '#a78bfa', glow: 'bg-violet-500' },
          Lector:      { fill: '#f97316', stroke: '#fb923c', glow: 'bg-orange-500' },
        };
        const tc = typeColors[device.type_device] || typeColors.Gps;

        // Color del aura por SNR
        const getAuraColor = () => {
          if (device.best_snr == null) return '#3b82f6';
          if (device.best_snr > -115) return '#22c55e';
          if (device.best_snr >= -120) return '#f97316';
          return '#ef4444';
        };
        const auraColor = getAuraColor();

        return (
          <Marker
            key={device.id}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
          >
            {isAtencion ? renderAlertIcon('atencion') : (
              <div className="relative flex items-center justify-center cursor-pointer group">
                <span className="absolute w-7 h-7 rounded-full aura-ping"
                  style={{
                    backgroundColor: auraColor,
                    opacity: 0.2,
                    boxShadow: `0 0 10px 3px ${auraColor}44`,
                  }} />
                <div className="relative transition-all duration-200 group-hover:scale-125 hover:-translate-y-1">
                  <svg width="24" height="30" viewBox="0 0 28 36" className="drop-shadow-md">
                    <defs>
                      <linearGradient id={`pin-${tc.fill.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={tc.stroke} />
                        <stop offset="100%" stopColor={tc.fill} />
                      </linearGradient>
                    </defs>
                    <path d="M14 1C6.8 1 1 6.8 1 14c0 9.5 13 19.5 13 19.5S27 23.5 27 14C27 6.8 21.2 1 14 1z"
                      fill={`url(#pin-${tc.fill.slice(1)})`} stroke={tc.fill} strokeWidth="1.3" />
                    <circle cx="14" cy="13" r="6" fill="white" />
                    <text x="14" y="16" textAnchor="middle" fill={tc.fill} fontSize="8" fontWeight="800" fontFamily="sans-serif">
                      {device.type_device === 'SubEstacion' ? 'S' : device.type_device[0]}
                    </text>
                  </svg>
                </div>
              </div>
            )}
          </Marker>
        );
      })}

      {/* Device markers - críticos al final (SIEMPRE encima) */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        const isCritical = data.alerts?.critical?.some(a => a.device_id === device.id);
        if (!isCritical) return null;

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

      {/* Gateway markers */}
      {gateways.filter(gw => gw.latitude_current && gw.longitude_current).map(gw => (
        <Marker
          key={`gw-${gw.id}`}
          longitude={Number(gw.longitude_current)}
          latitude={Number(gw.latitude_current)}
          onClick={e => { e.originalEvent.stopPropagation(); setSelectedGateway(gw); }}
        >
          <div className="relative">
            {renderGatewayIcon(gw.is_online)}
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 text-[10px] font-semibold text-white drop-shadow-lg bg-black/50 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
              {gw.name}
            </span>
          </div>
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
                <p className="text-[10px] text-text-300 font-mono truncate">{selectedGateway.dev_eui}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-text-300">Estado:</span><span className={`font-medium ${selectedGateway.is_online ? 'text-green-400' : 'text-red-400'}`}>{selectedGateway.is_online ? 'Online' : 'Offline'}</span></div>
              <div className="flex justify-between"><span className="text-text-300">Empresa:</span><span className="text-text-100 font-medium">{selectedGateway.company_name}</span></div>
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