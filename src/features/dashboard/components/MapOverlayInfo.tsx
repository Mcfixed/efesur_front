import { IconDeviceSdCard, IconAntenna, IconAlertTriangle, IconAlertCircle, IconAlertHexagon, IconWifiOff } from "@tabler/icons-react";
import type { DashboardData } from "../types/dashboard.types";

export default function MapOverlayInfo({ data }: { data?: DashboardData }) {
  const alerts = [
    { count: data?.summary?.criticalAlertsCount || 0, icon: IconAlertTriangle, color: 'text-red-400', bg: 'bg-red-500' },
    { count: data?.summary?.atencionAlertsCount || 0, icon: IconAlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500' },
    { count: data?.summary?.movimientosAnomalosCount || 0, icon: IconAlertHexagon, color: 'text-purple-400', bg: 'bg-purple-500' },
    { count: data?.summary?.desconexionGWCount || 0, icon: IconWifiOff, color: 'text-orange-400', bg: 'bg-orange-500' },
  ];
  const hasAnyAlert = alerts.some(a => a.count > 0);
  const hasCritical = (data?.summary?.criticalAlertsCount || 0) > 0;
  const isUrgent = hasCritical || (data?.summary?.desconexionGWCount || 0) > 0;

  return (
    <div
      className={`absolute top-2 left-2 z-10 flex flex-col gap-1 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-lg min-w-36 ${
        isUrgent
          ? "bg-red-500/10 border border-red-500/30"
          : "bg-bg-100/85 border border-border/30"
      }`}
      style={isUrgent ? {
        boxShadow: '0 0 15px rgba(239,68,68,0.15), 0 0 30px rgba(239,68,68,0.05)',
        animation: 'pulse-border 2s ease-in-out infinite'
      } : undefined}
    >

      {/* GPS + Gateways */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-text-200">
          <IconDeviceSdCard size={14} className="text-[#8ecae0]" />
          <span className="font-bold text-text-100">{data?.summary?.totalGpsDevices || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-200">
          <IconAntenna size={14} className="text-emerald-400" />
          <span className="font-bold text-text-100">{data?.summary?.totalGatewayDevices || 0}</span>
        </div>
      </div>

      {/* Alertas: solo iconos si hay */}
      {hasAnyAlert && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-border/20 mt-0.5">
          {alerts.filter(a => a.count > 0).map((a, i) => (
            <div key={i} className="relative flex items-center justify-center">
              <a.icon size={14} className={a.color} />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full ${a.bg} flex items-center justify-center text-[7px] font-bold text-white`}>
                {a.count > 99 ? '99+' : a.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
