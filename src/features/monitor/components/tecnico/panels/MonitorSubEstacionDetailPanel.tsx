import { useMemo } from "react";
import { format } from "date-fns";
import { useMonitorDeviceTelemetry, useMonitorDeviceAlerts } from "../../../hooks/useMonitor";
import { IconCloud, IconPlugConnected, IconAlertTriangle, IconClock } from "@tabler/icons-react";

interface Props {
  deviceId: number;
  deviceName: string;
  lastTs?: string | null;
}

export default function MonitorSubEstacionDetailPanel({ deviceId, deviceName, lastTs }: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: telemetryData, isLoading } = useMonitorDeviceTelemetry(deviceId, { from: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), limit: 200 });

  const lastT = telemetryData?.telemetry?.[0];
  const totalRecords = telemetryData?.telemetry?.length || 0;

  return (
    <div className="flex-1 grid grid-rows-2 gap-1.5 min-h-0">
      <div className="grid grid-cols-3 gap-1.5 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconCloud size={28} className="text-sky-400 mb-2" />
          <span className="text-2xl font-bold text-text-100">{totalRecords}</span>
          <span className="text-[10px] text-text-300 mt-1">Registros (7d)</span>
        </div>
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconPlugConnected size={28} className="text-emerald-400 mb-2" />
          <span className="text-lg font-bold text-text-100 text-center">
            {lastT?.object?.input_1_status === 'open' ? 'Abierta' : lastT?.object?.input_1_status === 'closed' ? 'Cerrada' : '—'}
          </span>
          <span className="text-[10px] text-text-300 mt-1">Estado entrada 1</span>
        </div>
        <div className="bg-bg-100 border border-border/30 rounded-lg flex flex-col items-center justify-center shadow min-h-0 p-4">
          <IconClock size={28} className="text-purple-400 mb-2" />
          <span className="text-sm font-bold text-text-100 text-center">
            {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}
          </span>
          <span className="text-[10px] text-text-300 mt-1">Último dato</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0"><div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-bold text-text-100 uppercase tracking-wider">Registros</span>
              <span className="text-sm font-bold text-text-100">{totalRecords}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-2 px-2 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 font-medium">Estado</th>
                  <th className="text-left py-2 px-2 font-medium">GW</th>
                </tr>
              </thead>
              <tbody>
                {telemetryData?.telemetry?.slice(0, 50).map((t: any, i: number) => (
                  <tr key={t.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                    <td className="py-1.5 px-2 text-text-200 font-mono text-[10px] whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                    <td className="py-1.5 px-2">
                      {t.object?.input_1_status === 'open'
                        ? <span className="text-green-400 font-medium">Abierta</span>
                        : t.object?.input_1_status === 'closed'
                          ? <span className="text-red-400 font-medium">Cerrada</span>
                          : <span className="text-text-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-text-300 text-[10px]">{Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && totalRecords === 0 && <p className="text-center text-[11px] py-6">Sin registros</p>}
          </div>
        </div>

        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0"><div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Alertas
              </p>
              <span className="text-sm font-bold text-text-100">{deviceAlerts?.length || 0}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
            {deviceAlerts && deviceAlerts.length > 0 ? (
              deviceAlerts.map((alert: any) => (
                <div key={alert.id}
                  className={`flex items-start gap-1.5 text-[11px] leading-tight rounded px-1.5 py-1 border-s-2 ${
                    alert.type === 'critica' || alert.type === 'apertura' ? 'border-red-500/40 bg-red-500/8' : 'border-yellow-500/40 bg-yellow-500/8'
                  } ${alert.status === 'resolved' ? 'opacity-50' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${alert.type === 'critica' || alert.type === 'apertura' ? 'bg-red-500' : 'bg-yellow-500'} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] font-semibold uppercase text-text-300">{alert.type}</span>
                      <span className="ml-auto text-[10px] font-medium text-text-200 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                    </div>
                    {alert.metadata?.reason && <p className="text-[10px] leading-tight mt-0.5">{alert.metadata.reason}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px]">Sin alertas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
