import { IconDeviceSdCard, IconAlertTriangle, IconAlertCircle } from "@tabler/icons-react";
import { format } from "date-fns";
import type { DashboardData } from "../types/dashboard.types";

export default function MapOverlayInfo({ data }: { data?: DashboardData }) {
  const hasCritical = (data?.alerts?.critical?.length ?? 0) > 0;

  return (
    <div
      className={`absolute top-2 left-2 z-10 flex flex-col gap-1 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg min-w-52 ${
        hasCritical
          ? "bg-red-950/75 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
          : "bg-bg-100/85 border border-border-100"
      }`}
      style={hasCritical ? {
        boxShadow: '0 0 15px rgba(239,68,68,0.15), 0 0 30px rgba(239,68,68,0.05)',
        animation: 'pulse-border 2s ease-in-out infinite'
      } : undefined}
    >
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(239,68,68,0.4); }
          50% { border-color: rgba(239,68,68,0.8); }
        }
        @keyframes alert-slide {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Resumen */}
      <div className="flex items-center gap-2 text-[11px] text-text-200">
        <IconDeviceSdCard size={12} className="text-[#8ecae0]" />
        <span>GPS: <strong className="text-text-100">{data?.summary?.totalGpsDevices || 0}</strong></span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="relative flex items-center justify-center">
          <IconAlertTriangle size={12} className="text-red-400 relative z-10" />
          {hasCritical && <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />}
        </span>
        <span className="text-text-200">
          Críticas: <strong className="text-red-400">{data?.summary?.criticalAlertsCount || 0}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-200">
        <IconAlertCircle size={12} className="text-[#ffc658]" />
        <span>Atención: <strong className="text-yellow-400">{data?.summary?.atencionAlertsCount || 0}</strong></span>
      </div>

      {/* Separador */}
      {hasCritical && <div className="h-px bg-linear-to-r from-red-500/60 via-red-500/30 to-transparent my-1.5" />}

      {/* Lista de alertas críticas activas */}
      {data?.alerts?.critical?.map((alert, idx) => (
        <div
          key={alert.id}
          className="flex items-start gap-2 text-[11px] leading-snug bg-red-500/10 border-s-2 border-red-500 rounded-r px-2 py-1.5"
          style={{ animation: `alert-slide 0.3s ease-out ${idx * 0.12}s both` }}
        >
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/40 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse relative" />
          </div>
          <span className="flex-1 min-w-0">
            <span className="font-bold text-red-300 block truncate">{alert.device_name}</span>
            <span className="text-[10px] text-red-400/70 block">
              {format(new Date(alert.created_at), "yyyy/MM/dd HH:mm")}
            </span>
            {alert.metadata?.reason && (
              <span className="text-[9px] text-red-400/50 block truncate mt-0.5 italic">{alert.metadata.reason}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
