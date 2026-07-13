import { IconDeviceSdCard, IconAlertTriangle, IconAlertCircle, IconWifiOff, IconAlertHexagon } from "@tabler/icons-react";
import type { DashboardData } from "../types/dashboard.types";

export default function MapOverlayInfo({ data }: { data?: DashboardData }) {
  const hasCritical = (data?.alerts?.critical?.length ?? 0) > 0;
  const isUrgent = hasCritical || (data?.alerts?.desconexionGW?.length ?? 0) > 0;

  return (
    <div
      className={`absolute top-2 left-2 z-10 flex flex-col gap-1 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-lg min-w-44 max-h-[65vh] overflow-y-auto ${
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
      `}</style>

      {/* Resumen con iconos + contadores */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="flex items-center gap-1.5 text-text-200">
          <IconDeviceSdCard size={12} className="text-[#8ecae0]" />
          <span>GPS <strong className="text-text-100">{data?.summary?.totalGpsDevices || 0}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-text-200">
          <IconAlertTriangle size={12} className="text-red-400" />
          <span><strong className="text-red-400">{data?.summary?.criticalAlertsCount || 0}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-text-200">
          <IconAlertCircle size={12} className="text-[#eab308]" />
          <span><strong className="text-yellow-400">{data?.summary?.atencionAlertsCount || 0}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-text-200">
          <IconAlertHexagon size={12} className="text-[#a855f7]" />
          <span><strong className="text-purple-400">{data?.summary?.movimientosAnomalosCount || 0}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-text-200">
          <IconWifiOff size={12} className="text-orange-400" />
          <span><strong className="text-orange-400">{data?.summary?.desconexionGWCount || 0}</strong></span>
        </div>
      </div>
    </div>
  );
}
