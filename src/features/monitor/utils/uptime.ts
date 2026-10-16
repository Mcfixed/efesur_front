// ─── Uptime de gateways ───
// Los gateways no generan telemetría propia: su disponibilidad se deriva de las alertas de
// desconexión, donde created_at → resolved_at es el período caído (una alerta abierta sigue
// contando hasta ahora). Estas funciones las comparten el panel del gateway y la tabla del
// panel técnico, para que los dos muestren exactamente el mismo número.

export interface IntervaloCaida { start: number; end: number }
export interface SegmentoUptime { start: number; end: number; online: boolean }
export interface BucketUptime { start: number; end: number; onlineMs: number; offlineMs: number; caidas: number }
export interface StatsUptime { onlineMs: number; offlineMs: number; caidas: number; uptime: number }

/** Duración legible a partir de milisegundos ("12 min", "5 h 20 min") */
export function fmtDuracion(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Alertas → intervalos caídos, recortados a la ventana visible.
 * Basta con que la alerta solape la ventana: antes se descartaban las alertas que empezaban
 * antes del rango, lo que borraba las caídas largas (un gateway caído desde hace un mes
 * aparecía 100% operativo).
 */
export function intervalosCaida(
  alertas: { created_at: string; resolved_at?: string | null }[],
  desde: number,
  hasta: number,
): IntervaloCaida[] {
  return alertas
    .map(a => ({
      start: Math.max(new Date(a.created_at).getTime(), desde),
      end: Math.min(a.resolved_at ? new Date(a.resolved_at).getTime() : hasta, hasta),
    }))
    .filter(i => Number.isFinite(i.start) && i.end > i.start)
    .sort((a, b) => a.start - b.start);
}

/**
 * Intervalos que ya vienen recortados desde la API → intervalos usables por las funciones de abajo.
 * El backend entrega `{ start, end }` en ISO (UTC) ya acotados a la ventana pedida.
 */
export function intervalosDesdeApi(intervalos: { start: string; end: string }[]): IntervaloCaida[] {
  return intervalos
    .map(i => ({ start: new Date(i.start).getTime(), end: new Date(i.end).getTime() }))
    .filter(i => Number.isFinite(i.start) && i.end > i.start)
    .sort((a, b) => a.start - b.start);
}

/**
 * Intervalos caídos → línea de tiempo activo/inactivo.
 * Los huecos activos menores a `minHuecoMs` (1 min) se descartan para no generar ruido.
 */
export function segmentosUptime(
  intervalos: IntervaloCaida[],
  desde: number,
  hasta: number,
  onlineAlFinal: boolean,
  minHuecoMs = 60000,
): SegmentoUptime[] {
  const segments: SegmentoUptime[] = [];
  let cursor = desde;
  for (const i of intervalos) {
    if (i.end <= cursor) continue;
    if (i.start > cursor + minHuecoMs) segments.push({ start: cursor, end: i.start, online: true });
    segments.push({ start: Math.max(cursor, i.start), end: i.end, online: false });
    cursor = i.end;
  }
  if (cursor < hasta) segments.push({ start: cursor, end: hasta, online: onlineAlFinal });
  return segments;
}

/** Totales del período: tiempo activo, caído, cantidad de caídas y uptime % */
export function statsUptime(segmentos: SegmentoUptime[]): StatsUptime {
  let onlineMs = 0, offlineMs = 0, caidas = 0;
  for (const s of segmentos) {
    if (s.online) onlineMs += s.end - s.start;
    else { offlineMs += s.end - s.start; caidas += 1; }
  }
  const total = onlineMs + offlineMs;
  return { onlineMs, offlineMs, caidas, uptime: total > 0 ? Math.round((onlineMs / total) * 100) : 100 };
}

/** Reparte la línea de tiempo en N bloques iguales (para el mini gráfico por fila) */
export function bucketsUptime(segmentos: SegmentoUptime[], desde: number, hasta: number, n: number): BucketUptime[] {
  const step = Math.max((hasta - desde) / n, 1);
  const buckets: BucketUptime[] = Array.from({ length: n }, (_, i) => ({
    start: desde + i * step,
    end: desde + (i + 1) * step,
    onlineMs: 0,
    offlineMs: 0,
    caidas: 0,
  }));
  for (const seg of segmentos) {
    for (const b of buckets) {
      const s = Math.max(seg.start, b.start);
      const e = Math.min(seg.end, b.end);
      if (e <= s) continue;
      if (seg.online) b.onlineMs += e - s;
      else {
        b.offlineMs += e - s;
        if (seg.start === s) b.caidas += 1; // la caída se cuenta en el bloque donde inicia
      }
    }
  }
  return buckets;
}

/** Color del porcentaje de uptime, igual en el panel y en la tabla */
export function uptimeTextClass(pct: number): string {
  return pct >= 95 ? "text-emerald-400" : pct >= 80 ? "text-amber-300" : "text-rose-400";
}

export function uptimeDotClass(pct: number): string {
  return pct >= 95 ? "bg-emerald-400" : pct >= 80 ? "bg-amber-300" : "bg-rose-400";
}
