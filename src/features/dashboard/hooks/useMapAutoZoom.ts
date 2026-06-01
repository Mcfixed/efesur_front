import { useEffect } from "react";
import type { MapRef } from "react-map-gl";
import type { DashboardData } from "../types/dashboard.types";

export function useMapAutoZoom(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  data: DashboardData | undefined
) {
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    let coords: [number, number][] = [];

    // Priorizar alertas críticas
    if (data?.alerts?.critical?.length) {
      coords = data.alerts.critical
        .filter(a => a.latitude_current && a.longitude_current)
        .map(a => [Number(a.longitude_current), Number(a.latitude_current)] as [number, number]);
    }

    // Si no hay críticas, usar todos los dispositivos
    if (!coords.length && data?.devices?.length) {
      coords = data.devices
        .filter(d => d.latitude_current && d.longitude_current)
        .map(d => [Number(d.longitude_current), Number(d.latitude_current)] as [number, number]);
    }

    if (!coords.length) return;

    const bounds = coords.reduce(
      (acc, [lng, lat]) => ({
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
      }),
      { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
    );

    mapRef.current.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 80, maxZoom: 15, duration: 1000 }
    );
  }, [data, mapLoaded, mapRef]);
}
