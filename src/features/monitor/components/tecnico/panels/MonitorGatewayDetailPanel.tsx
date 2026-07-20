import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { useMonitorDeviceTelemetry, useMonitorDeviceAlerts, useMonitorDevices, useMonitorGatewayPositions, useMonitorLatestTelemetry } from "../../../hooks/useMonitor";
import { IconAntennaBars3, IconWifi, IconSolarPanel, IconBattery, IconPlug, IconDoor, IconEye, IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react";
import MonitorTelemetryMap from "../MonitorTelemetryMap";
import { formatBattery, voltageToPercent } from "../../../utils/battery";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui?: string;
  lastSeen?: string | null;
  lastTs?: string | null;
  range?: string;
  onRangeChange?: (range: string) => void;
}

export default function MonitorGatewayDetailPanel({ deviceId, deviceName, deviceEui, lastSeen, lastTs, range = '7d', onRangeChange }: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: allDevices } = useMonitorDevices();
  const { data: gatewayPositions } = useMonitorGatewayPositions();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(100);

  const connectedDeviceEuis = useMemo(() => {
    const devEuiSet = new Set<string>();
    const gwIdShort = deviceName?.slice(-6)?.toLowerCase();
    const euiShort = deviceEui?.slice(-6)?.toLowerCase();
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    (telemetry as any[]).forEach((t: any) => {
      if (Array.isArray(t.rxinfo)) {
        t.rxinfo.forEach((gw: any) => {
          const rxGwId = (gw.gatewayId || '').toLowerCase();
          if (rxGwId === deviceName?.toLowerCase() ||
              rxGwId === deviceEui?.toLowerCase() ||
              rxGwId.endsWith(gwIdShort) ||
              rxGwId.endsWith(euiShort) ||
              (gwIdShort && rxGwId.includes(gwIdShort))) {
            devEuiSet.add(t.device_id || t.dev_eui);
          }
        });
      }
    });
    return [...devEuiSet];
  }, [latestTelemetry, deviceName, deviceEui]);

  const connectedDevicesData = useMemo(() => {
    if (!allDevices || !connectedDeviceEuis.length) return [];
    const euiSet = new Set(connectedDeviceEuis.map(id => String(id).toLowerCase()));
    return allDevices.filter((d: any) =>
      euiSet.has(d.dev_eui?.toLowerCase()) || euiSet.has(String(d.id))
    );
  }, [allDevices, connectedDeviceEuis]);

  const connectedDevicesCount = connectedDevicesData.length;

  const sensorsData = useMemo(() => {
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    if (!telemetry.length || !allDevices || !connectedDevicesData.length) return [];
    const euiLower = deviceEui?.toLowerCase() || '';
    const nameLower = deviceName?.toLowerCase() || '';
    const short6 = euiLower.slice(-6);

    const deviceMap = new Map(allDevices.map((d: any) => [d.id, d]));
    const seen = new Set();
    const result: any[] = [];

    (telemetry as any[]).forEach((t: any) => {
      if (!Array.isArray(t.rxinfo)) return;
      const gwEntry = t.rxinfo.find((gw: any) => {
        const id = (gw.gatewayId || '').toLowerCase();
        return id === euiLower || id === nameLower || id.endsWith(short6) || (short6 && id.includes(short6));
      });
      if (!gwEntry) return;
      const device = deviceMap.get(t.device_id);
      if (!device || seen.has(device.id)) return;
      seen.add(device.id);
      result.push({
        id: device.id,
        name: device.name,
        dev_eui: device.dev_eui,
        lat: device.latitude_current ? Number(device.latitude_current) : null,
        lng: device.longitude_current ? Number(device.longitude_current) : null,
        snr: gwEntry.snr ?? null,
        rssi: gwEntry.rssi ?? null,
        ts: t.ts,
      });
    });

    return result;
  }, [latestTelemetry, allDevices, connectedDevicesData, connectedDeviceEuis, deviceEui, deviceName]);

  const gatewayPosition = useMemo(() => {
    if (!gatewayPositions) return null;
    const gw = gatewayPositions.find((g: any) =>
      g.dev_eui === deviceEui ||
      g.dev_eui === deviceName ||
      g.name === deviceName ||
      g.dev_eui?.slice(-6) === deviceEui?.slice(-6)
    );
    if (!gw || !gw.latitude_current || !gw.longitude_current) return null;
    return { lat: Number(gw.latitude_current), lng: Number(gw.longitude_current) };
  }, [gatewayPositions, deviceName, deviceEui]);

  const RANGES = [
    { key: '24h', label: '24H', hours: 24 },
    { key: '7d', label: '7 Días', hours: 168 },
    { key: '30d', label: '30 Días', hours: 720 },
    { key: 'total', label: 'Todo', hours: 0 },
  ];

  const rangeHours = RANGES.find(r => r.key === range)?.hours ?? 168;

  const timelineData = useMemo(() => {
    const now = Date.now();
    const rangeStart = rangeHours > 0 ? now - rangeHours * 3600000 : 0;
    const desconexiones = (deviceAlerts || []).filter((a: any) => a.type === 'desconexionGW')
      .filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= rangeStart);
    const currentlyOnline = !!lastSeen && (now - new Date(lastSeen).getTime() < 86400000);
    const segments: { start: number; end: number; online: boolean }[] = [];
    let cursor = rangeStart;
    const sorted = [...desconexiones].sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const alert of sorted) {
      const alertStart = new Date(alert.created_at).getTime();
      const alertEnd = alert.resolved_at
        ? new Date(alert.resolved_at).getTime()
        : now;
      if (alertEnd <= alertStart) continue;
      const effectiveStart = Math.max(cursor, alertStart);
      if (effectiveStart >= alertEnd) continue;
      if (alertStart > cursor + 60000) {
        segments.push({ start: cursor, end: alertStart, online: true });
      }
      segments.push({ start: effectiveStart, end: alertEnd, online: false });
      cursor = alertEnd;
    }
    if (cursor < now) {
      segments.push({ start: cursor, end: now, online: currentlyOnline });
    }
    return segments;
  }, [deviceAlerts, lastSeen, rangeHours]);

  const uptimePct = useMemo(() => {
    const total = timelineData.reduce((s, seg) => s + (seg.end - seg.start), 0);
    const online = timelineData.filter(s => s.online).reduce((s, seg) => s + (seg.end - seg.start), 0);
    return total > 0 ? Math.round((online / total) * 100) : 100;
  }, [timelineData]);

  const gatewayRecords = useMemo(() => {
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    if (!telemetry.length) return [];
    const euiLower = deviceEui?.toLowerCase() || '';
    const nameLower = deviceName?.toLowerCase() || '';
    const short6 = euiLower.slice(-6);
    return (telemetry as any[]).filter((t: any) =>
      Array.isArray(t.rxinfo) && t.rxinfo.some((gw: any) => {
        const id = (gw.gatewayId || '').toLowerCase();
        return id === euiLower || id === nameLower || id.endsWith(short6) || (short6 && id.includes(short6));
      })
    ).slice(0, 20);
  }, [latestTelemetry, deviceEui, deviceName]);

  const solarChartData = useMemo(() => {
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    if (!telemetry.length) return [];
    const euiLower = deviceEui?.toLowerCase() || '';
    const nameLower = deviceName?.toLowerCase() || '';
    const short6 = euiLower.slice(-6);
    const records = (telemetry as any[]).filter((t: any) =>
      Array.isArray(t.rxinfo) && t.rxinfo.some((gw: any) => {
        const id = (gw.gatewayId || '').toLowerCase();
        return id === euiLower || id === nameLower || id.endsWith(short6) || (short6 && id.includes(short6));
      })
    ).reverse();
    return records.map((r: any) => ({
      time: format(new Date(r.ts), "HH:mm"),
      volt: r.object?.voltage_mV ? +(r.object.voltage_mV / 1000).toFixed(2) : null,
      temp: r.object?.temperature_C ?? null,
    }));
  }, [latestTelemetry, deviceEui, deviceName]);

  const [activeTab, setActiveTab] = useState<"resumen" | "mapa" | "lector_asignado">("resumen");
  const tabs = [
    { key: "resumen" as const, label: "Resumen" },
    { key: "mapa" as const, label: "Cobertura" },
    { key: "lector_asignado" as const, label: "Lector asignado" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-1.5">
      <div className="flex gap-1 bg-bg-300/30 p-0.5 rounded-lg shrink-0 self-start">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${activeTab === t.key ? 'bg-white/15 text-text-100 shadow-sm border border-white/10' : 'text-text-300 hover:text-text-200'}`}>{t.label}</button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="flex-1 grid grid-rows-[3fr_2fr] gap-1.5 min-h-0">
          <div className="grid grid-cols-3 gap-1.5 min-h-0">
            <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
              <div className="border-b border-border/30 shrink-0 px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                    <IconAntennaBars3 size={14} className="text-blue-400" /> Últimos registros
                  </p>
                  <span className="text-xs font-bold text-text-100">{gatewayRecords.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {gatewayRecords.length > 0 ? (
                  <table className="w-full text-[10px]">
                    <thead className="text-text-300 sticky top-0 bg-bg-100">
                      <tr className="border-b border-border/20">
                        <th className="text-left px-2 py-1 font-medium">Dispositivo</th>
                        <th className="text-left px-2 py-1 font-medium">Hora</th>
                        <th className="text-center px-1 py-1 font-medium">GW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gatewayRecords.map((r: any) => (
                        <tr key={r.id} className="border-b border-border/10 hover:bg-bg-300/20">
                          <td className="px-2 py-1 text-text-200 truncate max-w-28">{r.device_name || r.dev_eui}</td>
                          <td className="px-2 py-1 text-text-300 font-mono whitespace-nowrap">{format(new Date(r.ts), "HH:mm:ss")}</td>
                          <td className="px-1 py-1 text-center text-text-300">{Array.isArray(r.rxinfo) ? r.rxinfo.length : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="flex items-center justify-center h-full"><p className="text-[11px] text-text-300">Sin registros</p></div>}
              </div>
            </div>
            <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
              <div className="border-b border-border/30 shrink-0 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <IconSolarPanel size={14} className="text-yellow-400" />
                  <span className="text-[10px] font-bold text-text-100 uppercase tracking-wider">Panel Solar</span>
                </div>
              </div>
              <div className="flex-1 p-2 flex flex-col gap-1.5 min-h-0">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-text-300 font-medium flex items-center gap-1"><IconBattery size={10} className="text-green-400" /> Batería</span>
                    <span className="text-[9px] font-bold font-mono text-green-400">{solarChartData.length > 0 && solarChartData[solarChartData.length - 1].volt !== null ? formatBattery(solarChartData[solarChartData.length - 1].volt * 1000) : '—'}</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    {solarChartData.some(d => d.volt !== null) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={solarChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="solarBat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                          <Area type="monotone" dataKey="volt" stroke="#22c55e" strokeWidth={1.5} fill="url(#solarBat)" dot={false} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-[9px] text-text-300">Sin datos</div>}
                  </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-text-300 font-medium">Temperatura</span>
                    <span className="text-[9px] font-bold font-mono text-cyan-400">{solarChartData.length > 0 && solarChartData[solarChartData.length - 1].temp !== null ? `${solarChartData[solarChartData.length - 1].temp}°C` : '—'}</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    {solarChartData.some(d => d.temp !== null) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={solarChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="solarTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
                          <Area type="monotone" dataKey="temp" stroke="#2dd4bf" strokeWidth={1.5} fill="url(#solarTemp)" dot={false} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-[9px] text-text-300">Sin datos</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
              <div className="border-b border-border/30 shrink-0 px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                    <IconWifi size={14} className="text-emerald-400" /> Conectados
                  </p>
                  <span className="text-lg font-bold text-text-100">{connectedDevicesCount}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                {connectedDevicesData.length > 0 ? (
                  <div className="space-y-1">
                    {connectedDevicesData.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-2 text-[10px] bg-bg-300/20 rounded px-2 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span className="text-text-200 truncate flex-1">{d.name}</span>
                        <span className="text-text-300 font-mono text-[9px]">{d.type_device}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="flex items-center justify-center h-full"><p className="text-[11px] text-text-300">Sin dispositivos</p></div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[40%_60%] gap-1.5 min-h-0">
            <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
              <div className="border-b border-border/30 shrink-0">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" /> Conectividad
                  </p>
                  <span className="text-sm font-bold text-green-400">{uptimePct}%</span>
                </div>
              </div>
              <div className="flex-1 p-3 flex flex-col justify-center min-h-0">
                <div className="flex h-6 rounded-md overflow-hidden mb-2">
                  {timelineData.map((seg, i) => {
                    const total = timelineData.reduce((s, seg) => s + (seg.end - seg.start), 0);
                    const pct = total > 0 ? ((seg.end - seg.start) / total) * 100 : 0;
                    return <div key={i} className={`${seg.online ? 'bg-green-400/60' : 'bg-red-400/60'} transition-all cursor-pointer`}
                      style={{ width: `${pct}%` }}
                      title={`${seg.online ? '🟢 Online' : '🔴 Offline'}\n${format(new Date(seg.start), "dd/MM/yyyy HH:mm:ss")} → ${format(new Date(seg.end), "dd/MM/yyyy HH:mm:ss")}\nDuración: ${Math.round((seg.end - seg.start) / 60000)} min`} />;
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-text-200 font-medium">{(() => {
                  if (rangeHours <= 24) return [0,6,12,18,24].map(h => { const d = new Date(Date.now() - (24 - h) * 3600000); return <span key={h}>{format(d, "HH:mm")}</span>; });
                  if (rangeHours <= 168) { const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']; return [6,5,4,3,2,1,0].map(i => { const d = new Date(Date.now() - i * 86400000); return <span key={i}>{days[d.getDay()]}</span>; }); }
                  if (rangeHours <= 720) { const m = []; for (let i = 0; i <= 30; i += 5) { const d = new Date(Date.now() - (30 - i) * 86400000); m.push(<span key={i}>{format(d, "dd/MM")}</span>); } return m; }
                  const m = [0]; for (let i = 10; i <= 60; i += 10) { const d = new Date(Date.now() - i * 86400000); m.push(<span key={i}>{format(d, "dd/MM")}</span>); } return m;
                })()}</div>
                <div className="flex items-center gap-4 mt-3 text-[11px]">
                  <span><span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" /><span className="font-semibold text-green-400">{Math.round(timelineData.filter(s => s.online).reduce((s, seg) => s + (seg.end - seg.start), 0) / 60000)} min</span> <span className="text-text-200">online</span></span>
                  <span><span className="w-2 h-2 rounded-full bg-red-400 inline-block mr-1" /><span className="font-semibold text-red-400">{Math.round(timelineData.filter(s => !s.online).reduce((s, seg) => s + (seg.end - seg.start), 0) / 60000)} min</span> <span className="text-text-200">offline</span></span>
                </div>
              </div>
            </div>
            <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
              <div className="border-b border-border/30 shrink-0">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Alertas
                  </p>
                  <span className="text-sm font-bold text-text-100">{deviceAlerts?.filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= (Date.now() - rangeHours * 3600000)).length || 0}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
                {deviceAlerts && deviceAlerts.length > 0 ? (
                  deviceAlerts.filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= (Date.now() - rangeHours * 3600000))
                    .map((alert: any) => {
                      const c = ({ critica: { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                        atencion: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                        desconexionGW: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión' },
                      }[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-300', label: alert.type });
                      const isResolved = alert.status === 'resolved' || alert.status_system === 'resolved';
                      return <div key={alert.id} className={`flex items-start gap-1.5 text-[11px] leading-tight rounded px-1.5 py-1 border-s-2 ${c.border} ${c.bg} ${isResolved ? 'opacity-50' : ''}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot} ${isResolved ? '' : 'animate-pulse'} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[9px] font-semibold uppercase ${c.text}`}>{c.label}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-medium text-text-100 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                            {alert.type === 'desconexionGW' && <><span className="text-[9px] text-text-300">→</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${alert.resolved_at ? 'text-green-300 bg-green-500/10' : 'text-red-300 bg-red-500/10'}`}>{alert.resolved_at ? format(new Date(alert.resolved_at), "dd/MM HH:mm") : 'Activo'}</span></>}
                          </div>
                          {alert.metadata?.reason && <p className="text-[10px] leading-tight mt-0.5 text-text-300">{alert.metadata.reason}</p>}
                        </div>
                      </div>;
                    })
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[13px]">Sin alertas</p>
                    <p className="text-[10px] mt-1">No hay eventos registrados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "lector_asignado" && (
        <LectorAsignadoContent deviceId={deviceId} />
      )}

      {activeTab === "mapa" && (
        <div className="flex-1 min-h-0">
          <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col h-full shadow">
            <div className="border-b border-border/30 shrink-0">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Cobertura — {connectedDevicesCount} sensores
                </p>
                <div className="flex items-center gap-2 text-[10px] text-text-300">
                  <span><span className="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1" />GW</span>
                  <span><span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" />Sensores</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-h-0">
                {gatewayPosition ? (
                  <MonitorTelemetryMap devicePosition={gatewayPosition} deviceName={deviceName} sensors={sensorsData} zoom={13} />
                ) : (
                  <div className="flex items-center justify-center h-full"><p className="text-[13px] text-text-300">Sin ubicación del gateway</p></div>
                )}
              </div>
              {sensorsData.length > 0 && (
                <div className="w-44 border-l border-border/30 overflow-y-auto p-2 space-y-1.5 shrink-0">
                  <p className="text-[9px] font-bold text-text-300 uppercase tracking-wider mb-2">Sensores</p>
                  {sensorsData.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${(s.rssi !== null ? (s.rssi < -120 ? 'bg-red-400' : s.rssi < -118 ? 'bg-yellow-400' : 'bg-green-400') : s.snr !== null ? (s.snr >= 10 ? 'bg-green-400' : s.snr >= 5 ? 'bg-yellow-400' : 'bg-red-400') : 'bg-gray-500')}`} />
                      <span className="text-text-200 truncate flex-1">{s.name}</span>
                      <span className="font-mono text-text-300 text-[9px]">{s.rssi !== null ? `${s.rssi.toFixed(0)}dBm` : s.snr !== null ? `${s.snr.toFixed(0)}dB` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// LECTOR ASIGNADO CONTENT
// ═══════════════════════════════════════════
function LectorAsignadoContent({ deviceId }: { deviceId: number }) {
  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);

  const lectores = useMemo(() => {
    if (!allDevices) return [];
    return allDevices.filter((d: any) => d.type_device === 'Lector');
  }, [allDevices]);

  if (lectores.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-400 text-[13px] min-h-50">
        <IconAlertTriangle size={18} className="mr-2 opacity-50" />
        No hay lectores en el sistema
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <IconPlug size={15} className="text-amber-400" />
        <span className="text-[10px] font-bold text-text-200 uppercase tracking-wider">
          Lectores ({lectores.length})
        </span>
      </div>
      {lectores.map((lector: any) => {
        const tel = (latestTelemetry || []).filter((t: any) =>
          t.dev_eui?.toLowerCase() === lector.dev_eui.toLowerCase() || t.device_id === lector.id
        );
        const lastT = tel?.[0];
        const obj = lastT?.object || {};
        const hasMppt = obj.mppt && Object.keys(obj.mppt).length > 0;
        const hasSalida220 = obj.salida_220 && Object.keys(obj.salida_220).length > 0;
        const hasDevices = obj.devices && Object.keys(obj.devices).length > 0;

        return (
          <div key={lector.id} className="bg-bg-100 border border-border/20 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/10">
              <IconPlug size={14} className="text-amber-400" />
              <span className="text-[12px] font-bold text-text-200">{lector.name}</span>
              <span className="text-[9px] text-text-400 font-mono">{lector.dev_eui}</span>
              {lastT?.ts && <span className="text-[9px] text-text-400 ml-auto">{format(new Date(lastT.ts), "dd/MM HH:mm")}</span>}
            </div>
            {hasMppt || hasSalida220 || hasDevices ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {hasMppt && <MpptMini data={obj.mppt} />}
                {hasSalida220 && <Salida220Mini data={obj.salida_220} />}
                {hasDevices && <DevicesMini data={obj.devices} />}
              </div>
            ) : (
              <p className="text-[11px] text-text-400 text-center py-3">
                {tel.length > 0 ? 'ℹ️ Datos disponibles sin campos MPPT/220V/Sensores' : '⏳ Sin datos de telemetría'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mini cards ───
function MpptMini({ data }: { data: any }) {
  const soc = data.state_of_charge ?? 0;
  const socColors = ['#6b7280','#ef4444','#f97316','#22c55e','#3b82f6'];
  const socLabels = ['—','Fault','Carga inicial','Absorción','Flotación'];
  return (
    <div className="bg-bg-200/30 rounded-lg p-2.5 border border-border/20">
      <p className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider mb-2">🔆 MPPT</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="text-text-400">Batería:</span><span className="font-bold font-mono text-green-400 text-right">{data.voltaje_bateria?.toFixed(2)}V</span>
        <span className="text-text-400">Panel:</span><span className="font-bold font-mono text-yellow-400 text-right">{data.voltaje_panel?.toFixed(1)}V</span>
        <span className="text-text-400">Potencia:</span><span className="font-bold font-mono text-yellow-400 text-right">{data.potencia_panel}W</span>
        <span className="text-text-400">Carga:</span><span className="font-bold font-mono text-right" style={{color: data.estado_carga === 'ON' ? '#22c55e' : '#ef4444'}}>{data.estado_carga || 'OFF'}</span>
        <span className="text-text-400">Salida:</span><span className="font-bold font-mono text-right" style={{color: data.estado_salida_carga === 'ON' ? '#22c55e' : '#6b7280'}}>{data.estado_salida_carga || 'OFF'}</span>
        <span className="text-text-400">SOC:</span><span className="font-bold font-mono text-right" style={{color: socColors[soc] || '#6b7280'}}>{socLabels[soc] || '—'}</span>
      </div>
    </div>
  );
}

function Salida220Mini({ data }: { data: any }) {
  const hasErr = data.error && data.error !== 'no error';
  return (
    <div className="bg-bg-200/30 rounded-lg p-2.5 border border-border/20">
      <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-2">🔌 220V</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="text-text-400">Estado:</span><span className="font-bold font-mono text-right" style={{color: data.estado === 'ALMACENAMIENTO' ? '#22c55e' : '#f97316'}}>{data.estado || '—'}</span>
        <span className="text-text-400">Batería:</span><span className="font-bold font-mono text-blue-400 text-right">{data.bateria_220_v?.toFixed(1)}V</span>
        <span className="text-text-400">Corriente:</span><span className="font-bold font-mono text-cyan-400 text-right">{data.corriente_220_v?.toFixed(2)}A</span>
        {hasErr && <><span className="text-text-400">Error:</span><span className="font-bold font-mono text-red-400 text-right">{data.error}</span></>}
      </div>
    </div>
  );
}

function DevicesMini({ data }: { data: any }) {
  const door = data.estado_sensor_puerta === 1;
  const prox = data.estado_sensor_proximidad === 1;
  return (
    <div className="bg-bg-200/30 rounded-lg p-2.5 border border-border/20">
      <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-2">👁 Sensores</p>
      <div className="flex gap-2">
        <div className={`flex-1 rounded-lg p-2 text-center ${door ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          <span className="block text-lg mb-0.5">🚪</span>
          <span className="text-[10px] font-bold" style={{color: door ? '#ef4444' : '#22c55e'}}>{door ? 'Abierta' : 'Cerrada'}</span>
        </div>
        <div className={`flex-1 rounded-lg p-2 text-center ${prox ? 'bg-yellow-500/10' : 'bg-gray-500/10'}`}>
          <span className="block text-lg mb-0.5">📡</span>
          <span className="text-[10px] font-bold" style={{color: prox ? '#eab308' : '#6b7280'}}>{prox ? 'Detectado' : 'Inactivo'}</span>
        </div>
      </div>
    </div>
  );
}
