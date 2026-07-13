import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useSensorSummary, useDevicesList, useGpsDailyReview, useSearchDevices, useDeviceTelemetry, useDeviceAlerts, useGatewayPositions } from "../hooks/useTelemetry";
import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "../services/telemetry.service";
import { generateSensorReport } from "../utils/generateReport";
import { SectionDivider } from "../components/SectionDivider";
import DeviceDetailHeader from "../components/DeviceDetailHeader";
import GpsDetailPanel from "../components/GpsDetailPanel";
import GatewayDetailPanel from "../components/GatewayDetailPanel";
import LectorDetailPanel from "../components/LectorDetailPanel";
import SubEstacionDetailPanel from "../components/SubEstacionDetailPanel";
import { IconWifi, IconMapPin, IconSearch, IconFileReport, IconAlertTriangle, IconServer, IconAntennaBars3, IconBrandWhatsapp, IconDatabase, IconCloud } from "@tabler/icons-react";
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
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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

  const [telemetryOffset, setTelemetryOffset] = useState(0);
  const PAGE_SIZE = 200;

  // ✅ Memoizado: evita crear un nuevo objeto params en cada render
  const telemetryParams = useMemo(() => ({
    from,
    limit: PAGE_SIZE,
    offset: telemetryOffset,
  }), [from, PAGE_SIZE, telemetryOffset]);

  const { data: telemetryData, isLoading } = useDeviceTelemetry(selectedDevice?.id || null, telemetryParams);
  const lastT = telemetryData?.telemetry?.[0];
  const hasMore = telemetryData?.telemetry?.length === PAGE_SIZE;

  const handleLoadMore = () => {
    setTelemetryOffset(prev => prev + PAGE_SIZE);
  };

  // Reset offset when device or range changes
  useEffect(() => {
    setTelemetryOffset(0);
  }, [selectedDevice?.id, range]);

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

  const exportCSVWrapper = () => exportCSV(telemetryData?.telemetry, selectedDevice?.name);
  const exportPDFWrapper = () => exportPDF(telemetryData?.telemetry, selectedDevice?.name);

  return selectedDevice ? (
    <div className="p-2 h-screen flex flex-col min-h-0 overflow-hidden">
      <DeviceDetailHeader
        device={selectedDevice}
        onBack={() => setSelectedDevice(null)}
        lastTs={lastT?.ts}
        recordCount={telemetryData?.telemetry?.length}
        lastVoltage={lastT?.object?.voltage_mV ?? null}
        lastTemp={lastT?.object?.temperature_C ?? null}
        lastMotion={lastT?.object?.systemStatus?.freeFallFlag ? 'Caída' : lastT?.object?.systemStatus?.motionFlag ? 'Sí' : lastT?.object?.voltage_mV != null && lastT?.object?.temperature_C != null ? 'KeepAlive' : null}
        lastGwCount={lastT && Array.isArray(lastT.rxinfo) ? lastT.rxinfo.length : null}
        range={range}
        onRangeChange={setRange}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
      />

      {selectedDevice.type_device === 'Gps' && (
        <GpsDetailPanel
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name}
          deviceEui={selectedDevice.dev_eui}
          latitude_current={selectedDevice.latitude_current}
          longitude_current={selectedDevice.longitude_current}
          range={range}
          telemetryData={telemetryData}
          isLoading={isLoading}
          activeGatewayIds={activeGatewayIds}
          chartData={chartData}
          gatewayNames={gatewayNames}
          onExportCSV={exportCSVWrapper}
          onExportPDF={exportPDFWrapper}
        />
      )}

      {selectedDevice.type_device === 'Gateway' && (
        <GatewayDetailPanel
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name}
          deviceEui={selectedDevice.dev_eui}
          lastSeen={selectedDevice.last_seen}
          lastTs={lastT?.ts}
          range={range}
          onRangeChange={setRange}
        />
      )}

      {selectedDevice.type_device === 'Lector' && (
        <LectorDetailPanel
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name}
          deviceEui={selectedDevice.dev_eui}
          lastTs={lastT?.ts}
        />
      )}

      {selectedDevice.type_device === 'SubEstacion' && (
        <SubEstacionDetailPanel
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name}
          lastTs={lastT?.ts}
        />
      )}
    </div>
  ) : (
    <div className="p-3 h-full flex flex-col gap-2 overflow-hidden">
      {/* ─── ALERTAS Y ESTADO DEL SISTEMA ─── */}
      <div className="relative grid grid-cols-5 gap-3 shrink-0">

        {/* Servicios del Sistema — destacado */}
        <div className="relative rounded-lg bg-linear-to-br from-teal-900/20 via-bg-100 to-bg-200 shadow-lg border border-teal-500/20 px-4 py-3">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-px"
            style={{ background: 'linear-gradient(to left, transparent, #14b8a6, transparent)' }}
          />
          {/* subtle corner glow */}
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-teal-500/5 rounded-full blur-xl" />
          <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-teal-500/3 rounded-full blur-xl" />
          <div className="flex items-start gap-3 relative">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0 shadow-inner shadow-teal-500/20">
              <IconServer size={22} className="text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-teal-300 uppercase tracking-wider mb-1.5">Servicios del Sistema</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <span className="flex items-center gap-1.5 text-text-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />
                  Node-RED
                </span>
                <span className="flex items-center gap-1.5 text-text-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />
                  LoRaWAN
                </span>
                <span className="flex items-center gap-1.5 text-text-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.4)]" />
                  WhatsApp
                </span>
                <span className="flex items-center gap-1.5 text-text-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />
                  Base de Datos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gateways — estilo: dashboard widget */}
        <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
          <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <IconWifi size={15} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Gateways</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-blue-300/60">{(allDevices || []).filter(d => d.type_device === 'Gateway').length} total</span>
              <button onClick={() => setExpandedCard(expandedCard === 'Gateway' ? null : 'Gateway')}
                className="text-text-400 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Gateway' ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{(allDevices || []).filter(d => d.type_device === 'Gateway').length}</span>
            <span className="text-[13px] text-text-400 ml-auto flex items-center gap-1.5">
              <span className="text-green-400 font-semibold">{(allDevices || []).filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length}</span>
              <span className="mx-0.5 text-text-400">/</span>
              <span className={((allDevices || []).filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400' : 'text-text-400') + ' font-semibold'}>
                {(() => {
                  const off = (allDevices || []).filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length;
                  return off;
                })()}
              </span>
              <IconAlertTriangle size={14} className={((allDevices || []).filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400' : 'text-text-400')} />
            </span>
          </div>
          <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
            {(() => {
              const total = (allDevices || []).filter(d => d.type_device === 'Gateway').length;
              const act = (allDevices || []).filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length;
              const pct = total > 0 ? (act / total) * 100 : 0;
              return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />;
            })()}
          </div>
          {/* Popup Gateways */}
          {expandedCard === 'Gateway' && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                {(allDevices || []).filter(d => d.type_device === 'Gateway').map(d => (
                  <div key={d.id} onClick={() => { setSelectedDevice(d as any); setExpandedCard(null); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000 ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-medium text-text-100 truncate">{d.name}</span>
                    <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                    <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                  </div>
                ))}
                {(allDevices || []).filter(d => d.type_device === 'Gateway').length === 0 && (
                  <p className="text-center text-[11px] py-3 text-text-400">Sin gateways</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dispositivos GPS — estilo: dashboard widget */}
        <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
          <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <IconMapPin size={15} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Dispositivos GPS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-blue-300/60">{(allDevices || []).filter(d => d.type_device === 'Gps').length} total</span>
              <button onClick={() => setExpandedCard(expandedCard === 'Gps' ? null : 'Gps')}
                className="text-text-400 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Gps' ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{(allDevices || []).filter(d => d.type_device === 'Gps').length}</span>
            <span className="text-[13px] text-text-400 ml-auto flex items-center gap-1.5">
              <span className="text-green-400 font-semibold">{(allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv != null).length}</span>
              <span className="mx-0.5 text-text-400">/</span>
              <span className={((allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv == null).length > 0 ? 'text-yellow-400' : 'text-text-400') + ' font-semibold'}>
                {(() => {
                  const nodata = (allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv == null).length;
                  return nodata;
                })()}
              </span>
              <IconAlertTriangle size={14} className={((allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv == null).length > 0 ? 'text-yellow-400' : 'text-text-400')} />
            </span>
          </div>
          <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
            {(() => {
              const total = (allDevices || []).filter(d => d.type_device === 'Gps').length;
              const act = (allDevices || []).filter(d => d.type_device === 'Gps' && d.voltage_mv != null).length;
              const pct = total > 0 ? (act / total) * 100 : 0;
              return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />;
            })()}
          </div>
          {/* Popup GPS */}
          {expandedCard === 'Gps' && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                {(allDevices || []).filter(d => d.type_device === 'Gps').map(d => {
                  const hasData = d.voltage_mv != null;
                  return (
                    <div key={d.id} onClick={() => { setSelectedDevice(d as any); setExpandedCard(null); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasData ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span className="font-medium text-text-100 truncate">{d.name}</span>
                      <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                      <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                    </div>
                  );
                })}
                {(allDevices || []).filter(d => d.type_device === 'Gps').length === 0 && (
                  <p className="text-center text-[11px] py-3 text-text-400">Sin dispositivos GPS</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Lectores — estilo: dashboard widget */}
        <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
          <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <IconDatabase size={15} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Lectores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-blue-300/60">{(allDevices || []).filter(d => d.type_device === 'Lector').length} total</span>
              <button onClick={() => setExpandedCard(expandedCard === 'Lector' ? null : 'Lector')}
                className="text-text-400 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Lector' ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{(allDevices || []).filter(d => d.type_device === 'Lector').length}</span>
            <span className="text-[13px] text-text-400 ml-auto flex items-center gap-1.5">
              <span className="text-green-400 font-semibold">{(allDevices || []).filter(d => d.type_device === 'Lector' && d.is_active).length}</span>
              <span className="mx-0.5 text-text-400">/</span>
              <span className={((allDevices || []).filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-400') + ' font-semibold'}>
                {(() => {
                  const inact = (allDevices || []).filter(d => d.type_device === 'Lector' && !d.is_active).length;
                  return inact;
                })()}
              </span>
              <IconAlertTriangle size={14} className={((allDevices || []).filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-400')} />
            </span>
          </div>
          <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
            {(() => {
              const total = (allDevices || []).filter(d => d.type_device === 'Lector').length;
              const act = (allDevices || []).filter(d => d.type_device === 'Lector' && d.is_active).length;
              const pct = total > 0 ? (act / total) * 100 : 0;
              return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />;
            })()}
          </div>
          {/* Popup Lectores */}
          {expandedCard === 'Lector' && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                {(allDevices || []).filter(d => d.type_device === 'Lector').map(d => (
                  <div key={d.id} onClick={() => { setSelectedDevice(d as any); setExpandedCard(null); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-medium text-text-100 truncate">{d.name}</span>
                    <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                    <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                  </div>
                ))}
                {(allDevices || []).filter(d => d.type_device === 'Lector').length === 0 && (
                  <p className="text-center text-[11px] py-3 text-text-400">Sin lectores</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SubEstaciones — estilo: dashboard widget */}
        <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
          <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <IconCloud size={15} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">SubEstaciones</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-blue-300/60">{(allDevices || []).filter(d => d.type_device === 'SubEstacion').length} total</span>
              <button onClick={() => setExpandedCard(expandedCard === 'SubEstacion' ? null : 'SubEstacion')}
                className="text-text-400 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'SubEstacion' ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{(allDevices || []).filter(d => d.type_device === 'SubEstacion').length}</span>
            <span className="text-[13px] text-text-400 ml-auto flex items-center gap-1.5">
              <span className="text-green-400 font-semibold">{(allDevices || []).filter(d => d.type_device === 'SubEstacion' && d.is_active).length}</span>
              <span className="mx-0.5 text-text-400">/</span>
              <span className={((allDevices || []).filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-400') + ' font-semibold'}>
                {(() => {
                  const inact = (allDevices || []).filter(d => d.type_device === 'SubEstacion' && !d.is_active).length;
                  return inact;
                })()}
              </span>
              <IconAlertTriangle size={14} className={((allDevices || []).filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-400')} />
            </span>
          </div>
          <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
            {(() => {
              const total = (allDevices || []).filter(d => d.type_device === 'SubEstacion').length;
              const act = (allDevices || []).filter(d => d.type_device === 'SubEstacion' && d.is_active).length;
              const pct = total > 0 ? (act / total) * 100 : 0;
              return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />;
            })()}
          </div>
          {/* Popup SubEstaciones */}
          {expandedCard === 'SubEstacion' && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                {(allDevices || []).filter(d => d.type_device === 'SubEstacion').map(d => (
                  <div key={d.id} onClick={() => { setSelectedDevice(d as any); setExpandedCard(null); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-medium text-text-100 truncate">{d.name}</span>
                    <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                    <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                  </div>
                ))}
                {(allDevices || []).filter(d => d.type_device === 'SubEstacion').length === 0 && (
                  <p className="text-center text-[11px] py-3 text-text-400">Sin subestaciones</p>
                )}
              </div>
            </div>
          )}
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

      {/* ─── TABLA DE DISPOSITIVOS ─── */}
      <div className="flex-1 bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 max-h-[calc(50vh-30px)] shadow">
        <div className="relative bg-bg-100 border-b border-border/30 shrink-0">

          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1">
              <div className="flex gap-1">
                {['Gps', 'Gateway', 'Lector', 'SubEstacion'].map(tab => (
                  <button key={tab} onClick={() => setDeviceTab(tab)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-all ${
                      deviceTab === tab
                        ? 'bg-white/10 text-text-100 shadow-sm'
                        : 'text-text-300 hover:text-text-100'
                    }`}>
                    {tab === 'Gps' ? 'GPS' : tab === 'SubEstacion' ? 'SubEst.' : tab}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-text-300">{(allDevices || []).filter(d => d.type_device === deviceTab).length} dispositivos</span>
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
              {(allDevices || []).filter(d => d.type_device === deviceTab).map(d => {
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
          {(!allDevices || (allDevices || []).filter(d => d.type_device === deviceTab).length === 0) && (
            <p className="text-center text-[13px] py-10">Cargando dispositivos...</p>
          )}
        </div>
      </div>

      {/* ─── ÚLTIMOS DATOS ENTRANTES ─── */}
      <div className="shrink-0 bg-bg-100 border border-white/5 rounded-lg overflow-hidden max-h-[28vh] shadow">
        <div className="relative bg-bg-100 border-b border-border/30">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-px"
            style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
          />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <IconWifi size={14} className="text-blue-400" />
              <p className="text-md text-text-100 flex items-center gap-2">Últimos datos entrantes <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse" /></p>
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
