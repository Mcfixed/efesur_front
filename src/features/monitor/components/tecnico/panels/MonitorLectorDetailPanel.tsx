import { useMemo } from "react";
import { format } from "date-fns";
import { useMonitorDeviceTelemetry, useMonitorDeviceAlerts } from "../../../hooks/useMonitor";
import { IconDatabase, IconBattery, IconCalendarTime } from "@tabler/icons-react";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui: string;
  lastTs?: string | null;
}

export default function MonitorLectorDetailPanel({ deviceId, deviceName, lastTs }: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: telemetryData, isLoading } = useMonitorDeviceTelemetry(deviceId, { from: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), limit: 200 });

  const lastT = telemetryData?.telemetry?.[0];
  const totalReadings = telemetryData?.telemetry?.length || 0;
  const avgBattery = useMemo(() => {
    if (!telemetryData?.telemetry?.length) return null;
    const vals = telemetryData.telemetry.map((t: any) => t.object?.voltage_mV).filter((v: any) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  }, [telemetryData]);

  return (
    <div className="flex-1 grid grid-rows-2 gap-1.5 min-h-0">
      <div className="grid grid-cols-3 gap-1.5 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconDatabase size={28} className="text-amber-400 mb-2" />
          <span className="text-2xl font-bold text-text-100">{totalReadings}</span>
          <span className="text-[10px] text-text-300 mt-1">Lecturas (7d)</span>
        </div>
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconBattery size={28} className={`mb-2 ${avgBattery != null && avgBattery >= 3700 ? 'text-green-400' : 'text-yellow-400'}`} />
          <span className="text-2xl font-bold text-text-100">{avgBattery != null ? `${(avgBattery / 1000).toFixed(2)}V` : '—'}</span>
          <span className="text-[10px] text-text-300 mt-1">Batería promedio</span>
        </div>
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconCalendarTime size={28} className="text-sky-400 mb-2" />
          <span className="text-sm font-bold text-text-100 text-center">{lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}</span>
          <span className="text-[10px] text-text-300 mt-1">Última lectura</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0"><div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-bold text-text-100 uppercase tracking-wider">Últimas lecturas</span>
            <span className="text-sm font-bold text-text-100">{totalReadings}</span>
          </div></div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[10px] uppercase tracking-wider sticky top-0 bg-bg-100 border-b border-border/20">
                <th className="text-left px-3 py-1.5 font-semibold text-text-300">Fecha</th>
                <th className="text-left px-3 py-1.5 font-semibold text-text-300">Batería</th>
                <th className="text-left px-3 py-1.5 font-semibold text-text-300">GW</th>
              </tr></thead>
              <tbody>
                {telemetryData?.telemetry?.slice(0, 50).map((t: any) => (
                  <tr key={t.id} className="border-t border-border/10 hover:bg-bg-100/60 transition-colors">
                    <td className="px-3 py-1.5 text-text-200 font-mono whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                    <td className="px-3 py-1.5 font-mono">{t.object?.voltage_mV ? <span className={t.object.voltage_mV >= 3700 ? 'text-green-400/80' : 'text-yellow-400/80'}>{(t.object.voltage_mV / 1000).toFixed(2)}V</span> : <span>—</span>}</td>
                    <td className="px-2 py-1">{Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && totalReadings === 0 && <p className="text-center text-[11px] py-6">Sin lecturas</p>}
          </div>
        </div>
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0"><div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Alertas
            </p>
            <span className="text-sm font-bold text-text-100">{deviceAlerts?.length || 0}</span>
          </div></div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
            {deviceAlerts && deviceAlerts.length > 0 ? deviceAlerts.map((alert: any) => (
              <div key={alert.id} className={`flex items-start gap-1.5 text-[11px] leading-tight rounded px-1.5 py-1 border-s-2 ${alert.type === 'critica' ? 'border-red-500/40 bg-red-500/8' : 'border-yellow-500/40 bg-yellow-500/8'} ${alert.status === 'resolved' ? 'opacity-50' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${alert.type === 'critica' ? 'bg-red-500' : 'bg-yellow-500'} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-semibold uppercase text-text-300">{alert.type}</span>
                    <span className="ml-auto text-[10px] font-medium text-text-200 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  {alert.metadata?.reason && <p className="text-[10px] leading-tight mt-0.5">{alert.metadata.reason}</p>}
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full"><p className="text-[13px]">Sin alertas</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
