import { useState, useEffect } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { Alert } from "../types/dashboard.types";

const SIX_HOURS_MS = 6 * 3600 * 1000;

/**
 * Formatea el tiempo transcurrido (ms) desde la creación de la alerta.
 * - Alerta NORMAL: el contador se congela visualmente a las 6h (el sensor deja de transmitir)
 *   y marca `frozen = true` para mostrar el indicador "≥ 6h".
 * - Alerta en PERSECUCIÓN: sigue contando sin tope; si supera 24h muestra días.
 */
function formatCounter(ms: number, pursuit: boolean): { text: string; frozen: boolean } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (pursuit) {
    if (days > 0) return { text: `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`, frozen: false };
    return { text: `${pad(hours)}:${pad(mins)}:${pad(secs)}`, frozen: false };
  }
  if (ms >= SIX_HOURS_MS) {
    return { text: "06:00:00", frozen: true };
  }
  return { text: `${pad(hours)}:${pad(mins)}:${pad(secs)}`, frozen: false };
}

/** Lista de alertas críticas, cada una con su contador en vivo (tick 1s). */
export default function CriticalAlertCounters({ alerts }: { alerts: Alert[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!alerts.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {alerts.map((a) => {
        const pursuit = a.metadata?.command === 'persecucion';
        const aborted = a.metadata?.command === 'abortar';
        const { text, frozen } = formatCounter(now - new Date(a.created_at).getTime(), pursuit);
        return (
          <div key={a.id} className="flex items-start gap-1.5">
            <IconAlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[11px] font-semibold text-red-100 truncate">{a.device_name}</span>
              <div className="flex items-center gap-1">
                <span className={`font-mono text-[11px] tabular-nums ${frozen ? "text-orange-300" : "text-red-300"}`}>
                  {aborted ? "—" : text}
                </span>
                {aborted && (
                  <span className="text-[9px] font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded px-1">
                    abortada
                  </span>
                )}
                {!aborted && frozen && (
                  <span className="text-[9px] font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded px-1">
                    ≥ 6h
                  </span>
                )}
                {!aborted && pursuit && (
                  <span className="text-[9px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded px-1">
                    persecución
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
