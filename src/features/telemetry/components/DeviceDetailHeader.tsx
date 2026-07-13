import { format } from "date-fns";
import type { DeviceSearchResult } from "../types/telemetry.types";

interface Props {
  device: DeviceSearchResult;
  onBack: () => void;
  lastTs?: string | null;
  recordCount?: number;
  lastVoltage?: number | null;
  lastTemp?: number | null;
  lastMotion?: string | null;
  lastGwCount?: number;
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

export default function DeviceDetailHeader({ device, onBack, lastTs, recordCount, lastVoltage, lastTemp, lastMotion, lastGwCount, range, onRangeChange, onLoadMore, hasMore }: Props) {
  // Online si está activo en BD y su last_seen está dentro de las últimas 24h
  const isOnline = device.is_active && !!device.last_seen && (Date.now() - new Date(device.last_seen).getTime() < 86400000);

  return (
    <div className="relative rounded-lg bg-bg-100 shadow-sm border border-border/20 px-4 py-3">
      {/* Row 1: Back + identity */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-text-200 hover:text-text-100 bg-bg-300/40 hover:bg-bg-300/70 px-2.5 py-1 rounded-lg transition-colors shrink-0">
          ← Volver
        </button>
        <span className="w-px h-7 bg-border/20 shrink-0" />
        <span className={`w-3 h-3 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-text-100 truncate leading-tight tracking-tight">{device.name}</h2>
          <span className="text-[13px] font-mono text-text-300 truncate block">{device.dev_eui}</span>
        </div>
        <span className="text-[12px] font-semibold text-text-200 bg-bg-300/50 px-2.5 py-0.5 rounded shrink-0 border border-border/20">{device.type_device}</span>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded shrink-0 ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {isOnline ? '● Online' : '● Offline'}
        </span>
        <span className="flex-1" />
        {recordCount !== undefined && (
          <span className="text-[13px] text-text-200 bg-bg-300/40 px-2.5 py-1 rounded font-medium">{recordCount} registros</span>
        )}
      </div>
      {/* Row 2: Last telemetry metrics */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-300 font-semibold">Último:</span>
          {lastTs ? (
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${Date.now() - new Date(lastTs).getTime() < 86400000 ? 'bg-green-500/8 text-green-400' : 'bg-yellow-500/8 text-yellow-400'} text-[13px] font-semibold`}>
              <span className={`w-1.5 h-1.5 rounded-full ${Date.now() - new Date(lastTs).getTime() < 86400000 ? 'bg-green-400' : 'bg-yellow-400'}`} />
              {format(new Date(lastTs), "dd/MM HH:mm:ss")}
            </span>
          ) : (
            <span className="text-text-400 text-[13px]">—</span>
          )}
        </div>
        {lastVoltage != null && (
          <>
            <span className="w-px h-4 bg-border/20 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-text-300">Bat</span>
              <span className={`font-bold font-mono text-[14px] ${lastVoltage >= 3700 && lastVoltage <= 4100 ? 'text-green-400' : 'text-yellow-400'}`}>
                {(lastVoltage / 1000).toFixed(2)}V
              </span>
            </div>
          </>
        )}
        {lastTemp != null && (
          <>
            <span className="w-px h-4 bg-border/20 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-text-300">Temp</span>
              <span className="font-bold font-mono text-[14px] text-cyan-400">{lastTemp}°C</span>
            </div>
          </>
        )}
        {lastMotion != null && (
          <>
            <span className="w-px h-4 bg-border/20 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-text-300">Mov</span>
              <span className={`font-bold text-[14px] ${lastMotion === 'Caída' ? 'text-red-400' : lastMotion === 'Sí' ? 'text-yellow-400' : 'text-green-400'}`}>{lastMotion}</span>
            </div>
          </>
        )}
        {lastGwCount != null && (
          <>
            <span className="w-px h-4 bg-border/20 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-text-300">GW</span>
              <span className="font-bold text-[14px] text-blue-400">{lastGwCount}</span>
            </div>
          </>
        )}
        <span className="flex-1" />
        {range && onRangeChange && (
          <div className="flex gap-1 bg-bg-300/40 p-0.5 rounded-lg">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => onRangeChange(r.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${range === r.key ? 'bg-white/15 text-text-100 shadow-sm border border-white/10' : 'text-text-300 hover:text-text-100 hover:bg-bg-300/50'}`}>{r.label}</button>
            ))}
          </div>
        )}
        {onLoadMore && hasMore && (
          <button onClick={onLoadMore}
            className="text-[10px] text-brand-200 hover:text-brand-100 px-2 py-0.5 rounded hover:bg-bg-100/60 transition-colors">
            + Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
