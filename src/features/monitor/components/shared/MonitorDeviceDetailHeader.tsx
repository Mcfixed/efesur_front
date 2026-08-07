import { format } from "date-fns";
import { formatBattery, batteryColor } from "../../utils/battery";
import MonitorBatteryPopup from "./MonitorBatteryPopup";
import type { MonitorDevice } from "../../types/monitor.types";

interface Props {
  device: MonitorDevice;
  onBack: () => void;
  lastTs?: string | null;
  recordCount?: number;
  lastVoltage?: number | null;
  lastTemp?: number | null;
  lastMotion?: string | null;
  lastGwCount?: number;
  lastGwNames?: string[];
  range?: string;
  onRangeChange?: (range: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 Días", hours: 168 },
  { key: "30d", label: "30 Días", hours: 720 },
  { key: "total", label: "Todo", hours: 0 },
];

export default function MonitorDeviceDetailHeader({ device, onBack, lastTs, recordCount, lastVoltage, lastTemp, lastMotion, lastGwCount, lastGwNames, range, onRangeChange, onLoadMore, hasMore }: Props) {
  // Estado online: usar el último dato real de telemetría (lastTs) con fallback a last_seen de la DB.
  // Diferencia absoluta <= 5 min, tolerante a reloj adelantado/atrasado y a NaN.
  const refTs = lastTs ?? device.last_seen ?? null;
  const refTsMs = refTs ? new Date(refTs).getTime() : NaN;
  const isOnline = device.is_active && Number.isFinite(refTsMs) && Math.abs(Date.now() - refTsMs) < 300000;

  return (
    <div className="relative rounded-lg bg-bg-100 shadow-sm border border-border/20 px-4 py-3">
      {/* ── Fila 1: identidad + rango ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-text-200 hover:text-text-100 bg-bg-300/40 hover:bg-bg-300/70 px-2.5 py-1 rounded-lg transition-colors shrink-0">
          ← Volver
        </button>
        <span className="w-px h-7 bg-border/20 shrink-0" />
        <span className={`w-3 h-3 rounded-full shrink-0 ${isOnline ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-extrabold text-text-100 truncate leading-tight tracking-tight">{device.name}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-300 bg-bg-300/50 px-2 py-0.5 rounded border border-border/20 shrink-0">{device.type_device}</span>
          </div>
          <span className="text-[12px] font-mono text-text-300 truncate block">{device.dev_eui}</span>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {isOnline ? '● Online' : '● Offline'}
        </span>
        <div className="flex-1" />
        {range && onRangeChange && (
          <div className="flex gap-1 bg-bg-300/40 p-0.5 rounded-lg">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => onRangeChange(r.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${range === r.key ? 'bg-white/15 text-text-100 shadow-sm border border-white/10' : 'text-text-300 hover:text-text-100 hover:bg-bg-300/50'}`}>{r.label}</button>
            ))}
          </div>
        )}
        {recordCount !== undefined && (
          <span className="text-[11px] text-text-200 bg-bg-300/40 px-2 py-1 rounded font-medium">{recordCount} registros</span>
        )}
      </div>

      {/* ── Fila 2: métricas en grid ── */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        {/* Último dato */}
        <div className="rounded-lg bg-bg-300/30 border border-border/15 px-2.5 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-text-300 font-semibold">Último dato</p>
          {lastTs ? (
            <p className={`text-[13px] font-semibold mt-0.5 ${isOnline ? 'text-green-400' : 'text-yellow-400'}`}>
              {format(new Date(lastTs), "dd/MM HH:mm:ss")}
            </p>
          ) : (
            <p className="text-[13px] text-text-300 mt-0.5">—</p>
          )}
        </div>

        {/* Batería */}
        {lastVoltage != null && (
          <div className="rounded-lg bg-bg-300/30 border border-border/15 px-2.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-text-300 font-semibold flex items-center gap-1">Batería
              <MonitorBatteryPopup>
                <svg className="w-3 h-3 text-text-400 cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              </MonitorBatteryPopup>
            </p>
            <p className={`text-[13px] font-bold font-mono mt-0.5 ${batteryColor(lastVoltage)}`}>{formatBattery(lastVoltage)}</p>
          </div>
        )}

        {/* Temp */}
        {lastTemp != null && (
          <div className="rounded-lg bg-bg-300/30 border border-border/15 px-2.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-text-300 font-semibold">Temperatura</p>
            <p className="text-[13px] font-bold font-mono mt-0.5 text-cyan-400">{lastTemp}°C</p>
          </div>
        )}

        {/* Movimiento */}
        {lastMotion != null && (
          <div className="rounded-lg bg-bg-300/30 border border-border/15 px-2.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-text-300 font-semibold">Movimiento</p>
            <p className={`text-[13px] font-bold mt-0.5 ${lastMotion === 'Caída' ? 'text-red-400' : lastMotion === 'Sí' ? 'text-yellow-400' : 'text-green-400'}`}>{lastMotion}</p>
          </div>
        )}

        {/* Gateways */}
        {(lastGwNames && lastGwNames.length > 0) || lastGwCount != null ? (
          <div className="rounded-lg bg-bg-300/30 border border-border/15 px-2.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-text-300 font-semibold">Gateways</p>
            <p className="text-[13px] font-bold mt-0.5 text-blue-400 truncate">
              {lastGwNames && lastGwNames.length > 0
                ? lastGwNames.join(', ')
                : lastGwCount != null
                  ? String(lastGwCount)
                  : '—'}
            </p>
          </div>
        ) : null}

        {/* Cargar más */}
        {onLoadMore && hasMore && (
          <button onClick={onLoadMore}
            className="col-span-full sm:col-span-1 text-[10px] text-brand-200 hover:text-brand-100 px-2 py-1 rounded hover:bg-bg-100/60 transition-colors justify-self-start">
            + Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
