/**
 * Umbrales de "online" según el tipo de dispositivo.
 *
 * - Los sensores Gps envían un keepalive cada 4 h, así que se les da 4 h 15 min de margen:
 *   si a las 4 h 15 min no hay datos nuevos, se considera caído.
 * - Los gateways reportan de forma instantánea (retransmiten los uplinks de los sensores),
 *   por lo que su margen es de minutos.
 */

/** Margen para gateways: reportan al instante */
export const GATEWAY_ONLINE_MS = 5 * 60 * 1000;             // 5 min

/** Margen para sensores: keepalive cada 4 h + 15 min de tolerancia */
export const SENSOR_ONLINE_MS = (4 * 60 + 15) * 60 * 1000;  // 4 h 15 min

/** Margen de frescura del último dato según el tipo de dispositivo */
export function onlineThresholdMs(typeDevice?: string | null): number {
  return typeDevice === 'Gateway' ? GATEWAY_ONLINE_MS : SENSOR_ONLINE_MS;
}

/** ¿El timestamp (ms) sigue dentro del margen de "online" para ese tipo de dispositivo? */
export function isFreshForDevice(tsMs: number, typeDevice?: string | null): boolean {
  return Number.isFinite(tsMs) && Math.abs(Date.now() - tsMs) < onlineThresholdMs(typeDevice);
}
