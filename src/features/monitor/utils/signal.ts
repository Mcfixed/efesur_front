/**
 * Señal del último dato de un sensor.
 * El "mejor" gateway de un registro es el de mayor SNR (desempate por mayor RSSI),
 * el mismo criterio que usa el reporte diario del mapa de calor y el panel del sensor.
 */

export interface Senal {
  snr: number | null;
  rssi: number | null;
}

/** Mejor señal de un registro a partir de su `rxinfo` */
export function mejorSenal(rxinfo: unknown): Senal {
  const rx = Array.isArray(rxinfo) ? rxinfo : [];
  let best: { snr: number; rssi: number | null } | null = null;
  for (const g of rx) {
    if (g?.snr == null) continue;
    const snr = Number(g.snr);
    const rssi = g?.rssi != null ? Number(g.rssi) : null;
    if (!best || snr > best.snr || (snr === best.snr && (rssi ?? -999) > (best.rssi ?? -999))) best = { snr, rssi };
  }
  return { snr: best?.snr ?? null, rssi: best?.rssi ?? null };
}

/**
 * Promedio de la mejor señal sobre los primeros `n` registros (la API los devuelve del más
 * reciente al más antiguo). Los registros sin datos de radio no cuentan en el promedio.
 */
export function promedioSenal(rows: unknown, n = 5): Senal & { n: number } {
  const lista = (Array.isArray(rows) ? rows : []) as Array<{ rxinfo?: unknown }>;
  const ultimos = lista.slice(0, n);
  const snrs: number[] = [];
  const rssis: number[] = [];
  ultimos.forEach(t => {
    const { snr, rssi } = mejorSenal(t?.rxinfo);
    if (snr != null) snrs.push(snr);
    if (rssi != null) rssis.push(rssi);
  });
  const promedio = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  return { snr: promedio(snrs), rssi: promedio(rssis), n: ultimos.length };
}
