import { useState } from "react";
import { MonitorSectionDivider } from "../shared/MonitorSectionDivider";
import { IconSearch, IconServer, IconWifi, IconMapPin, IconDatabase, IconCloud, IconAlertTriangle, IconWifi as IconData, IconFileReport } from "@tabler/icons-react";
import { format } from "date-fns";
import { formatBattery, batteryColor } from "../../utils/battery";
import MonitorBatteryPopup from "../shared/MonitorBatteryPopup";
import MonitorReportModal from "./MonitorReportModal";
import type { MonitorDevice } from "../../types/monitor.types";

const DEVICE_TYPES = ["Gps", "Gateway", "SubEstacion", "Lector", "lector_asignado"];

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
    <div className="p-3 flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-100">Panel técnico</h1>
          <p className="text-[11px] text-text-300 mt-0.5">Búsqueda y detalle de dispositivos</p>
        </div>
        <button onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm">
          <IconFileReport size={14} /> Reporte
        </button>
      </div>

      {reportOpen && <MonitorReportModal onClose={() => setReportOpen(false)} />}

      {/* ─── MINI TABS ─── */}
      <div className="shrink-0 flex gap-1 bg-bg-300/20 p-0.5 rounded-lg self-start">
        {MINI_TABS.map(t => (
          <button key={t.key} onClick={() => setMiniTab(t.key)}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${miniTab === t.key ? 'bg-white/15 text-text-100 shadow-sm border border-white/10' : 'text-text-300 hover:text-text-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── MINI TAB: DATOS Y ESTADO DEL SISTEMA ─── */}
      {miniTab === "sistema" && (
        <div className="relative grid grid-cols-5 gap-3 shrink-0">
          <div className="relative rounded-lg bg-linear-to-br from-teal-900/20 via-bg-100 to-bg-200 shadow-lg border border-teal-500/20 px-4 py-3">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-px" style={{ background: 'linear-gradient(to left, transparent, #14b8a6, transparent)' }} />
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-teal-500/5 rounded-full blur-xl" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-teal-500/3 rounded-full blur-xl" />
            <div className="flex items-start gap-3 relative">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0 shadow-inner shadow-teal-500/20">
                <IconServer size={22} className="text-teal-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-teal-300 uppercase tracking-wider mb-1.5">Servicios del Sistema</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <span className="flex items-center gap-1.5 text-text-300"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />Node-RED</span>
                  <span className="flex items-center gap-1.5 text-text-300"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />LoRaWAN</span>
                  <span className="flex items-center gap-1.5 text-text-300"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.4)]" />WhatsApp</span>
                  <span className="flex items-center gap-1.5 text-text-300"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]" />Base de Datos</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
            <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <IconWifi size={15} className="text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Gateways</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-blue-300/60">{allDevices.filter(d => d.type_device === 'Gateway').length} total</span>
                <button onClick={() => onToggleCard(expandedCard === 'Gateway' ? null : 'Gateway')}
                  className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                  {expandedCard === 'Gateway' ? '▲' : '▼'}
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Gateway').length}</span>
              <span className="text-[13px] text-text-300 ml-auto flex items-center gap-1.5">
                <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length}</span>
                <span className="mx-0.5 text-text-300">/</span>
                <span className={(allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                  {allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length}
                </span>
                <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Gateway' && (!d.is_active || !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 5 * 60 * 1000)).length > 0 ? 'text-red-400' : 'text-text-300'} />
              </span>
            </div>
            <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
              {(() => { const total = allDevices.filter(d => d.type_device === 'Gateway').length; const act = allDevices.filter(d => d.type_device === 'Gateway' && d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />; })()}
            </div>
            {expandedCard === 'Gateway' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-100 border border-border/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-1.5 space-y-0.5">
                  {allDevices.filter(d => d.type_device === 'Gateway').map(d => (
                    <div key={d.id} onClick={() => { onSelectDevice(d); onToggleCard(null); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-bg-100/60 cursor-pointer transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active && d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000 ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="font-medium text-text-100 truncate">{d.name}</span>
                      <span className="text-[10px] text-text-200 ml-2">{d.last_seen ? format(new Date(d.last_seen), "dd/MM HH:mm") : '—'}</span>
                      <span className="text-[10px] font-mono text-text-300 ml-auto">{d.dev_eui}</span>
                    </div>
                  ))}
                  {allDevices.filter(d => d.type_device === 'Gateway').length === 0 && <p className="text-center text-[11px] py-3 text-text-300">Sin gateways</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
            <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <IconMapPin size={15} className="text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Dispositivos GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-blue-300/60">{allDevices.filter(d => d.type_device === 'Gps').length} total</span>
                <button onClick={() => onToggleCard(expandedCard === 'Gps' ? null : 'Gps')}
                  className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                  {expandedCard === 'Gps' ? '▲' : '▼'}
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Gps').length}</span>
              <span className="text-[13px] text-text-300 ml-auto flex items-center gap-1.5">
                <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value != null).length}</span>
                <span className="mx-0.5 text-text-300">/</span>
                <span className={(allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length > 0 ? 'text-yellow-400' : 'text-text-300') + ' font-semibold'}>
                  {allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length}
                </span>
                <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value == null).length > 0 ? 'text-yellow-400' : 'text-text-300'} />
              </span>
            </div>
            <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
              {(() => { const total = allDevices.filter(d => d.type_device === 'Gps').length; const act = allDevices.filter(d => d.type_device === 'Gps' && (d as any).last_value != null).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />; })()}
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

          <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
            <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <IconDatabase size={15} className="text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">Lectores</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-blue-300/60">{allDevices.filter(d => d.type_device === 'Lector').length} total</span>
                <button onClick={() => onToggleCard(expandedCard === 'Lector' ? null : 'Lector')}
                  className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                  {expandedCard === 'Lector' ? '▲' : '▼'}
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'Lector').length}</span>
              <span className="text-[13px] text-text-300 ml-auto flex items-center gap-1.5">
                <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'Lector' && d.is_active).length}</span>
                <span className="mx-0.5 text-text-300">/</span>
                <span className={(allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                  {allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length}
                </span>
                <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'Lector' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300'} />
              </span>
            </div>
            <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
              {(() => { const total = allDevices.filter(d => d.type_device === 'Lector').length; const act = allDevices.filter(d => d.type_device === 'Lector' && d.is_active).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />; })()}
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

          <div className="relative rounded-lg bg-linear-to-br from-blue-900/15 via-bg-100 to-bg-100 shadow border border-blue-500/15 px-4 py-3">
            <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <IconCloud size={15} className="text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">SubEstaciones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-blue-300/60">{allDevices.filter(d => d.type_device === 'SubEstacion').length} total</span>
                <button onClick={() => onToggleCard(expandedCard === 'SubEstacion' ? null : 'SubEstacion')}
                  className="text-text-300 hover:text-text-200 transition-colors text-[10px] leading-none">
                  {expandedCard === 'SubEstacion' ? '▲' : '▼'}
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-blue-400 leading-none tracking-tight">{allDevices.filter(d => d.type_device === 'SubEstacion').length}</span>
              <span className="text-[13px] text-text-300 ml-auto flex items-center gap-1.5">
                <span className="text-green-400 font-semibold">{allDevices.filter(d => d.type_device === 'SubEstacion' && d.is_active).length}</span>
                <span className="mx-0.5 text-text-300">/</span>
                <span className={(allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300') + ' font-semibold'}>
                  {allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length}
                </span>
                <IconAlertTriangle size={14} className={allDevices.filter(d => d.type_device === 'SubEstacion' && !d.is_active).length > 0 ? 'text-red-400' : 'text-text-300'} />
              </span>
            </div>
            <div className="mt-2 h-1 bg-bg-300/40 rounded-full overflow-hidden">
              {(() => { const total = allDevices.filter(d => d.type_device === 'SubEstacion').length; const act = allDevices.filter(d => d.type_device === 'SubEstacion' && d.is_active).length; const pct = total > 0 ? (act / total) * 100 : 0; return <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />; })()}
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
        <div className="flex flex-col min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="bg-bg-100/60 border border-border/30 rounded-t-lg shrink-0 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconData size={14} className="text-blue-400" />
              <p className="text-[13px] font-bold text-text-100 flex items-center gap-2">Últimos datos entrantes <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse" /></p>
            </div>
            <span className="text-[11px] text-text-300">{latestTelemetry?.length || 0} registros</span>
          </div>
          <div className="overflow-auto border-x border-b border-border/30 rounded-b-lg bg-bg-100/60 flex-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider sticky top-0 bg-bg-100 z-10 border-b border-border/20">
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Hora</th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Dispositivo</th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Tipo</th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Batería<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Temperatura</th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Mov</th>
                  <th className="text-left px-2.5 py-1.5 font-medium text-text-300">Gateways</th>
                </tr>
              </thead>
              <tbody className="text-text-200">
                {latestTelemetry?.map((t: any) => (
                  <tr key={t.id} className="border-t border-border/10 hover:bg-bg-100/60 transition-colors">
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{format(new Date(t.ts), "HH:mm:ss")}</td>
                    <td className="px-2.5 py-1.5 truncate max-w-28">{t.device_name}</td>
                    <td className="px-2.5 py-1.5">{t.type_device}</td>
                    <td className="px-2.5 py-1.5">
                      {formatBattery(t.object?.voltage_mV)}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono">
                      {t.object?.temperature_C != null
                        ? <span className="text-cyan-400">{t.object.temperature_C}°C</span>
                        : <span className="text-text-300">—</span>}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {t.object?.systemStatus?.freeFallFlag
                        ? <span className="text-red-400 font-bold" title="Caída libre">●</span>
                        : t.object?.systemStatus?.motionFlag
                          ? <span className="text-yellow-400 font-bold" title="Movimiento">●</span>
                          : t.object?.voltage_mV != null && t.object?.temperature_C != null
                            ? <span className="text-green-400 font-bold" title="KeepAlive">●</span>
                            : <span className="text-text-300">○</span>}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {Array.isArray(t.rxinfo) ? t.rxinfo.length : '—'}
                    </td>
                  </tr>
                ))}
                {(!latestTelemetry || latestTelemetry.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-8 text-text-300">Cargando últimos datos...</td></tr>
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
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex gap-1">
                  {DEVICE_TYPES.map(tab => (
                    <button key={tab} onClick={() => onDeviceTabChange(tab)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-all ${deviceTab === tab ? 'bg-white/10 text-text-100 shadow-sm' : 'text-text-300 hover:text-text-100'}`}>
                      {tab === 'SubEstacion' ? 'SubEst.' : tab === 'lector_asignado' ? 'Lector asignado' : tab}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-text-300">{filteredDevices.length} dispositivos</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider sticky top-0 bg-bg-100 border-b border-border/30">
                    <th className="text-left px-3 py-1.5 font-medium text-text-300">Nombre</th>
                    <th className="text-left px-3 py-1.5 font-medium text-text-300">DevEUI</th>
                    <th className="text-left px-3 py-1.5 font-medium text-text-300"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Batería<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                    <th className="text-left px-3 py-1.5 font-medium text-text-300">Último dato</th>
                  </tr>
                </thead>
                <tbody className="text-text-200">
                  {filteredDevices.map(d => {
                    const voltage = (d as any).last_value ? Number((d as any).last_value) : null;
                    return (
                      <tr key={d.id} onClick={() => onSelectDevice(d)}
                        className="border-t bg-bg-100 border-border/30 hover:bg-bg-200/60 transition-colors cursor-pointer">
                        <td className="px-3 py-2 truncate max-w-36">{d.name}</td>
                        <td className="px-3 py-2 text-[12px]">{d.dev_eui}</td>
                        <td className={`px-3 py-2 text-[12px] ${batteryColor(voltage)}`}>{formatBattery(voltage)}</td>
                        <td className="px-3 py-2 text-[11px]">{d.last_seen ? format(new Date(d.last_seen), "dd MMM HH:mm") : '—'}</td>
                      </tr>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-[13px] py-10 text-text-300">Cargando dispositivos...</td></tr>
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
