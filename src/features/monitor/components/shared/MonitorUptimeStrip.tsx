import { format } from "date-fns";
import {
  intervalosDesdeApi,
  segmentosUptime,
  statsUptime,
  bucketsUptime,
  fmtDuracion,
  uptimeTextClass,
  type BucketUptime,
} from "../../utils/uptime";
import type { MonitorGatewaysUptime } from "../../types/monitor.types";

// Bloques del mini gráfico de uptime: 7 días × 12 bloques de 2 h = 84 bloques
export const UPTIME_DIAS = 7;
export const UPTIME_BLOQUES_POR_DIA = 12;

// Anchos FIJOS en px. Con flex-1 y 84 bloques el navegador redondea distinto cada uno y se veían
// unos más anchos que otros; con medidas exactas todos los bloques salen iguales.
const UPTIME_BLOQUE_PX = 3;      // ancho de cada bloque de 2 h
const UPTIME_HUECO_PX = 1;       // separación entre bloques del mismo día
const UPTIME_SEP_DIA_PX = 4;     // separación entre día y día
const UPTIME_DIA_PX = UPTIME_BLOQUES_POR_DIA * UPTIME_BLOQUE_PX + (UPTIME_BLOQUES_POR_DIA - 1) * UPTIME_HUECO_PX;
const UPTIME_ANCHO_PX = UPTIME_DIAS * UPTIME_DIA_PX + (UPTIME_DIAS - 1) * UPTIME_SEP_DIA_PX;

export interface UptimeGateway {
  uptime: number;
  caidas: number;
  offlineMs: number;
  buckets: BucketUptime[];
}

// Color del bloque: esmeralda sin caídas, ámbar una caída parcial, rosa caído al menos medio bloque
const uptimeBloqueClass = (offlineMs: number, totalMs: number): string => {
  if (offlineMs <= 0) return "bg-emerald-400";
  return offlineMs / totalMs >= 0.5 ? "bg-rose-400" : "bg-amber-300";
};

/**
 * Uptime de 7 días por gateway, calculado con las mismas funciones que usa el panel del gateway.
 * Lo comparten el panel técnico (tabla de gateways) y el panel de resumen.
 */
export function buildUptimePorGateway(uptimeData?: MonitorGatewaysUptime): Map<number, UptimeGateway> {
  const map = new Map<number, UptimeGateway>();
  if (!uptimeData?.desde || !uptimeData?.hasta) return map;
  const desde = new Date(uptimeData.desde).getTime();
  const hasta = new Date(uptimeData.hasta).getTime();
  for (const g of uptimeData.gateways) {
    const segmentos = segmentosUptime(intervalosDesdeApi(g.intervalos), desde, hasta, true);
    const { uptime, caidas, offlineMs } = statsUptime(segmentos);
    map.set(g.id, {
      uptime,
      caidas,
      offlineMs,
      buckets: bucketsUptime(segmentos, desde, hasta, UPTIME_DIAS * UPTIME_BLOQUES_POR_DIA),
    });
  }
  return map;
}

export function MonitorUptimeStrip({ s }: { s: UptimeGateway }) {
  const resumen = `Uptime ${s.uptime}% · ${s.caidas} caída${s.caidas !== 1 ? "s" : ""} · ${fmtDuracion(s.offlineMs)} caído en total`;
  // Un grupo de bloques por día (el alto del gráfico y el de la regla se alinean solos)
  const dias = Array.from({ length: UPTIME_DIAS }, (_, i) =>
    s.buckets.slice(i * UPTIME_BLOQUES_POR_DIA, (i + 1) * UPTIME_BLOQUES_POR_DIA));
  return (
    <div className="grid grid-cols-[auto_auto] gap-x-2 items-center">
      <div className="shrink-0 flex" style={{ width: UPTIME_ANCHO_PX, gap: UPTIME_SEP_DIA_PX }} title={resumen}>
        {dias.map((bloques, i) => (
          <div key={i} className="flex" style={{ width: UPTIME_DIA_PX, gap: UPTIME_HUECO_PX }}>
            {bloques.map(b => (
              <div key={b.start}
                title={`${format(new Date(b.start), "dd/MM HH:mm")} – ${format(new Date(b.end), "HH:mm")} · ${b.offlineMs > 0 ? `caído ${fmtDuracion(b.offlineMs)}` : "sin caídas"}`}
                className={`h-3 ${uptimeBloqueClass(b.offlineMs, b.end - b.start)}`}
                style={{ width: UPTIME_BLOQUE_PX }} />
            ))}
          </div>
        ))}
      </div>
      <span className={`text-[10px] font-semibold tabular-nums ${uptimeTextClass(s.uptime)}`}>{s.uptime}%</span>
      {/* Regla de días: cada celda mide exactamente lo mismo que su grupo de bloques */}
      <div className="shrink-0 flex mt-0.5" style={{ width: UPTIME_ANCHO_PX, gap: UPTIME_SEP_DIA_PX }}>
        {dias.map((bloques, i) => (
          <div key={i} className="text-center text-[8px] leading-none text-text-400 border-t border-border/40 pt-0.5"
            style={{ width: UPTIME_DIA_PX }}>
            {bloques.length
              ? format(new Date((bloques[0].start + bloques[bloques.length - 1].end) / 2), "dd/MM")
              : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
