import { useState } from "react";
import { MonitorSectionDivider } from "../shared/MonitorSectionDivider";
import { IconSearch, IconServer, IconWifi, IconMapPin, IconDatabase, IconCloud, IconAlertTriangle, IconFileReport } from "@tabler/icons-react";
import { format } from "date-fns";
import { formatBattery, batteryColor } from "../../utils/battery";
import MonitorBatteryPopup from "../shared/MonitorBatteryPopup";
import MonitorReportModal from "./MonitorReportModal";
import type { MonitorDevice } from "../../types/monitor.types";

const DEVICE_TYPES = ["Gps", "Gateway", "SubEstacion", "Lector"];

// Labels y colores de modo de operación (igual que en ChirpStack)
const MODE_LABELS: Record<string, { label: string; className: string }> = {
  PRODUCCION:   { label: "Producción",   className: "text-teal-400 bg-teal-500/10" },
  TRANSPORTE:   { label: "Transporte",   className: "text-blue-400 bg-blue-500/10" },
  MANTENIMIENTO:{ label: "Mantenimiento",className: "text-yellow-400 bg-yellow-500/10" },
  VALIDACION:   { label: "Validación",   className: "text-purple-400 bg-purple-500/10" },
  EMERGENCIA:   { label: "Emergencia",   className: "text-red-400 bg-red-500/10" },
};

const MINI_TABS = [
  { key: "sistema", label: "Datos y estado del sistema" },
  { key: "entrantes", label: "Últimos datos entrantes" },
];

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  deviceTab: string;
  onDeviceTabChange: (tab: string) => void;
  filteredDevices: MonitorDevice[];
  allDevices: MonitorDevice[];
  latestTelemetry: any[];
  onSelectDevice: (device: MonitorDevice) => void;
  expandedCard: string | null;
  onToggleCard: (card: string | null) => void;
}

export default function MonitorDeviceList({
  searchTerm, onSearchChange,
  selectedType, onTypeChange,
  deviceTab, onDeviceTabChange,
  filteredDevices, allDevices, latestTelemetry, onSelectDevice,
  expandedCard, onToggleCard,
}: Props) {
  const [miniTab, setMiniTab] = useState("sistema");
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="p-1.5 flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-text-100">Panel técnico</h1>
        </div>
        <button onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm">
          <IconFileReport size={14} /> Reporte
        </button>
      </div>

      {reportOpen && <MonitorReportModal onClose={() => setReportOpen(false)} />}

      {/* ─── MINI TABS ─── */}
      <div className="shrink-0 flex gap-1 bg-bg-100 border-b border-border self-start w-full">
        {MINI_TABS.map(t => (
          <button key={t.key} onClick={() => setMiniTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${miniTab === t.key ? 'border-brand-100 text-brand-100' : 'border-transparent text-text-200 hover:text-text-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {miniTab === "sistema" && (
        <div className="relative grid grid-cols-5 gap-1.5 text-[10px]">
          <div className="relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate mb-2">Servicios del Sistema</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <span className="flex items-center gap-1.5 text-text-200 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Node-RED</span>
                <span className="flex items-center gap-1.5 text-text-200 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />LoRaWAN</span>
                <span className="flex items-center gap-1.5 text-text-200 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />WhatsApp</span>
                <span className="flex items-center gap-1.5 text-text-200 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Base de Datos</span>
              </div>
            </div>
            <div className="shrink-0 p-2.5 rounded-lg bg-bg-300" style={{ color: '#14b8a6' }}>
              <IconServer size={20} />
            </div>
          </div>

          <div className="relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate">Gateways</p>
                <span className="text-[10px] text-text-300 shrink-0">{allDevices.filter(d => d.type_device === 'Gateway').length} total</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-text-100 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Gateway').length}</span>
                <span className="text-sm text-text-200 font-medium">
                  <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length}</span>
                  <span className="mx-0.5 text-text-300">/</span>
                  <span className={(allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                    {allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length}
                  </span>
                  <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400 inline' : 'text-text-300 inline'} />
                </span>
              </div>
              <div className="mt-2 h-1 bg-bg-300 rounded-full overflow-hidden">
                {(() => { const total = allDevices.filter(d => d.type_device === 'Gateway').length; const act = allDevices.filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#8ecae0' }} />; })()}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="p-2.5 rounded-lg bg-bg-300" style={{ color: '#8ecae0' }}>
                <IconWifi size={20} />
              </div>
              <button onClick={() => onToggleCard(expandedCard === 'Gateway' ? null : 'Gateway')}
                className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Gateway' ? '▲' : '▼'}
              </button>
            </div>
            {expandedCard === 'Gateway' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-1.5 space-y-0.5">
                  {allDevices.filter(d => d.type_device === 'Gateway').map(d => {
                    const lector = allDevices.find(l => l.id === d.id_device_father && l.type_device === 'Lector');
                    return (
                      <div key={d.id} onClick={() => { onSelectDevice(d); onToggleCard(null); }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000 ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="font-medium text-text-100 truncate">{d.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${lector ? 'bg-teal-500/10 text-teal-400' : 'bg-text-300/10 text-text-400'}`}>
                          {lector ? `Lector: ${lector.name}` : 'Sin lector'}
                        </span>
                        <span className="text-[10px] text-text-200 ml-1">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                        <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                      </div>
                    );
                  })}
                  {allDevices.filter(d => d.type_device === 'Gateway').length === 0 && <p className="text-center text-[11px] py-3 text-text-300">Sin gateways</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate">Dispositivos GPS</p>
                <span className="text-[10px] text-text-300 shrink-0">{allDevices.filter(d => d.type_device === 'Gps').length} total</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-text-100 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Gps').length}</span>
                <span className="text-sm text-text-200 font-medium">
                  <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value != null).length}</span>
                  <span className="mx-0.5 text-text-300">/</span>
                  <span className={(allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length > 0 ? 'text-yellow-400' : 'text-text-300') + ' font-semibold'}>
                    {allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length}
                  </span>
                  <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length > 0 ? 'text-yellow-400 inline' : 'text-text-300 inline'} />
                </span>
              </div>
              <div className="mt-2 h-1 bg-bg-300 rounded-full overflow-hidden">
                {(() => { const total = allDevices.filter(d => d.type_device === 'Gps').length; const act = allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value != null).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#8ecae0' }} />; })()}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="p-2.5 rounded-lg bg-bg-300" style={{ color: '#8ecae0' }}>
                <IconMapPin size={20} />
              </div>
              <button onClick={() => onToggleCard(expandedCard === 'Gps' ? null : 'Gps')}
                className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Gps' ? '▲' : '▼'}
              </button>
            </div>
            {expandedCard === 'Gps' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-1.5 space-y-0.5">
                  {allDevices.filter(d => d.type_device === 'Gps').map(d => (
                    <div key={d.id} onClick={() => { onSelectDevice(d); onToggleCard(null); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(d as any).last_value != null ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span className="font-medium text-text-100 truncate">{d.name}</span>
                      <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                      <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                    </div>
                  ))}
                  {allDevices.filter(d => d.type_device === 'Gps').length === 0 && <p className="text-center text-[11px] py-3 text-text-300">Sin dispositivos GPS</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate">Lectores</p>
                <span className="text-[10px] text-text-300 shrink-0">{allDevices.filter(d => d.type_device === 'Lector').length} total</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-text-100 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Lector').length}</span>
                <span className="text-sm text-text-200 font-medium">
                  <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Lector' && d.is_active).length}</span>
                  <span className="mx-0.5 text-text-300">/</span>
                  <span className={(allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                    {allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length}
                  </span>
                  <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400 inline' : 'text-text-300 inline'} />
                </span>
              </div>
              <div className="mt-2 h-1 bg-bg-300 rounded-full overflow-hidden">
                {(() => { const total = allDevices.filter(d => d.type_device === 'Lector').length; const act = allDevices.filter(d => d.type_device === 'Lector' && d.is_active).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#8ecae0' }} />; })()}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="p-2.5 rounded-lg bg-bg-300" style={{ color: '#8ecae0' }}>
                <IconDatabase size={20} />
              </div>
              <button onClick={() => onToggleCard(expandedCard === 'Lector' ? null : 'Lector')}
                className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'Lector' ? '▲' : '▼'}
              </button>
            </div>
            {expandedCard === 'Lector' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-1.5 space-y-0.5">
                  {allDevices.filter(d => d.type_device === 'Lector').map(d => (
                    <div key={d.id} onClick={() => { onSelectDevice(d); onToggleCard(null); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="font-medium text-text-100 truncate">{d.name}</span>
                      <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                      <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                    </div>
                  ))}
                  {allDevices.filter(d => d.type_device === 'Lector').length === 0 && <p className="text-center text-[11px] py-3 text-text-300">Sin lectores</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate">SubEstaciones</p>
                <span className="text-[10px] text-text-300 shrink-0">{allDevices.filter(d => d.type_device === 'SubEstacion').length} total</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-text-100 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'SubEstacion').length}</span>
                <span className="text-sm text-text-200 font-medium">
                  <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'SubEstacion' && d.is_active).length}</span>
                  <span className="mx-0.5 text-text-300">/</span>
                  <span className={(allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                    {allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length}
                  </span>
                  <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400 inline' : 'text-text-300 inline'} />
                </span>
              </div>
              <div className="mt-2 h-1 bg-bg-300 rounded-full overflow-hidden">
                {(() => { const total = allDevices.filter(d => d.type_device === 'SubEstacion').length; const act = allDevices.filter(d => d.type_device === 'SubEstacion' && d.is_active).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#8ecae0' }} />; })()}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="p-2.5 rounded-lg bg-bg-300" style={{ color: '#8ecae0' }}>
                <IconCloud size={20} />
              </div>
              <button onClick={() => onToggleCard(expandedCard === 'SubEstacion' ? null : 'SubEstacion')}
                className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                {expandedCard === 'SubEstacion' ? '▲' : '▼'}
              </button>
            </div>
            {expandedCard === 'SubEstacion' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-1.5 space-y-0.5">
                  {allDevices.filter(d => d.type_device === 'SubEstacion').map(d => (
                    <div key={d.id} onClick={() => { onSelectDevice(d); onToggleCard(null); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="font-medium text-text-100 truncate">{d.name}</span>
                      <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                      <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                    </div>
                  ))}
                  {allDevices.filter(d => d.type_device === 'SubEstacion').length === 0 && <p className="text-center text-[11px] py-3 text-text-300">Sin subestaciones</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MINI TAB: ÚLTIMOS DATOS ENTRANTES ─── */}
      {miniTab === "entrantes" && (
        <div className="bg-bg-100 rounded-lg border border-border overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <IconWifi size={14} className="text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold text-text-100">Últimos datos entrantes</h3>
                <p className="text-[10px] text-text-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> En vivo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-300">
              <span className="w-2 h-2 rounded bg-brand-100 inline-block" />
              {latestTelemetry?.length || 0} registros
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-2 px-2 font-medium">Hora</th>
                  <th className="text-left py-2 px-2 font-medium">Dispositivo</th>
                  <th className="text-left py-2 px-2 font-medium">Tipo</th>
                  <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Batería<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                  <th className="text-left py-2 px-2 font-medium">Temperatura</th>
                  <th className="text-left py-2 px-2 font-medium">Mov</th>
                  <th className="text-left py-2 px-2 font-medium">Gateways</th>
                </tr>
              </thead>
              <tbody>
                {latestTelemetry?.map((t: any, i: number) => (
                  <tr key={t.id}
                    className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                    <td className="py-1.5 px-2 text-text-200 font-mono text-[10px] whitespace-nowrap">{format(new Date(t.ts), "HH:mm:ss")}</td>
                    <td className="py-1.5 px-2 text-text-100 truncate max-w-28">{t.device_name}</td>
                    <td className="py-1.5 px-2 text-text-200 text-[10px]">{t.type_device}</td>
                    <td className="py-1.5 px-2 text-text-100 text-right">
                      {formatBattery(t.object?.voltage_mV)}
                    </td>
                    <td className="py-1.5 px-2 text-text-100 font-mono text-[10px] text-right">
                      {t.object?.temperature_C != null
                        ? <span className="text-cyan-400">{t.object.temperature_C}°C</span>
                        : <span className="text-text-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-left">
                      {t.object?.packetType?.startsWith?.('COMMAND')
                        ? <span className="text-cyan-400 font-semibold text-[10px]" title={t.object.systemMessage || ''}>{t.object.systemMessage || t.object.packetType}</span>
                        : t.object?.packetType === 'CONFIG_REPORT'
                          ? <span className="text-purple-400 font-semibold text-[10px]">Config Report</span>
                          : t.object?.packetType === 'QA_VALIDATION'
                            ? <span className="text-purple-400 font-semibold text-[10px]">QA Validación</span>
                            : t.object?.systemStatus?.freeFallFlag
                              ? <span className="text-red-400 font-bold" title="Caída libre">●</span>
                              : t.object?.systemStatus?.motionFlag
                                ? <span className="text-yellow-400 font-bold" title="Movimiento">●</span>
                                : t.object?.voltage_mV != null && t.object?.temperature_C != null
                                  ? <span className="text-green-400 font-bold" title="KeepAlive">●</span>
                                  : <span className="text-text-300">○</span>}
                    </td>
                    <td className="py-1.5 px-2 text-text-300 text-[10px] text-right">
                      {Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}
                    </td>
                  </tr>
                ))}
                {(!latestTelemetry || latestTelemetry.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-300 text-xs">Cargando últimos datos...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {miniTab === "sistema" && (
        <>
          <MonitorSectionDivider label="Buscar sensor" />
          <div className="relative flex gap-2 items-center shrink-0">
            <div className="relative flex-1">
              <input value={searchTerm} onChange={e => { onSearchChange(e.target.value); }}
                placeholder="Nombre o EUI del dispositivo..."
                className="w-full bg-bg-100 border border-border rounded-xl pl-8 pr-3 py-2 text-[13px] text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 transition-colors shadow-sm" />
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300" />
            </div>
            <select value={selectedType} onChange={e => onTypeChange(e.target.value)}
              className="bg-bg-100 border border-border rounded-xl px-3 py-2 text-[12px] text-text-100 outline-none focus:border-brand-100/50 shadow-sm">
              <option value="">Todos</option>
              <option value="Gps">GPS</option><option value="Gateway">Gateway</option>
              <option value="SubEstacion">SubEstación</option><option value="Lector">Lector</option>
            </select>
          </div>

          <div className="flex-1 bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0">
            <div className="relative bg-bg-100 border-b border-border/30 shrink-0">
              <div className="flex items-center justify-between px-1">
                <div className="flex gap-1">
                  {DEVICE_TYPES.map(tab => (
                    <button key={tab} onClick={() => onDeviceTabChange(tab)}
                      className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${deviceTab === tab ? 'border-brand-100 text-brand-100' : 'border-transparent text-text-200 hover:text-text-100'}`}>
                      {tab === 'SubEstacion' ? 'SubEst.' : tab}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-text-300 pr-3">{filteredDevices.length} dispositivos</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                    <th className="text-left py-2 px-2 font-medium">Nombre</th>
                    <th className="text-left py-2 px-2 font-medium">DevEUI</th>
                    <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Batería<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                    <th className="text-left py-2 px-2 font-medium">Último dato</th>
                    {deviceTab === 'Gps' && <th className="text-left py-2 px-2 font-medium">Modo</th>}
                    {deviceTab === 'Gateway' && <th className="text-left py-2 px-2 font-medium">Lector asignado</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((d, i) => {
                    const voltage = (d as any).last_value ? Number((d as any).last_value) : null;
                    const lector = allDevices.find(l => l.id === d.id_device_father && l.type_device === 'Lector');
                    const modeMeta = d.operating_mode ? MODE_LABELS[d.operating_mode] : null;
                    return (
                      <tr key={d.id} onClick={() => onSelectDevice(d)}
                        className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20 cursor-pointer`}>
                        <td className="py-1.5 px-2 text-text-100 truncate max-w-36 font-medium">{d.name}</td>
                        <td className="py-1.5 px-2 text-text-200 font-mono text-[10px]">{d.dev_eui}</td>
                        <td className={`py-1.5 px-2 text-[10px] ${batteryColor(voltage)}`}>{formatBattery(voltage)}</td>
                        <td className="py-1.5 px-2 text-text-300 text-[10px]">{d.last_seen ? format(new Date(d.last_seen), "dd MMM HH:mm") : '—'}</td>
                        {deviceTab === 'Gps' && (
                          <td className="py-1.5 px-2 text-[10px]">
                            {modeMeta
                              ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${modeMeta.className}`}>{modeMeta.label}</span>
                              : d.operating_mode
                                ? <span className="text-text-300">{d.operating_mode}</span>
                                : <span className="text-text-400">—</span>}
                          </td>
                        )}
                        {deviceTab === 'Gateway' && (
                          <td className="py-1.5 px-2 text-[10px]">
                            {lector
                              ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                                  {lector.name}
                                </span>
                              : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-text-300/10 text-text-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-text-400 shrink-0" />
                                  Sin lector
                                </span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <tr><td colSpan={deviceTab === 'Gps' || deviceTab === 'Gateway' ? 5 : 4} className="px-4 py-8 text-center text-text-300 text-xs">Cargando dispositivos...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
