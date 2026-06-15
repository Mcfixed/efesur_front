import { IconDeviceSdCard, IconAlertTriangle, IconAlertCircle, IconWifiOff } from "@tabler/icons-react";
import { format } from "date-fns";
import type { DashboardData } from "../types/dashboard.types";

export default function MapOverlayInfo({ data }: { data?: DashboardData }) {
  const hasCritical = (data?.alerts?.critical?.length ?? 0) > 0;
  const hasGwAlert = (data?.alerts?.desconexionGW?.length ?? 0) > 0;
  const isUrgent = hasCritical || hasGwAlert;

  return (
    <div
      className={`absolute top-2 left-2 z-10 flex flex-col gap-0.5 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg min-w-52 max-h-[65vh] overflow-y-auto ${
        isUrgent
          ? "bg-red-950/75 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
          : "bg-bg-100/85 border border-border-100"
      }`}
      style={isUrgent ? {
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
      <div className="flex items-center gap-2 text-[10px] text-text-200">
        <IconDeviceSdCard size={11} className="text-[#8ecae0]" />
        <span>GPS: <strong className="text-text-100">{data?.summary?.totalGpsDevices || 0}</strong></span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="relative flex items-center justify-center">
          <IconAlertTriangle size={11} className="text-red-400 relative z-10" />
          {hasCritical && <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />}
        </span>
        <span className="text-text-200">
          Críticas: <strong className="text-red-400">{data?.summary?.criticalAlertsCount || 0}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-200">
        <IconAlertCircle size={11} className="text-[#ffc658]" />
        <span>Atención: <strong className="text-yellow-400">{data?.summary?.atencionAlertsCount || 0}</strong></span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-200">
        <IconWifiOff size={11} className="text-orange-400" />
        <span>GW off: <strong className="text-orange-400">{data?.summary?.desconexionGWCount || 0}</strong></span>
      </div>

      {/* Separador críticas */}
      {hasCritical && <div className="h-px bg-linear-to-r from-red-500/50 via-red-500/20 to-transparent my-1" />}

      {/* Lista de alertas críticas activas */}
      {data?.alerts?.critical?.map((alert, idx) => (
        <div
          key={alert.id}
          className="flex items-start gap-1.5 text-[10px] leading-tight bg-red-500/10 border-s-2 border-red-500 rounded-r px-1.5 py-1"
          style={{ animation: `alert-slide 0.3s ease-out ${idx * 0.08}s both` }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            <span className="font-semibold text-red-300 truncate block leading-tight">{alert.device_name}</span>
            <span className="text-[9px] text-red-400/60">{format(new Date(alert.created_at), "MM/dd HH:mm")}</span>
          </span>
        </div>
      ))}

      {/* Separador GW */}
      {hasGwAlert && <div className="h-px bg-linear-to-r from-orange-500/40 via-orange-500/10 to-transparent my-0.5" />}

      {/* Lista de desconexiones de Gateway */}
      {data?.alerts?.desconexionGW?.map((alert, idx) => (
        <div
          key={alert.id}
          className="flex items-start gap-1.5 text-[10px] leading-tight bg-orange-500/10 border-s-2 border-orange-500 rounded-r px-1.5 py-1"
          style={{ animation: `alert-slide 0.3s ease-out ${idx * 0.08}s both` }}
        >
          <IconWifiOff size={10} className="text-orange-400 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            <span className="font-semibold text-orange-300 truncate block leading-tight">{alert.device_name}</span>
            <span className="text-[9px] text-orange-400/60">{format(new Date(alert.created_at), "MM/dd HH:mm")}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
