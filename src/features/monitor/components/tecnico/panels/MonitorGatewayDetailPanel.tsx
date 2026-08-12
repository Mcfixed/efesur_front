import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDeviceAlerts, useMonitorGatewayPositions } from "../../../hooks/useMonitor";
import { IconAntennaBars3, IconWifi, IconAlertTriangle } from "@tabler/icons-react";
import MonitorTelemetryMap from "../MonitorTelemetryMap";
import MonitorLectorDashboard from "./MonitorLectorDashboard";
import { cleanVoltage, cleanCurrent, cleanPower, cleanState, cleanTemp } from "../../../utils/mppt";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui?: string;
  lastSeen?: string | null;
  lastTs?: string | null;
  range?: string;
  onRangeChange?: (range: string) => void;
}

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export default function MonitorGatewayDetailPanel({ deviceId, deviceName, deviceEui, lastSeen, lastTs, range = '7d', onRangeChange }: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: allDevices } = useMonitorDevices();
  const { data: gatewayPositions } = useMonitorGatewayPositions();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);

  // Lector device ID asociado al gateway
  const lectorDeviceId = useMemo(() => {
    if (!allDevices) return null;
    const gw = allDevices.find((d: any) => d.id === deviceId);
    return gw?.id_device_father || null;
  }, [allDevices, deviceId]);

  const lectorAsignadoName = useMemo(() => {
    if (!lectorDeviceId || !allDevices) return null;
    const l = allDevices.find((d: any) => d.id === lectorDeviceId);
    return l?.name || null;
  }, [lectorDeviceId, allDevices]);

  const { data: lectorAlerts } = useMonitorDeviceAlerts(lectorDeviceId);

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
    const desconexiones = (deviceAlerts || []).filter((a: any) => a.type === 'desconexionGW' || a.type === 'desconexion220' || a.type === 'desconexionbatGW')
      .filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= rangeStart);
    const currentlyOnline = !!lastSeen && (now - new Date(lastSeen).getTime() < 300000);
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

  // ── Lector asignado (vía id_device_father) ──
  const lectorData = useMemo(() => {
    if (!allDevices || !latestTelemetry) return null;
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    // Find this gateway device
    const gwDevice = allDevices.find((d: any) => d.id === deviceId);
    if (!gwDevice?.id_device_father) return null;
    // Find the lector device
    const lector = allDevices.find((d: any) => d.id === gwDevice.id_device_father);
    if (!lector) return null;
    // Filter telemetry for this lector
    const tel = telemetry.filter((t: any) =>
      t.dev_eui?.toLowerCase() === lector.dev_eui.toLowerCase() || t.device_id === lector.id
    );
    if (!tel.length) return null;
    const lastT = tel.find((t: any) => t.object?.Mppt) || tel[0];
    const obj = lastT?.object || {};
    const mppt = obj.Mppt || {};
    const security = obj.Security || {};
    const blueSmart = obj.BlueSmartIP67 || {};
    return {
      lectorName: lector.name,
      lectorEui: lector.dev_eui,
      vBat: cleanVoltage(mppt.batteryVoltage_V) ?? cleanVoltage(blueSmart.voltaje_V) ?? null,
      pPan: cleanPower(mppt.panelPower_W) ?? null,
      iBat: cleanCurrent(mppt.batteryCurrent_A) ?? null,
      temp: cleanTemp(mppt.internalTemp_C) ?? cleanTemp(obj.Environment?.temperatura_C) ?? null,
      sensores: security,
      charger220: blueSmart,
      loadState: cleanState(mppt.loadState) ?? null,
      batPct: mppt.batteryVoltage_V != null && mppt.batteryVoltage_V < 500 ? Math.max(0, Math.min(100, ((mppt.batteryVoltage_V - 11) / (15 - 11)) * 100)) : null,
      lastTs: lastT?.ts || null,
    };
  }, [allDevices, latestTelemetry, deviceId]);

  // Merge gateway alerts + lector alerts
  const mergedAlerts = useMemo(() => {
    const gw = Array.isArray(deviceAlerts) ? deviceAlerts : [];
    const lec = Array.isArray(lectorAlerts) ? lectorAlerts : [];
    const all = [...gw, ...lec];
    all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }, [deviceAlerts, lectorAlerts]);

  const [activeTab, setActiveTab] = useState<"resumen" | "mapa" | "lector_asignado">("resumen");
  const tabs = [
    { key: "resumen" as const, label: "Resumen" },
    { key: "mapa" as const, label: "Cobertura" },
    { key: "lector_asignado" as const, label: "Lector asignado" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-1.5">
      <div className="flex gap-1 bg-bg-100 border-b border-border shrink-0 self-start w-full">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.key ? 'border-brand-100 text-brand-100' : 'border-transparent text-text-200 hover:text-text-100'}`}>{t.label}</button>
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
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                        <th className="text-left py-2 px-2 font-medium">Dispositivo</th>
                        <th className="text-left py-2 px-2 font-medium">Hora</th>
                        <th className="text-center py-2 px-2 font-medium">GW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gatewayRecords.map((r: any, i: number) => (
                        <tr key={r.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                          <td className="py-1.5 px-2 text-text-100 truncate max-w-28 font-medium">{r.device_name || r.dev_eui}</td>
                          <td className="py-1.5 px-2 text-text-300 font-mono text-[10px] whitespace-nowrap">{format(new Date(r.ts), "HH:mm:ss")}</td>
                          <td className="py-1.5 px-2 text-center text-text-300 text-[10px]">{Array.isArray(r.rxinfo) ? r.rxinfo.length : '—'}</td>
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
                  <span className={`w-2 h-2 rounded-full ${lastSeen && Date.now() - new Date(lastSeen).getTime() < 300000 ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-[10px] font-bold text-text-100 uppercase tracking-wider">Estado del Sistema</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${lectorDeviceId ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                    {lectorDeviceId ? 'Lector asignado' : 'Sin lector asignado'}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-2 flex items-center justify-center min-h-0">
                <svg width="100%" height="100%" viewBox="0 0 260 180" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: '100%' }}>
                  <style>{`@keyframes gwFlow{to{stroke-dashoffset:-16}}`}</style>

                  {/* Gateway UG65 */}
                  <g transform="translate(80, 6)">
                    <rect x="0" y="0" width="100" height="36" rx="6" fill="none" stroke={lastSeen && Date.now() - new Date(lastSeen).getTime() < 300000 ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
                    <line x1="50" y1="0" x2="50" y2="-8" stroke="#888" strokeWidth="1.5" />
                    <line x1="46" y1="-4" x2="54" y2="-4" stroke="#888" strokeWidth="1" />
                    <circle cx="12" cy="10" r="3" fill={lastSeen && Date.now() - new Date(lastSeen).getTime() < 300000 ? '#22c55e' : '#ef4444'} />
                    <text x="50" y="15" textAnchor="middle" fill="#e0e0e0" fontSize="9" fontWeight="bold">UG65</text>
                    <text x="50" y="27" textAnchor="middle" fill="#888" fontSize="6">GATEWAY</text>
                    <text x="80" y="46" textAnchor="middle" fill={lastSeen && Date.now() - new Date(lastSeen).getTime() < 300000 ? '#22c55e' : '#ef4444'} fontSize="7" fontWeight="bold">
                      {lastSeen && Date.now() - new Date(lastSeen).getTime() < 300000 ? '● ONLINE' : '● OFFLINE'}
                    </text>
                  </g>

                  {/* Battery card — lector (gris si no hay lector) */}
                  <g transform="translate(12, 68)" opacity={lectorDeviceId ? 1 : 0.35}>
                    <rect x="0" y="0" width="110" height="44" rx="5" fill="none" stroke="#555" strokeWidth="0.8" opacity="0.5" />
                    <text x="55" y="10" textAnchor="middle" fill="#888" fontSize="6" fontWeight="bold">BATERÍA {lectorData ? `· ${lectorAsignadoName || lectorData.lectorName}` : ''}</text>
                    {/* Battery icon */}
                    <rect x="8" y="16" width="20" height="12" rx="2" fill="none" stroke={lectorData?.vBat != null ? (lectorData.vBat >= 12.5 ? '#22c55e' : lectorData.vBat >= 11.8 ? '#f97316' : '#ef4444') : '#555'} strokeWidth="1" />
                    <rect x="28" y="19" width="3" height="6" rx="0.5" fill={lectorData?.vBat != null ? (lectorData.vBat >= 12.5 ? '#22c55e' : lectorData.vBat >= 11.8 ? '#f97316' : '#ef4444') : '#555'} />
                    <rect x="10" y="18" width={lectorData?.batPct != null ? `${Math.min(lectorData.batPct, 100) * 0.16}` : 0} height="8" rx="1" fill={lectorData?.vBat != null ? (lectorData.vBat >= 12.5 ? '#22c55e' : lectorData.vBat >= 11.8 ? '#f97316' : '#ef4444') : '#555'} opacity="0.35" />
                    <text x="46" y="24" textAnchor="middle" fill="#e0e0e0" fontSize="8" fontFamily="monospace" fontWeight="bold">
                      {lectorData?.batPct != null ? `${Math.round(lectorData.batPct)}%` : '—'}
                    </text>
                    <text x="46" y="36" textAnchor="middle" fill="#aaa" fontSize="6" fontFamily="monospace">
                      {lectorData?.vBat != null ? `${lectorData.vBat.toFixed(2)}V` : 'Sin datos'}
                    </text>
                  </g>

                  {/* Power source + temp card — lector (gris si no hay lector) */}
                  <g transform="translate(138, 68)" opacity={lectorDeviceId ? 1 : 0.35}>
                    <rect x="0" y="0" width="110" height="44" rx="5" fill="none" stroke="#555" strokeWidth="0.8" opacity="0.5" />
                    <text x="55" y="10" textAnchor="middle" fill="#888" fontSize="6" fontWeight="bold">ALIMENTACIÓN</text>
                    {/* Charger 220V indicator */}
                    <circle cx="20" cy="22" r="4" fill={lectorData?.charger220?.estado ? '#22c55e' : '#3b82f6'} opacity={lectorData?.charger220?.estado ? 0.8 : 0.5} />
                    <text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="bold">~</text>
                    <text x="32" y="25" textAnchor="middle" fill={lectorData?.charger220?.estado ? '#22c55e' : '#aaa'} fontSize="6">
                      {lectorData?.charger220?.estado || 'CA 220V'}
                    </text>
                    {/* Temperature */}
                    <text x="55" y="37" textAnchor="middle" fill="#aaa" fontSize="6">
                      Temp:{lectorData?.temp != null
                        ? ` ${lectorData.temp.toFixed(1)}°C`
                        : solarChartData.length > 0 && solarChartData[solarChartData.length - 1].temp != null
                          ? ` ${solarChartData[solarChartData.length - 1].temp.toFixed(1)}°C`
                          : ' —'}
                    </text>
                  </g>

                  {/* Sensors card — lector + gateway (gris si no hay lector) */}
                  <g transform="translate(12, 120)" opacity={lectorDeviceId ? 1 : 0.35}>
                    <rect x="0" y="0" width="236" height="28" rx="5" fill="none" stroke="#555" strokeWidth="0.8" opacity="0.5" />
                    <text x="118" y="10" textAnchor="middle" fill="#888" fontSize="6" fontWeight="bold">SENSORES</text>
                    {/* Door sensor */}
                    <rect x="14" y="14" width="8" height="10" rx="1" fill="none" stroke={lectorData?.sensores?.doorState === 1 ? '#ef4444' : '#22c55e'} strokeWidth="0.8" />
                    <circle cx="18" cy="19" r="1.5" fill={lectorData?.sensores?.doorState === 1 ? '#ef4444' : '#22c55e'} />
                    <text x="26" y="22" fill="#aaa" fontSize="6">Puerta: {lectorData?.sensores?.doorState === 1 ? 'OPEN' : lectorData?.sensores?.doorState === 0 ? 'CLOSED' : '—'}</text>
                    {/* Proximity sensor */}
                    <circle cx="100" cy="19" r="4" fill="none" stroke={lectorData?.sensores?.pirState === 1 ? '#eab308' : '#6b7280'} strokeWidth="0.8" />
                    <circle cx="100" cy="19" r="1.5" fill={lectorData?.sensores?.pirState === 1 ? '#eab308' : '#6b7280'} />
                    <text x="108" y="22" fill="#aaa" fontSize="6">Prox: {lectorData?.sensores?.pirState === 1 ? 'DET' : lectorData?.sensores?.pirState === 0 ? 'CLEAR' : '—'}</text>
                    {/* Uptime */}
                    <text x="190" y="22" fill="#888" fontSize="6">{uptimePct}% uptime</text>
                  </g>
                </svg>
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
                  const m: any[] = [0]; for (let i = 10; i <= 60; i += 10) { const d = new Date(Date.now() - i * 86400000); m.push(<span key={i}>{format(d, "dd/MM")}</span>); } return m;
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
                  <span className="text-sm font-bold text-text-100">{mergedAlerts.filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= (Date.now() - rangeHours * 3600000)).length || 0}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
                {mergedAlerts.length > 0 ? (
                  mergedAlerts.filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= (Date.now() - rangeHours * 3600000))
                    .map((alert: any) => {
                      const alertTypeMap: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
                        critica: { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                        atencion: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                        apertura: { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Apertura' },
                        presencia: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Presencia' },
                        desconexionGW: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión' },
                        desconexionGPS: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión GPS' },
                        desconexion220: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión CA 220' },
                        desconexionbatGW: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión Batería GW' },
                      };
                      const c = alertTypeMap[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-300', label: alert.type };
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
                          {alert.device_name && alert.type !== 'desconexionGW' && <p className="text-[9px] text-text-400 mt-0.5">{alert.device_name}</p>}
                        </div>
                      </div>;
                    })
                ) : (
                  <div className="flex items-center justify-center h-full flex-col">
                    <p className="text-[13px] text-text-300">Sin alertas</p>
                    <p className="text-[10px] mt-1 text-text-400">No hay eventos registrados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "lector_asignado" && (
        <MonitorLectorDashboard lectorDeviceId={allDevices?.find((d: any) => d.id === deviceId)?.id_device_father ?? null} gatewayLastSeen={lastSeen} gatewayName={deviceName} />
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
