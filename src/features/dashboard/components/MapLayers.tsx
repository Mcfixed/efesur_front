import { useState, useMemo } from "react";
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

  return (
    <>
      <style>{`
        .device-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 8px !important;
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
      `}</style>
      {/* Tracking routes */}
      {trackingRoutes.map(route => (
        <Source key={route.alertId} id={`tracking-${route.alertId}`} type="geojson" data={route.geojson}>
          <Layer
            id={`tracking-line-${route.alertId}`} type="line" source={`tracking-${route.alertId}`}
            paint={{ "line-color": "#ef4444", "line-width": 3, "line-opacity": 0.7, "line-blur": 1 }}
          />
          <Layer
            id={`tracking-glow-${route.alertId}`} type="line" source={`tracking-${route.alertId}`}
            paint={{ "line-color": "#ef4444", "line-width": 8, "line-opacity": 0.15, "line-blur": 4 }}
          />
        </Source>
      ))}

      {/* Gateway coverage */}
      {gatewayCoverage.map(cov => (
        <Source key={cov.id} id={`gateway-aura-${cov.id}`} type="geojson" data={cov.geojson}>
          <Layer
            id={`gateway-aura-fill-${cov.id}`} type="fill" source={`gateway-aura-${cov.id}`}
            paint={{ "fill-color": cov.isOnline ? "#22c55e" : "#ef4444", "fill-opacity": 0.04 }}
          />
          <Layer
            id={`gateway-aura-border-${cov.id}`} type="line" source={`gateway-aura-${cov.id}`}
            paint={{ "line-color": cov.isOnline ? "#22c55e" : "#ef4444", "line-width": 1.5, "line-opacity": 0.15, "line-dasharray": [2, 4] }}
          />
        </Source>
      ))}

      {/* Device markers */}
      {data?.devices?.map(device => {
        if (!device.latitude_current || !device.longitude_current) return null;
        const isCritical = data.alerts?.critical?.some(a => a.device_id === device.id);
        const isAtencion = data.alerts?.atencion?.some(a => a.device_id === device.id);

        return (
          <Marker
            key={device.id}
            longitude={Number(device.longitude_current)}
            latitude={Number(device.latitude_current)}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedDevice(device); }}
          >
            {isCritical ? (
              <div className="relative flex items-center justify-center cursor-pointer group">
                <span className="absolute w-10 h-10 rounded-full bg-red-500/20 animate-ping" />
                <svg width="22" height="30" viewBox="0 0 22 30" className="drop-shadow-lg">
                  <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.925 17.075 0 11 0z" fill="#ef4444" stroke="#dc2626" strokeWidth="1.5" />
                  <circle cx="11" cy="10" r="4" fill="white" />
                </svg>
              </div>
            ) : isAtencion ? (
              <div className="relative flex items-center justify-center cursor-pointer group">
                <span className="absolute w-9 h-9 rounded-full bg-yellow-400/20 animate-ping" />
                <svg width="20" height="27" viewBox="0 0 20 27" className="drop-shadow-lg">
                  <path d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 17 10 17s10-9.5 10-17C20 4.477 15.523 0 10 0z" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
                  <circle cx="10" cy="9" r="3.5" fill="white" />
                </svg>
              </div>
            ) : (
              <div className="relative flex items-center justify-center cursor-pointer group">
                <svg width="18" height="24" viewBox="0 0 18 24" className="drop-shadow-lg transition-transform group-hover:scale-110">
                  <path d="M9 0C4.03 0 0 4.03 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4.03 13.97 0 9 0z" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1.5" />
                  <circle cx="9" cy="8" r="3" fill="white" />
                </svg>
              </div>
            )}
          </Marker>
        );
      })}

      {/* Gateway markers */}
      {gateways.filter(gw => gw.latitude_current && gw.longitude_current).map(gw => (
        <Marker
          key={`gw-${gw.id}`}
          longitude={Number(gw.longitude_current)}
          latitude={Number(gw.latitude_current)}
        >
          <div className="relative flex items-center justify-center group cursor-default">
            <span className={`absolute w-14 h-14 rounded-full animate-ping ${gw.is_online ? 'bg-green-500/15' : 'bg-red-500/15'}`} />
            <span className={`absolute w-10 h-10 rounded-full ${gw.is_online ? 'bg-green-500/10' : 'bg-red-500/10'}`} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={gw.is_online ? "#22c55e" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg relative z-10">
              <path d="M12 2a8 8 0 0 0-8 8c0 4.5 8 12 8 12s8-7.5 8-12a8 8 0 0 0-8-8z" fill={gw.is_online ? "#22c55e20" : "#ef444420"} />
              <circle cx="12" cy="10" r="3" fill={gw.is_online ? "#22c55e" : "#ef4444"} />
              <line x1="12" y1="13" x2="12" y2="20" />
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="20" x2="14" y2="20" />
            </svg>
          </div>
        </Marker>
      ))}

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
    </>
  );
}
