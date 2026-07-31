import { useMemo } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useMonitorDeviceTelemetry, useMonitorDeviceAlerts, useMonitorGatewayPositions } from "../../../hooks/useMonitor";
import MonitorTelemetryMap from "../MonitorTelemetryMap";
import { MonitorChartTooltip } from "../../shared/MonitorChartTooltip";
import { formatBattery, batteryColor } from "../../../utils/battery";
import MonitorBatteryPopup from "../../shared/MonitorBatteryPopup";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui: string;
  latitude_current?: number | null;
  longitude_current?: number | null;
  range: string;
  telemetryData: any;
  isLoading: boolean;
  activeGatewayIds: string[];
  chartData: any[];
  gatewayNames: string[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export default function MonitorGpsDetailPanel({
  deviceId, deviceName, latitude_current, longitude_current,
  telemetryData, isLoading, activeGatewayIds,
  chartData, gatewayNames, onExportCSV, onExportPDF
}: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: gatewayPositions } = useMonitorGatewayPositions();
  const lastT = telemetryData?.telemetry?.[0];

  const gwNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (gatewayPositions || []).forEach(gw => {
      if (gw.dev_eui) map.set(gw.dev_eui, gw.name);
      if (gw.dev_eui?.length >= 6) map.set(gw.dev_eui.slice(-6), gw.name);
    });
    return map;
  }, [gatewayPositions]);

  return (
    <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
      <div className="grid grid-rows-2 gap-2 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-100 uppercase tracking-wider">Registros</span>
                <button onClick={onExportCSV} className="text-[10px] hover:text-brand-200 px-1.5 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar CSV">CSV</button>
                <button onClick={onExportPDF} className="text-[10px] hover:text-brand-200 px-1.5 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar PDF">PDF</button>
              </div>
              <span className="text-sm font-bold text-text-100">{telemetryData?.telemetry?.length || 0}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-2 px-2 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Bat<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                  <th className="text-left py-2 px-2 font-medium">°C</th>
                  <th className="text-left py-2 px-2 font-medium">Mov</th>
                  <th className="text-left py-2 px-2 font-medium">Gateways</th>
                </tr>
              </thead>
              <tbody>
                {telemetryData?.telemetry?.map((t: any, i: number) => (
                  <tr key={t.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                    <td className="py-1.5 px-2 text-text-200 font-mono text-[10px] whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-text-100">{formatBattery(t.object?.voltage_mV)}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-text-100">{t.object?.temperature_C != null ? <span>{t.object.temperature_C}°</span> : <span className="text-text-300">—</span>}</td>
                    <td className="py-1.5 px-2">
                      {t.object?.packetType?.startsWith?.('COMMAND')
                        ? <span className="text-cyan-400 font-semibold text-[10px]" title={t.object.systemMessage || ''}>{t.object.systemMessage || t.object.packetType}</span>
                        : t.object?.packetType === 'CONFIG_REPORT'
                          ? <span className="text-purple-400 font-semibold text-[10px]">Config Report</span>
                          : t.object?.packetType === 'QA_VALIDATION'
                            ? <span className="text-purple-400 font-semibold text-[10px]">QA Validación</span>
                            : t.object?.systemStatus?.freeFallFlag ? <span className="text-red-400" title="Caída libre">●</span>
                              : t.object?.systemStatus?.motionFlag ? <span className="text-yellow-400" title="Movimiento">●</span>
                                : t.object?.voltage_mV != null && t.object?.temperature_C != null ? <span className="text-green-400" title="KeepAlive">●</span>
                                  : <span className="text-text-300">○</span>}
                    </td>
                    <td className="py-1.5 px-2">
                      {Array.isArray(t.rxinfo) && t.rxinfo.length > 0
                        ? <span className="flex items-center gap-1 flex-wrap">{t.rxinfo.map((gw: any, gi: number) => {
                            const name = gwNameMap.get(gw.gatewayId) || gwNameMap.get(gw.gatewayId?.slice(-6)) || gw.gatewayId?.slice(-6) || `GW${gi + 1}`;
                            return <span key={gi} className="text-[10px] bg-bg-300/40 px-1 py-0.5 rounded font-mono text-text-200">{name}</span>;
                          })}</span>
                        : <span className="text-text-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && (!telemetryData?.telemetry || telemetryData.telemetry.length === 0) &&
              <p className="text-center text-[11px] py-6">Sin registros</p>}
            {isLoading &&
              <div className="flex justify-center py-4"><span className="text-[10px] text-brand-200 animate-pulse">Cargando...</span></div>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-h-0">
          {chartData.length > 1 ? (
            <>
              {[
                {
                  id: 'bat-temp',
                  title: "Batería y Temperatura",
                  lines: (
                    <>
                      <defs>
                        <linearGradient id="gradVoltage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#07b3d1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#07b3d1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e64343" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#e64343" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="voltage" stroke="#07b3d1" strokeWidth={2} fill="url(#gradVoltage)" dot={false} connectNulls activeDot={{ r: 3, stroke: '#07b3d1', strokeWidth: 2, fill: '#1a1d23' }} name="Batería (mV)" animationDuration={600} />
                      <Area type="monotone" dataKey="temperature" stroke="#e64343" strokeWidth={2} fill="url(#gradTemp)" dot={false} connectNulls activeDot={{ r: 3, stroke: '#e64343', strokeWidth: 2, fill: '#1a1d23' }} name="Temperatura (°C)" animationDuration={600} />
                    </>
                  )
                },
                {
                  id: 'snr',
                  title: "SNR por Gateway",
                  lines: (
                    <>
                      {gatewayNames.map((gwId, i) => {
                        const palette = ['#07b3d1', '#e64343', '#a855f7', '#3b82f6', '#07b3d1', '#e64343', '#a855f7', '#3b82f6'];
                        const color = palette[i % palette.length];
                        const gradId = `gradSnr${i}`;
                        return (
                          <Area key={gwId} type="monotone" dataKey={`snr_${gwId}`} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} connectNulls activeDot={{ r: 3, stroke: color, strokeWidth: 2, fill: '#1a1d23' }} name={gwId} animationDuration={600} />
                        );
                      })}
                      <defs>
                        {gatewayNames.map((gwId, i) => {
                          const palette = ['#07b3d1', '#e64343', '#a855f7', '#3b82f6', '#07b3d1', '#e64343', '#a855f7', '#3b82f6'];
                          const color = palette[i % palette.length];
                          return (
                            <linearGradient key={gwId} id={`gradSnr${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                    </>
                  )
                },
                {
                  id: 'rssi',
                  title: "RSSI por Gateway",
                  lines: (
                    <>
                      {gatewayNames.map((gwId, i) => {
                        const palette = ['#07b3d1', '#e64343', '#a855f7', '#3b82f6', '#07b3d1', '#e64343', '#a855f7', '#3b82f6'];
                        const color = palette[i % palette.length];
                        const gradId = `gradRssi${i}`;
                        return (
                          <Area key={gwId} type="monotone" dataKey={`rssi_${gwId}`} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} connectNulls activeDot={{ r: 3, stroke: color, strokeWidth: 2, fill: '#1a1d23' }} name={gwId} animationDuration={600} />
                        );
                      })}
                      <defs>
                        {gatewayNames.map((gwId, i) => {
                          const palette = ['#07b3d1', '#e64343', '#a855f7', '#3b82f6', '#07b3d1', '#e64343', '#a855f7', '#3b82f6'];
                          const color = palette[i % palette.length];
                          return (
                            <linearGradient key={gwId} id={`gradRssi${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                    </>
                  )
                },
              ].map(chart => (
                <div key={chart.id} className="flex-1 min-h-0 flex flex-col">
                  <div className="bg-bg-100/80 border border-border/30 rounded-xl p-2.5 shadow-sm flex flex-col flex-1 min-h-0 backdrop-blur-sm">
                      <p className="text-[11px] font-bold text-text-100 pl-2 mb-1 shrink-0 tracking-wider uppercase">{chart.title}</p>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} interval="preserveStartEnd" minTickGap={30} />
                          <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={32} />
                          <Tooltip content={<MonitorChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                          <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }} verticalAlign="top" iconType="circle" iconSize={7} />
                          {chart.lines}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              {isLoading
                ? <span className="text-[11px] text-brand-200 animate-pulse">Cargando datos...</span>
                : <p className="text-[13px]">Selecciona un rango mayor para ver gráficos</p>
              }
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-rows-2 gap-2 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold text-text-100 uppercase tracking-wider">
                Cobertura &darr; Gateways
                {activeGatewayIds.length > 0 && (
                  <span className="font-normal normal-case ml-1">· {activeGatewayIds.length} enlaces</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex-1 relative min-h-0">
            <MonitorTelemetryMap
              devicePosition={latitude_current != null && longitude_current != null
                ? { lat: latitude_current, lng: longitude_current }
                : null}
              deviceName={deviceName}
              gateways={gatewayPositions}
              activeGatewayIds={activeGatewayIds.length > 0 ? activeGatewayIds : undefined}
            />
          </div>
        </div>

        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Alertas del dispositivo
              </p>
              <span className="text-sm font-bold text-text-100">{deviceAlerts?.length || 0}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {deviceAlerts && deviceAlerts.length > 0 ? (
              deviceAlerts.map((alert: any) => {
                const typeColors: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
                  critica:            { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                  atencion:           { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                  apertura:           { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Apertura' },
                  presencia:          { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Presencia' },
                  movimientos_anomalos: { bg: 'bg-purple-500/8', border: 'border-purple-500/40', dot: 'bg-purple-500', text: 'text-purple-300', label: 'Mov. anómalo' },
                  desconexionGW:      { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'GW desconectado' },
                };
                const c = typeColors[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-300', label: alert.type };
                const isResolved = alert.status === 'resolved' || alert.status_system === 'resolved';

                return (
                  <div key={alert.id}
                    className={`flex items-start gap-2 text-[12px] leading-snug rounded px-2 py-1.5 border-s-2 ${c.border} ${c.bg} ${isResolved ? 'opacity-50' : ''}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot} ${isResolved ? '' : 'animate-pulse'} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase ${c.text}`}>{c.label}</span>
                        {isResolved && <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 rounded">Resuelta</span>}
                        {alert.status_system === 'active' && alert.type === 'critica' && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 rounded">Activa</span>
                        )}
                                                <span className="ml-auto text-[10px] font-medium text-text-200 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      {alert.metadata?.reason && <p className="text-[11px] leading-snug mt-1">{alert.metadata.reason}</p>}
                      {alert.user_reason && <p className="text-[10px] italic mt-1">"{alert.user_reason}"</p>}
                      {alert.resolved_at && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-green-500/60">Resuelta: {format(new Date(alert.resolved_at), "dd/MM HH:mm")}</span>
                          {alert.resolved_by_name && <span className="text-[10px] text-text-300">por {alert.resolved_by_name}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-[13px]">Sin alertas</p>
                  <p className="text-[10px] mt-1">Este dispositivo no tiene alertas registradas</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
