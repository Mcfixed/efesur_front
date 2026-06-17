import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useSensorSummary, useDevicesList, useGpsDailyReview, useSearchDevices, useDeviceTelemetry, useDeviceAlerts, useGatewayPositions } from "../hooks/useTelemetry";
import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "../services/telemetry.service";
import { generateSensorReport } from "../utils/generateReport";
import { SectionDivider } from "../components/SectionDivider";
import { ChartTooltip } from "../components/ChartTooltip";
import { ChartCard } from "../components/ChartCard";
import { InfoRow } from "../components/InfoRow";
import TelemetryMap from "../components/TelemetryHeatMap";
import { IconWifi, IconMapPin, IconSearch, IconFileReport } from "@tabler/icons-react";
import type { DeviceSearchResult } from "../types/telemetry.types";

const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 Días", hours: 168 },
  { key: "30d", label: "30 Días", hours: 720 },
  { key: "total", label: "Todo", hours: 0 },
];

const DEVICE_TYPES = ["Gps", "Gateway", "SubEstacion", "Lector"];

const TYPE_COLORS: Record<string, string> = {
  Gps:         "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  Gateway:     "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  SubEstacion: "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  Lector:      "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
};

function exportCSV(telemetry: any[], name: string) {
  const rows = telemetry || [];
  if (!rows.length) return;
  const head = 'Fecha,Batería (V),Temperatura (°C),Movimiento,Gateways\n';
  const body = rows.map((t: any) => {
    const rx = Array.isArray(t.rxinfo) ? t.rxinfo.length : 0;
    const mov = t.object?.systemStatus?.motionFlag ? 'Sí' : 'No';
    const bat = t.object?.voltage_mV ? (t.object.voltage_mV / 1000).toFixed(2) : '—';
    const temp = t.object?.temperature_C != null ? t.object.temperature_C : '—';
    return `${format(new Date(t.ts), "yyyy-MM-dd HH:mm:ss")},${bat},${temp},${mov},${rx}`;
  }).join('\n');
  const blob = new Blob(['\uFEFF' + head + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(telemetry: any[], name: string) {
  const rows = telemetry || [];
  if (!rows.length) return;
  const title = `${name} - ${format(new Date(), "yyyy-MM-dd")}`;
  const tableRows = rows.map((t: any) => {
    const rx = Array.isArray(t.rxinfo) ? t.rxinfo.length : 0;
    const mov = t.object?.systemStatus?.motionFlag ? 'Sí' : 'No';
    const bat = t.object?.voltage_mV ? (t.object.voltage_mV / 1000).toFixed(2) : '—';
    const temp = t.object?.temperature_C != null ? t.object.temperature_C : '—';
    return `<tr><td>${format(new Date(t.ts), "yyyy-MM-dd HH:mm:ss")}</td><td>${bat}V</td><td>${temp}°C</td><td>${mov}</td><td>${rx}</td></tr>`;
  }).join('');
  const win = window.open('', '_blank');
  win?.document.write(`
    <html><head><title>${title}</title>
    <style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:5px}.meta{color:#666;font-size:13px;margin-bottom:15px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5}</style></head><body>
    <h2>${title}</h2><p class="meta">Registros: ${rows.length}</p>
    <table><thead><tr><th>Fecha</th><th>Batería</th><th>Temp</th><th>Movimiento</th><th>Gateways</th></tr></thead>
    <tbody>${tableRows}</tbody></table></body></html>
  `);
  win?.document.close();
  win?.print();
}

export default function Telemetry() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [range, setRange] = useState("24h");
  const [deviceTab, setDeviceTab] = useState("Gps");

  const { data: summary } = useSensorSummary();
  const { data: allDevices } = useDevicesList();
  const { data: gpsReview } = useGpsDailyReview();
  const { data: searchData } = useSearchDevices({ q: searchTerm, type: selectedType || undefined, limit: 10 });
  const devices = searchData?.data || [];

  const { from } = useMemo(() => {
    const r = RANGES.find(r => r.key === range);
    if (!r || r.hours === 0) return {};
    return { from: new Date(Date.now() - r.hours * 3600000).toISOString() };
  }, [range]);

  const { data: telemetryData, isLoading } = useDeviceTelemetry(selectedDevice?.id || null, { from, limit: 500 });
  const lastT = telemetryData?.telemetry?.[0];

  const chartData = useMemo(() => {
    if (!telemetryData?.telemetry?.length) return [];
    return telemetryData.telemetry.map(t => {
      const rx = Array.isArray(t.rxinfo) ? t.rxinfo : [];
      const entry: any = { time: format(new Date(t.ts), "MM/dd HH:mm"), voltage: t.object?.voltage_mV ?? null, temperature: t.object?.temperature_C ?? null };
      rx.forEach((gw: any, i: number) => {
        const id = (gw.gatewayId || `gw${i}`).slice(-6);
        entry[`snr_${id}`] = gw.snr;
        entry[`rssi_${id}`] = gw.rssi;
      });
      return entry;
    }).reverse();
  }, [telemetryData]);

  const gatewayNames = useMemo(() => {
    const names = new Set<string>();
    telemetryData?.telemetry?.forEach(t => {
      if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) names.add(gw.gatewayId.slice(-6)); });
    });
    return [...names];
  }, [telemetryData]);

  const types = summary?.types || [];
  const gpsModes = summary?.gpsModes || [];
  const filteredDevices = (allDevices || []).filter(d => d.type_device === deviceTab);
  const review = gpsReview || [];
  // axisStyle removed — inlined in charts

  const { data: deviceAlerts } = useDeviceAlerts(selectedDevice?.id || null);
  const { data: gatewayPositions } = useGatewayPositions();

  // Unique gateway IDs (dev_eui) from telemetry rxinfo
  const activeGatewayIds = useMemo(() => {
    const ids = new Set<string>();
    telemetryData?.telemetry?.forEach(t => {
      if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => {
        if (gw.gatewayId) ids.add(gw.gatewayId);
      });
    });
    return [...ids];
  }, [telemetryData]);

  const { data: latestTelemetry } = useQuery({
    queryKey: ['telemetry', 'latest'],
    queryFn: () => telemetryService.getLatestTelemetry(30),
    refetchInterval: 15000,
  });

  const exportDayCSV = async (date: string) => {
    try {
      const detail = await telemetryService.getGpsDailyDetail(date);
      let csv = '\uFEFF';
      csv += `Revisión diaria GPS - ${date}\nNombre,DevEUI,Tuvo datos,Voltaje (mV),Estado batería\n`;
      csv += detail.devices.map((d: any) => `${d.name},${d.dev_eui},${d.tuvo_datos ? 'Sí' : 'No'},${d.voltage_mV ?? '—'},${d.estado_bateria}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `gps-${date}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return selectedDevice ? (
    <div className="p-2 h-screen flex flex-col min-h-0 overflow-hidden">
      {/* ── TOP BAR: Device info + last telemetry (full width) ── */}
      <div className="relative rounded-lg bg-linear-to-r from-bg-300 via-bg-100 to-bg-200 shadow border border-border/30 px-3 py-2">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
          style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
        />
        {/* Row 1: Device identity + back + ranges */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setSelectedDevice(null)}
            className="flex items-center gap-1 text-[11px] text-text-300 hover:text-text-100 bg-bg-300/30 hover:bg-bg-300/60 px-1.5 py-0.5 rounded-lg transition-colors shrink-0">
            ← Volver
          </button>
          <span className="w-px h-5 bg-border/40 shrink-0" />
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedDevice.is_active ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-400'}`} />
          <h2 className="text-sm font-bold text-text-100 truncate">{selectedDevice.name}</h2>
          <span className="text-[11px] font-mono text-text-300 truncate hidden sm:inline">{selectedDevice.dev_eui}</span>
          <span className="text-[10px] text-text-300 bg-bg-300/50 px-1.5 py-0.5 rounded shrink-0">{selectedDevice.type_device}</span>
          <span className="flex-1" />
          <div className="flex gap-0.5 shrink-0">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all ${range === r.key ? 'bg-brand-100/15 text-brand-200 shadow-sm' : 'text-text-300 hover:text-text-200'}`}>{r.label}</button>
            ))}
          </div>
        </div>
        {/* Row 2: Last telemetry data metrics */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Último:</span>
            {lastT ? (
              <>
                <span className={`w-2 h-2 rounded-full shrink-0 ${Date.now() - new Date(lastT.ts).getTime() < 86400000 ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.4)]'}`} />
                <span className="font-mono text-text-100 font-semibold">{format(new Date(lastT.ts), "dd/MM HH:mm:ss")}</span>
              </>
            ) : <span className="text-text-300">—</span>}
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Bat</span>
            <span className={`font-bold font-mono text-[13px] ${lastT?.object?.voltage_mV >= 3700 && lastT?.object?.voltage_mV <= 4100 ? 'text-green-400' : 'text-yellow-400'}`}>
              {lastT?.object?.voltage_mV ? `${(lastT.object.voltage_mV / 1000).toFixed(2)}V` : '—'}
            </span>
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Temp</span>
            <span className="font-bold font-mono text-[13px] text-cyan-400">
              {lastT?.object?.temperature_C != null ? `${lastT.object.temperature_C}°C` : '—'}
            </span>
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Mov</span>
            <span className={`font-bold text-[13px] ${lastT?.object?.systemStatus?.freeFallFlag ? 'text-red-400' : lastT?.object?.systemStatus?.motionFlag ? 'text-yellow-400' : lastT?.object?.voltage_mV != null && lastT?.object?.temperature_C != null ? 'text-green-400' : 'text-text-300'}`}>
              {lastT?.object?.systemStatus?.freeFallFlag ? 'Caída' : lastT?.object?.systemStatus?.motionFlag ? 'Sí' : lastT?.object?.voltage_mV != null && lastT?.object?.temperature_C != null ? 'KeepAlive' : 'No'}
            </span>
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Modo</span>
            <span className="font-medium text-[12px] text-text-100">
              {lastT?.object?.systemStatus?.operatingMode || '—'}
            </span>
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">GW</span>
            <span className="font-bold text-[13px] text-blue-400">
              {lastT && Array.isArray(lastT.rxinfo) ? lastT.rxinfo.length : '—'}
            </span>
          </div>
          <span className="w-px h-3 bg-border/30 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-300">Registros</span>
            <span className="font-bold text-[13px] text-text-100">
              {telemetryData?.telemetry?.length || 0}
            </span>
          </div> 
        </div>
      </div>

      {/* ── ROWS CONTAINER: 2x2 grid, all boxes same width ── */}
      <div className="flex-1 grid grid-rows-2 gap-1.5 min-h-0">
        {/* ── ROW 1: Records (left) + Charts (right) ── */}
        <div className="grid grid-cols-2 gap-1.5 min-h-0">
          {/* ── Records Table ── */}
          <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
            <div className="relative bg-linear-to-r from-bg-300/40 via-bg-100 to-bg-200/40 border-b border-border/30 shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
                style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
              />
              <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider">Registros</span>
<button onClick={() => exportCSV(telemetryData?.telemetry, selectedDevice?.name)} className="text-[9px] hover:text-brand-200 px-1 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar CSV">CSV</button>
              <button onClick={() => exportPDF(telemetryData?.telemetry, selectedDevice?.name)} className="text-[9px] hover:text-brand-200 px-1 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar PDF">PDF</button>
              </div>
              <span className="text-[11px] font-bold text-text-200">{telemetryData?.telemetry?.length || 0}</span>
            </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[8px] uppercase tracking-wider sticky top-0 bg-bg-100/95 border-b border-border/30">
                    <th className="text-left px-2 py-1 font-medium">Fecha</th>
                    <th className="text-left px-2 py-1 font-medium">Bat</th>
                    <th className="text-left px-2 py-1 font-medium">°C</th>
                    <th className="text-left px-2 py-1 font-medium">Mov</th>
                    <th className="text-left px-2 py-1 font-medium">GW</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryData?.telemetry?.map(t => (
                    <tr key={t.id} className="border-t border-border/10 hover:bg-bg-100/60 transition-colors">
                      <td className="px-2 py-1 text-text-200 font-mono whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                      <td className="px-2 py-1 font-mono">{t.object?.voltage_mV ? <span className="text-green-400/80">{(t.object.voltage_mV / 1000).toFixed(1)}V</span> : <span>—</span>}</td>
                      <td className="px-2 py-1 font-mono">{t.object?.temperature_C != null ? <span className="text-orange-400/80">{t.object.temperature_C}°</span> : <span className="text-text-400">—</span>}</td>
                      <td className="px-2 py-1">{t.object?.systemStatus?.freeFallFlag ? <span className="text-red-400" title="Caída libre">●</span> : t.object?.systemStatus?.motionFlag ? <span className="text-yellow-400" title="Movimiento">●</span> : t.object?.voltage_mV != null && t.object?.temperature_C != null ? <span className="text-green-400" title="KeepAlive">●</span> : <span className="text-text-400">○</span>}</td>
                      <td className="px-2 py-1">{Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
{!isLoading && (!telemetryData?.telemetry || telemetryData.telemetry.length === 0) && <p className="text-center text-[11px] py-6">Sin registros</p>}
            {isLoading && <div className="flex justify-center py-4"><span className="text-[10px] text-brand-200 animate-pulse">Cargando...</span></div>}
            </div>
          </div>

          {/* ── Charts ── */}
          <div className="flex flex-col gap-1 min-h-0">
            {chartData.length > 1 ? (
              <>
                {[
                  { title: "Batería y Temperatura", lines: (
                    <>
                      <Line type="monotone" dataKey="voltage" stroke="#22c55e" strokeWidth={1.5} dot={false} activeDot={{ r: 2, stroke: '#000', fill: '#22c55e' }} name="Batería (mV)" />
                      <Line type="monotone" dataKey="temperature" stroke="#2dd4bf" strokeWidth={1.5} dot={false} activeDot={{ r: 2, stroke: '#000', fill: '#2dd4bf' }} name="Temperatura (°C)" />
                    </>
                  )},
                  { title: "SNR por Gateway", lines: gatewayNames.map((gwId, i) => {
                    const palette = ['#60a5fa', '#34d399', '#facc15', '#e879f9', '#818cf8', '#2dd4bf', '#38bdf8', '#a78bfa'];
                    return <Line key={gwId} type="monotone" dataKey={`snr_${gwId}`} stroke={palette[i % palette.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 2 }} name={gwId} />;
                  })},
                  { title: "RSSI por Gateway", lines: gatewayNames.map((gwId, i) => {
                    const palette = ['#60a5fa', '#34d399', '#facc15', '#e879f9', '#818cf8', '#2dd4bf', '#38bdf8', '#a78bfa'];
                    return <Line key={gwId} type="monotone" dataKey={`rssi_${gwId}`} stroke={palette[i % palette.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 2 }} name={gwId} />;
                  })},
                ].map(chart => (
                  <div key={chart.title} className="flex-1 min-h-0 flex flex-col">
                    <div className="bg-bg-100 border border-border/50 rounded-xl p-1.5 shadow-sm flex flex-col flex-1 min-h-0">
                      <p className="text-[12px] text-text-100 pl-2 mb-0.5 shrink-0">{chart.title}</p>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={30} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 7, color: '#9ca3af' }} verticalAlign="top" iconType="circle" />
                            {chart.lines}
                          </LineChart>
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

        {/* ── ROW 2: Heatmap (left) + Alerts (right) ── */}
        <div className="grid grid-cols-2 gap-1.5 min-h-0">
          {/* ── Leaflet Heatmap ── */}
          <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
            <div className="relative bg-linear-to-r from-bg-300/40 via-bg-100 to-bg-200/40 border-b border-border/30 shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
                style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
              />
              <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-200">
                Cobertura &darr; Gateways
                {activeGatewayIds.length > 0 && (
                  <span className="font-normal normal-case ml-1">· {activeGatewayIds.length} enlaces</span>
                )}
              </p>
            </div>
            </div>
            <div className="flex-1 relative min-h-0">
              <TelemetryMap
                devicePosition={selectedDevice.latitude_current != null && selectedDevice.longitude_current != null
                  ? { lat: selectedDevice.latitude_current, lng: selectedDevice.longitude_current }
                  : null}
                deviceName={selectedDevice.name}
                gateways={gatewayPositions}
                activeGatewayIds={activeGatewayIds.length > 0 ? activeGatewayIds : undefined}
              />
            </div>
          </div>

          {/* ── Device Alerts ── */}
          <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
            <div className="relative bg-linear-to-r from-bg-300/40 via-bg-100 to-bg-200/40 border-b border-border/30 shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
                style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
              />
              <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Alertas del dispositivo
              </p>
              <span className="text-[11px] font-bold text-text-200">{deviceAlerts?.length || 0}</span>
            </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
              {deviceAlerts && deviceAlerts.length > 0 ? (
                deviceAlerts.map((alert: any) => {
                  const typeColors: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
                    critica:            { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                    atencion:           { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                    movimientos_anomalos: { bg: 'bg-purple-500/8', border: 'border-purple-500/40', dot: 'bg-purple-500', text: 'text-purple-300', label: 'Mov. anómalo' },
                    desconexionGW:      { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'GW desconectado' },
                  };
                  const c = typeColors[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-400', label: alert.type };
                  const isResolved = alert.status === 'resolved' || alert.status_system === 'resolved';

                  return (
                    <div key={alert.id}
                      className={`flex items-start gap-1.5 text-[11px] leading-tight rounded px-1.5 py-1 border-s-2 ${c.border} ${c.bg} ${isResolved ? 'opacity-50' : ''}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot} ${isResolved ? '' : 'animate-pulse'} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-[9px] font-semibold uppercase ${c.text}`}>{c.label}</span>
                          {isResolved && <span className="text-[8px] text-green-400 bg-green-500/10 px-1 rounded">Resuelta</span>}
                          {alert.status_system === 'active' && alert.type === 'critica' && (
                            <span className="text-[8px] text-red-400 bg-red-500/10 px-1 rounded">Activa</span>
                          )}
                        </div>
                        {alert.metadata?.reason && (
                          <p className="text-[10px] leading-tight mt-0.5">{alert.metadata.reason}</p>
                        )}
                        {alert.user_reason && (
                          <p className="text-[9px] italic mt-0.5">"{alert.user_reason}"</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px]">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                          {alert.resolved_at && (
                            <span className="text-[9px] text-green-500/60">Resuelta: {format(new Date(alert.resolved_at), "dd/MM HH:mm")}</span>
                          )}
                          {alert.resolved_by_name && (
                            <span className="text-[9px]">por {alert.resolved_by_name}</span>
                          )}
                        </div>
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
    </div>
  ) : (
    <div className="p-3 h-full flex flex-col gap-2 overflow-hidden">
      {/* ─── MÉTRICAS CLAVE ─── */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="relative rounded-lg bg-bg-100  border border-border px-3 py-2.5">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1/3 h-px"
            style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
          />
          <div className="flex items-center gap-2 mb-2">
            <IconWifi size={14} className="text-blue-400 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-300">Gateways</p>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
              <span className="text-text-200">Online: <strong className="text-green-400">{(allDevices || []).filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-text-200">Offline: <strong className="text-red-400">{(allDevices || []).filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length}</strong></span>
            </span>
          </div>
        </div>
        <div className="relative rounded-lg bg-bg-100 shadow border border-border px-3 py-2.5">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-px"
            style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
          />
          <div className="flex items-center gap-2 mb-2">
            <IconMapPin size={14} className="text-emerald-400 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-300">Dispositivos GPS</p>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="text-text-200">Total: <strong className="text-text-100">{(allDevices || []).filter(d => d.type_device === 'Gps').length}</strong></span>
            <span className="text-text-200">Con datos: <strong className="text-green-400">{(allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv != null).length}</strong></span>
            <span className="text-text-200">Sin datos: <strong className="text-yellow-400">{(allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv == null).length}</strong></span>
          </div>
        </div>
      </div>

      {/* ─── SEARCH ─── */}
      <SectionDivider label="Buscar sensor" />
      <div className="relative flex gap-2 items-center shrink-0">
        <div className="relative flex-1">
          <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedDevice(null); }}
            placeholder="Nombre o EUI del dispositivo..."
            className="w-full bg-bg-100 border border-border rounded-xl pl-8 pr-3 py-2 text-[13px] text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 transition-colors shadow-sm" />
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-400" />

          {/* ─── SEARCH RESULTS (popup) ─── */}
          {searchTerm && devices.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/50 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setSelectedDevice(d); setSearchTerm(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-100/60 transition-colors border-b border-border/20 last:border-0 group">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${d.is_active ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
                  <span className="text-[13px] font-semibold text-text-100 truncate group-hover:text-brand-200">{d.name}</span>
                  <span className="text-[10px] font-mono truncate text-text-300">{d.dev_eui}</span>
                  <span className="text-[10px] bg-bg-300/60 px-1.5 py-0.5 rounded ml-auto shrink-0 text-text-300">{d.type_device}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
          className="bg-bg-100 border border-border rounded-xl px-3 py-2 text-[12px] text-text-100 outline-none focus:border-brand-100/50 shadow-sm">
          <option value="">Todos</option>
          <option value="Gps">GPS</option><option value="Gateway">Gateway</option>
          <option value="SubEstacion">SubEstación</option><option value="Lector">Lector</option>
        </select>
        <button onClick={() => generateSensorReport(() => telemetryService.getDevicesFullReport())}
          className="flex items-center gap-1.5 text-[11px] text-white hover:text-brand-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 bg-green-600 hover:bg-green-700"><IconFileReport size={14} /> Reporte PDF</button>
      </div>

      {/* ─── TABLA GPS ─── */}
      <div className="flex-1 bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 max-h-[calc(50vh-30px)] shadow">
        <div className="relative bg-bg-100 border-b border-border/30 shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
            style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
          />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <IconMapPin size={14} className="text-emerald-400" />
              <p className="text-md  text-text-100">Dispositivos GPS</p>
            </div>
            <span className="text-[11px] text-text-300">{(allDevices || []).filter(d => d.type_device === 'Gps').length} sensores</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider sticky top-0 bg-bg-100 border-b border-border/30">
                <th className="text-left px-3 py-1.5 font-medium">Nombre</th>
                <th className="text-left px-3 py-1.5 font-medium">DevEUI</th>
                <th className="text-left px-3 py-1.5 font-medium">Batería</th>
                <th className="text-left px-3 py-1.5 font-medium">Último dato</th>
              </tr>
            </thead>
            <tbody className="text-text-200">
              {(allDevices || []).filter(d => d.type_device === 'Gps').map(d => {
                const voltage = d.voltage_mv;
                const batColor = voltage == null ? 'text-gray-500' :
                  voltage >= 3700 && voltage <= 4100 ? 'text-green-400' :
                  voltage >= 3500 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <tr key={d.id} onClick={() => setSelectedDevice(d as any)}
                    className="border-t bg-bg-100 border-border/30 hover:bg-bg-200/60 transition-colors cursor-pointer">
                    <td className="px-3 py-2  truncate max-w-36">{d.name}</td>
                    <td className="px-3 py-2  text-[12px]">{d.dev_eui}</td>
                    <td className={`px-3 py-2  text-[12px] ${batColor}`}>
                      {voltage != null ? `${(voltage / 1000).toFixed(2)}V` : '—'}
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {d.last_seen ? format(new Date(d.last_seen), "dd MMM HH:mm") : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!allDevices || (allDevices || []).filter(d => d.type_device === 'Gps').length === 0) && (
            <p className="text-center text-[13px] py-10">Cargando dispositivos...</p>
          )}
        </div>
      </div>

      {/* ─── ÚLTIMOS DATOS ENTRANTES ─── */}
      <div className="shrink-0 bg-bg-100 border border-white/5 rounded-lg overflow-hidden max-h-[28vh] shadow">
        <div className="relative bg-bg-100 border-b border-border/30">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
            style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
          />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <IconWifi size={14} className="text-blue-400" />
              <p className="text-md text-text-100">Últimos datos entrantes</p>
            </div>
            <span className="text-[11px] text-text-300">{latestTelemetry?.length || 0} registros</span>
          </div>
        </div>
        <div className="overflow-auto max-h-[calc(28vh-42px)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider sticky top-0 bg-bg-100/95 border-b border-border/30">
                <th className="text-left px-2.5 py-1.5 font-medium">Hora</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Dispositivo</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Tipo</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Batería</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Temperatura</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Mov</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Gateways</th>
              </tr>
            </thead>
            <tbody className="text-text-200">
              {latestTelemetry?.map((t: any) => (
                <tr key={t.id} className="border-t border-border/10 hover:bg-bg-100/60 transition-colors">
                  <td className="px-2.5 py-1.5  text-[12px] whitespace-nowrap">{format(new Date(t.ts), "HH:mm:ss")}</td>
                  <td className="px-2.5 py-1.5  truncate max-w-28 text-[12px]">{t.device_name}</td>
                  <td className="px-2.5 py-1.5 text-[12px]">{t.type_device}</td>
                  <td className="px-2.5 py-1.5  text-[12px]">
                    {t.object?.voltage_mV != null
                      ? <span className={t.object.voltage_mV >= 3700 && t.object.voltage_mV <= 4100 ? 'text-green-400' : 'text-yellow-400'}>{(t.object.voltage_mV / 1000).toFixed(2)}V</span>
                      : <span className="text-text-400">—</span>}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-[12px]">
                    {t.object?.temperature_C != null
                      ? <span className="text-cyan-400">{t.object.temperature_C}°C</span>
                      : <span className="text-text-400">—</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-[12px]">
                    {t.object?.systemStatus?.freeFallFlag
                      ? <span className="text-red-400 font-bold" title="Caída libre">●</span>
                      : t.object?.systemStatus?.motionFlag
                        ? <span className="text-yellow-400 font-bold" title="Movimiento">●</span>
                        : t.object?.voltage_mV != null && t.object?.temperature_C != null
                          ? <span className="text-green-400 font-bold" title="KeepAlive">●</span>
                          : <span className="text-text-400">○</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-[12px]">
                    {Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}
                  </td>
                </tr>
              ))}
              {(!latestTelemetry || latestTelemetry.length === 0) && (
                <tr><td colSpan={7} className="text-center text-[13px] py-8">Cargando últimos datos...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
