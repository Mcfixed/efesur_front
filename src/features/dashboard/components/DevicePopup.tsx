import { IconX } from "@tabler/icons-react";
import { format } from "date-fns";
import type { GpsDevice, DashboardData } from "../types/dashboard.types";

const InfoItem = ({ label, value, color, className = '' }: { label: string; value: string; color?: string; className?: string }) => (
  <div className={`flex flex-col ${className}`}>
    <span className="text-[9px] text-text-300 uppercase tracking-wider">{label}</span>
    <span className={`text-text-100 font-medium truncate ${color || ''}`}>{value}</span>
  </div>
);

export default function DevicePopup({ device, alerts, onClose }: { device: GpsDevice; alerts?: DashboardData['alerts']; onClose?: () => void }) {
  const deviceAlerts = alerts ? [
    ...(alerts.critical?.filter(a => a.device_id === device.id) || []),
    ...(alerts.atencion?.filter(a => a.device_id === device.id) || []),
  ] : [];

  const statusText = device.is_active ? (deviceAlerts.some(a => a.type === 'critica') ? 'Crítica' : 'Activo') : 'Inactivo';
  const batteryColor = device.battery > 50 ? 'text-green-400' : device.battery > 20 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-bg-100 border border-border/50 rounded-lg shadow-xl p-3 min-w-55 max-w-70 relative">
      {onClose && (
        <button onClick={onClose} className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-bg-300 border border-border/50 text-text-300 hover:text-text-100 shadow-md z-10 outline-none">
          <IconX size={11} />
        </button>
      )}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/30">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-100 truncate">{device.name}</h3>
          <p className="text-[10px] text-text-300 truncate font-mono">{device.dev_eui}</p>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ml-2 ${
          deviceAlerts.some(a => a.type === 'critica')
            ? 'bg-red-500/15 text-red-400'
            : device.is_active
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/10 text-red-400'
        }`}>
          {statusText}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <InfoItem label="Empresa" value={device.company_name} />
        <InfoItem label="Tipo" value={device.type_device} />
        <InfoItem label="Batería" value={`${device.battery}%`} color={batteryColor} />
        <InfoItem label="Modo" value={device.operating_mode} />
        <InfoItem label="Acelerómetro" value={device.accelerometers_status} />
        <InfoItem label="Mejor SNR" value={device.best_snr != null ? `${device.best_snr} dB` : '—'} color={device.best_snr != null && device.best_snr > -115 ? 'text-green-400' : device.best_snr != null && device.best_snr >= -120 ? 'text-yellow-400' : 'text-red-400'} />
        <InfoItem label="Coordenadas" value={`${Number(device.latitude_current).toFixed(4)}, ${Number(device.longitude_current).toFixed(4)}`} className="col-span-2" />
        <InfoItem label="Último reporte" value={device.last_seen ? format(new Date(device.last_seen), "yyyy/MM/dd HH:mm:ss") : 'N/A'} className="col-span-2" />
      </div>

      {deviceAlerts.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-border/30 space-y-1">
          <p className="text-[9px] font-semibold text-text-300 uppercase tracking-wider">Alertas activas</p>
          {deviceAlerts.map(alert => (
            <div key={alert.id} className={`text-[10px] px-1.5 py-1 rounded ${
              alert.type === 'critica' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              <span className="font-semibold">{alert.type === 'critica' ? '🔴' : '🟡'} {alert.type}</span>
              <span className="text-text-300 ml-1">• {format(new Date(alert.created_at), "HH:mm")}</span>
              {alert.metadata?.reason && <p className="text-[9px] text-text-300 truncate mt-0.5">{alert.metadata.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
