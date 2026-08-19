import { useMemo } from "react";
import { IconAlertTriangle, IconAlertCircle, IconWifiOff, IconRadar } from "@tabler/icons-react";
import type { DashboardData } from "../types/dashboard.types";

interface Props {
  data?: DashboardData;
}

export default function AlertTickerBanner({ data }: Props) {
  const alertItems = useMemo(() => {
    const items: { device_name: string; type: string; icon: JSX.Element; color: string; bg: string }[] = [];
    (data?.alerts?.critical || []).forEach(a => items.push({ device_name: a.device_name, type: 'Crítica', icon: <IconAlertTriangle size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    (data?.alerts?.atencion || []).forEach(a => items.push({ device_name: a.device_name, type: 'Atención', icon: <IconAlertCircle size={13} />, color: '#eab308', bg: 'bg-yellow-500/8' }));
    (data?.alerts?.desconexionGW || []).forEach(a => items.push({ device_name: a.device_name, type: 'GW Off', icon: <IconWifiOff size={13} />, color: '#f97316', bg: 'bg-orange-500/8' }));
    (data?.alerts?.desconexion220 || []).forEach(a => items.push({ device_name: a.device_name, type: 'CA 220 Off', icon: <IconWifiOff size={13} />, color: '#f97316', bg: 'bg-orange-500/8' }));
    (data?.alerts?.desconexionbatGW || []).forEach(a => items.push({ device_name: a.device_name, type: 'Batería GW Off', icon: <IconWifiOff size={13} />, color: '#f97316', bg: 'bg-orange-500/8' }));
    (data?.alerts?.movimientos_anomalos || []).forEach(a => items.push({ device_name: a.device_name, type: 'Mov.', icon: <IconRadar size={13} />, color: '#a855f7', bg: 'bg-purple-500/8' }));
    (data?.alerts?.apertura || []).forEach(a => items.push({ device_name: a.device_name, type: 'Apertura', icon: <IconAlertTriangle size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    (data?.alerts?.presencia || []).forEach(a => items.push({ device_name: a.device_name, type: 'Presencia', icon: <IconAlertCircle size={13} />, color: '#eab308', bg: 'bg-yellow-500/8' }));
    return items;
  }, [data]);

  if (alertItems.length === 0) return null;

  const duplicated = [...alertItems, ...alertItems, ...alertItems];

  return (
    <div className="w-full overflow-hidden bg-bg-100/90 border-b border-border/20 relative" style={{ height: 30 }}>
      <div className="absolute inset-0 flex items-center ticker-track">
        <div className="flex items-center gap-4 whitespace-nowrap ticker-animate shrink-0">
          {duplicated.map((item, i) => (
            <span key={i} className={`flex items-center gap-1.5 text-[12px] font-medium shrink-0 ${item.bg} px-2 py-0.5 rounded`} style={{ color: item.color }}>
              {item.icon}
              <span className="font-semibold">{item.device_name}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.8 }}>{item.type}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
