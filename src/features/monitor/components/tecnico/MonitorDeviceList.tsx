import { useMemo, useState } from "react";
import { IconSearch, IconServer, IconWifi, IconMapPin, IconDatabase, IconCloud, IconAlertTriangle, IconFileReport, IconRefresh, IconX, IconSatellite, IconAntenna, IconCpu } from "@tabler/icons-react";
import { format } from "date-fns";
import { formatBattery, batteryColor, formatStationBattery, stationBatteryColor } from "../../utils/battery";
import MonitorBatteryPopup from "../shared/MonitorBatteryPopup";
import MonitorReportModal from "./MonitorReportModal";
import { useSystemServices, useMonitorGatewaysUptime } from "../../hooks/useMonitor";
import { intervalosDesdeApi, segmentosUptime, statsUptime, bucketsUptime, fmtDuracion, uptimeTextClass } from "../../utils/uptime";
import { isFreshForDevice } from "../../utils/online";
import type { BucketUptime } from "../../utils/uptime";
import type { MonitorDevice } from "../../types/monitor.types";

// Orden de los tabs de tipo de equipo (el primero es el que queda más a la izquierda)
const DEVICE_TYPES = ["Gateway", "Gps", "Lector"];

// Los tabs de tipo son la navegación principal de la vista, así que cada uno lleva icono, nombre
// completo y su contador. El activo se marca con el color de marca y fondo (antes era solo un
// subrayado fino, que se perdía entre el resto del header).
// Nota: el icono del tab activo hereda el color del texto (no brand-200, que en el tema oscuro es
// azul y chocaba con el rojo de marca).
const DEVICE_TAB_META: Record<string, { label: string; title: string; icon: typeof IconSatellite }> = {
  Gps: { label: "GPS", title: "Sensores GPS", icon: IconSatellite },
  Gateway: { label: "Gateways", title: "Gateways LoRaWAN", icon: IconAntenna },
  Lector: { label: "Lectores", title: "Lectores en terreno", icon: IconCpu },
};

// ¿La fecha del último dato es de HOY? (día local del navegador, igual que el resto de la vista)
// Se usa para pintar en verde los dispositivos que están reportando, de un vistazo.
const esUltimoDatoHoy = (ts?: string | null): boolean =>
  !!ts && format(new Date(ts), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

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

// Bloques del mini gráfico de uptime: 7 días × 12 bloques de 2 h = 84 bloques
const UPTIME_DIAS = 7;
const UPTIME_BLOQUES_POR_DIA = 12;
// Anchos FIJOS en px. Con flex-1 y 84 bloques el navegador redondea distinto cada uno y se veían
// unos más anchos que otros; con medidas exactas todos los bloques salen iguales.
const UPTIME_BLOQUE_PX = 3;      // ancho de cada bloque de 2 h
const UPTIME_HUECO_PX = 1;       // separación entre bloques del mismo día
const UPTIME_SEP_DIA_PX = 4;     // separación entre día y día
const UPTIME_DIA_PX = UPTIME_BLOQUES_POR_DIA * UPTIME_BLOQUE_PX + (UPTIME_BLOQUES_POR_DIA - 1) * UPTIME_HUECO_PX;
const UPTIME_ANCHO_PX = UPTIME_DIAS * UPTIME_DIA_PX + (UPTIME_DIAS - 1) * UPTIME_SEP_DIA_PX;

// Color del bloque: esmeralda sin caídas, ámbar una caída parcial, rosa caído al menos medio bloque
const uptimeBloqueClass = (offlineMs: number, totalMs: number): string => {
  if (offlineMs <= 0) return "bg-emerald-400";
  return offlineMs / totalMs >= 0.5 ? "bg-rose-400" : "bg-amber-300";
};


function MonitorUptimeStrip({ s }: { s: { uptime: number; caidas: number; offlineMs: number; buckets: BucketUptime[] } }) {
  const resumen = `Uptime ${s.uptime}% · ${s.caidas} caída${s.caidas !== 1 ? "s" : ""} · ${fmtDuracion(s.offlineMs)} caído en total`;
  // Un grupo de bloques por día (el alto del gráfico y el de la regla se alinean solos)
  const dias = Array.from({ length: UPTIME_DIAS }, (_, i) =>
    s.buckets.slice(i * UPTIME_BLOQUES_POR_DIA, (i + 1) * UPTIME_BLOQUES_POR_DIA));
  return (
    <div className="grid grid-cols-[auto_auto] gap-x-2 items-center">
      <div className="shrink-0 flex" style={{ width: UPTIME_ANCHO_PX, gap: UPTIME_SEP_DIA_PX }} title={resumen}>
        {dias.map((bloques, i) => (
          <div key={i} className="flex" style={{ width: UPTIME_DIA_PX, gap: UPTIME_HUECO_PX }}>
            {bloques.map(b => (
              <div key={b.start}
                title={`${format(new Date(b.start), "dd/MM HH:mm")} – ${format(new Date(b.end), "HH:mm")} · ${b.offlineMs > 0 ? `caído ${fmtDuracion(b.offlineMs)}` : "sin caídas"}`}
                className={`h-3 ${uptimeBloqueClass(b.offlineMs, b.end - b.start)}`}
                style={{ width: UPTIME_BLOQUE_PX }} />
            ))}
          </div>
        ))}
      </div>
      <span className={`text-[10px] font-semibold tabular-nums ${uptimeTextClass(s.uptime)}`}>{s.uptime}%</span>
      {/* Regla de días: cada celda mide exactamente lo mismo que su grupo de bloques */}
      <div className="shrink-0 flex mt-0.5" style={{ width: UPTIME_ANCHO_PX, gap: UPTIME_SEP_DIA_PX }}>
        {dias.map((bloques, i) => (
          <div key={i} className="text-center text-[8px] leading-none text-text-400 border-t border-border/40 pt-0.5"
            style={{ width: UPTIME_DIA_PX }}>
            {bloques.length
              ? format(new Date((bloques[0].start + bloques[bloques.length - 1].end) / 2), "dd/MM")
              : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
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
  deviceTab, onDeviceTabChange,
  filteredDevices, allDevices, latestTelemetry, onSelectDevice,
  expandedCard, onToggleCard,
}: Props) {
  const [miniTab, setMiniTab] = useState("sistema");
  const [reportOpen, setReportOpen] = useState(false);
  const { data: systemServices, refetch: refetchServices, isFetching: servicesLoading } = useSystemServices();
  const { data: uptimeData } = useMonitorGatewaysUptime(7, { enabled: deviceTab === "Gateway" });
  // Con búsqueda activa la tabla muestra todos los tipos y agrega la columna Tipo: sin ella no
  // se sabría qué es cada fila.
  const buscando = searchTerm.trim().length > 0;

  // Cuántos equipos hay de cada tipo: se muestra en el propio tab, así la navegación informa.
  const conteoPorTipo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of allDevices) c[d.type_device] = (c[d.type_device] ?? 0) + 1;
    return c;
  }, [allDevices]);

  // Uptime de 7 días por gateway, calculado con las mismas funciones que usa el panel del gateway
  const uptimePorGateway = useMemo(() => {
    const map = new Map<number, { uptime: number; caidas: number; offlineMs: number; buckets: BucketUptime[] }>();
    if (!uptimeData?.desde || !uptimeData?.hasta) return map;
    const desde = new Date(uptimeData.desde).getTime();
    const hasta = new Date(uptimeData.hasta).getTime();
    for (const g of uptimeData.gateways) {
      const segmentos = segmentosUptime(intervalosDesdeApi(g.intervalos), desde, hasta, true);
      const { uptime, caidas, offlineMs } = statsUptime(segmentos);
      map.set(g.id, { uptime, caidas, offlineMs, buckets: bucketsUptime(segmentos, desde, hasta, UPTIME_DIAS * UPTIME_BLOQUES_POR_DIA) });
    }
    return map;
  }, [uptimeData]);

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
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate mb-1">Servicios del Sistema</p>
                <button onClick={() => refetchServices()} disabled={servicesLoading}
                  className="text-text-300 hover:text-text-100 transition-colors shrink-0" title="Actualizar estado">
                  <IconRefresh size={13} className={servicesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              {servicesLoading && !systemServices ? (
                <p className="text-[11px] text-text-300 animate-pulse">Verificando servicios...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {(systemServices?.services || []).map(s => (
                      <span key={s.key} className="flex items-center gap-1.5 text-text-200 font-medium" title={s.error || (s.online ? `${s.detail ?? ''} · ${s.latencyMs}ms` : 'Offline')}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.online ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'bg-red-500 shadow-[0_0_4px_rgba(248,113,113,0.6)]'} ${s.online ? '' : 'animate-pulse'}`} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${systemServices?.offline ? 'text-red-400' : 'text-green-400'}`}>
                      {systemServices?.online}/{systemServices?.total} en línea
                    </span>
                    <span className="text-[9px] text-text-300">
                      {systemServices ? format(new Date(systemServices.checkedAt), "HH:mm:ss") : '—'}
                    </span>
                  </div>
                </>
              )}
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${lector ? (d.is_active && !!d.last_seen && isFreshForDevice(new Date(d.last_seen).getTime(), d.type_device) ? 'bg-green-500/10 text-green-400' : 'bg-bg-200/60 text-text-200') : 'bg-text-300/10 text-text-400'}`}>
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
          {/* flex-1 + min-h-0: ocupa TODO el alto disponible del panel y hace scroll interno
              (antes tenia max-h-96, que la cortaba a la mitad y dejaba espacio muerto abajo) */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-2 px-2 font-medium">Fecha / Hora</th>
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
                    <td className="py-1.5 px-2 font-mono text-[10px] whitespace-nowrap">
                      <span className="text-text-300">{format(new Date(t.ts), "dd/MM/yy")}</span>
                      <span className="text-text-200 ml-1.5">{format(new Date(t.ts), "HH:mm:ss")}</span>
                    </td>
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
          <div className="flex-1 bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0">
            <div className="relative bg-bg-200/25 border-b border-border/30 shrink-0">
              <div className="flex items-center gap-2 px-1.5 py-1">
                <div className="flex items-stretch gap-1 min-w-0 overflow-x-auto shrink">
                  {DEVICE_TYPES.map(tab => {
                    const meta = DEVICE_TAB_META[tab] ?? { label: tab, title: tab, icon: IconSatellite };
                    const IconoTab = meta.icon;
                    const activo = !buscando && deviceTab === tab;
                    return (
                      <button key={tab}
                        onClick={() => { onDeviceTabChange(tab); if (buscando) onSearchChange(""); }}
                        title={buscando ? `Ver ${meta.title.toLowerCase()}` : meta.title}
                        className={`shrink-0 group flex items-center gap-2 px-2.5 py-1.5 rounded-t-md border-b-2 text-[12px] font-bold transition-all whitespace-nowrap ${
                          activo
                            ? 'border-brand-100 bg-brand-100/10 text-brand-100'
                            : 'border-transparent text-text-300 hover:bg-bg-200/60 hover:text-text-100'
                        }`}>
                        <IconoTab size={15} className={activo ? '' : 'text-text-400 group-hover:text-text-200'} />
                        <span>{meta.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 rounded-full tabular-nums ${activo ? 'bg-brand-100/20 text-brand-100' : 'bg-bg-300/60 text-text-400'}`}>
                          {conteoPorTipo[tab] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Buscador en el header de los tabs (ahorra una fila). Busca en TODOS los tipos de
                    equipo: nombre, DevEUI o tipo, ignorando el tab activo. */}
                <div className="ml-auto flex items-center gap-2 min-w-0 border-l border-border/30 pl-2">
                  <div className="relative w-44 min-w-28 shrink">
                    <input value={searchTerm} onChange={e => onSearchChange(e.target.value)}
                      placeholder="Buscar equipo..."
                      className="w-full bg-bg-200 border border-border/40 rounded-lg pl-7 pr-7 py-1.5 text-[12px] text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 transition-colors" />
                    <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300 pointer-events-none" />
                    {buscando && (
                      <button type="button" onClick={() => onSearchChange("")} title="Limpiar búsqueda"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-300 hover:text-text-100 transition-colors">
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                  {/* El contador del tab activo ya muestra cuántos equipos hay; acá solo se muestra
                      cuántas coincidencias hay cuando se está buscando. */}
                  {buscando && (
                    <span className="text-[11px] font-semibold text-brand-200 pr-2 whitespace-nowrap tabular-nums">
                      {filteredDevices.length} coincidencia{filteredDevices.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 px-2 font-medium">Nombre</th>
                    <th className="text-left py-2 px-2 font-medium">DevEUI</th>
                    <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup variant={deviceTab === 'Gateway' || deviceTab === 'Lector' ? 'estacion' : 'litio'}><span className="flex items-center gap-1 cursor-help">Batería<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                    <th className="text-left py-2 px-2 font-medium">Último dato</th>
                    {!buscando && deviceTab === 'Gps' && <th className="text-left py-2 px-2 font-medium">Modo</th>}
                    {!buscando && deviceTab === 'Gateway' && <th className="text-left py-2 px-2 font-medium">Lector asignado</th>}
                    {!buscando && deviceTab === 'Gateway' && <th className="text-left py-2 px-2 font-bold w-[25rem]">Uptime 7 días</th>}
                    {buscando && <th className="text-left py-2 px-2 font-medium">Tipo</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((d, i) => {
                    const voltage = (d as any).last_value ? Number((d as any).last_value) : null;
                    // Gateways y lectores no tienen batería propia: se muestra la de la estación
                    // (banco de 12 V que reporta el MPPT del lector).
                    const estacion = d.battery_v ?? null;
                    // ¿El gateway de esta fila está reportando? (mismo criterio que el resto del panel)
                    const gatewayActivo = d.is_active && !!d.last_seen
                      && isFreshForDevice(new Date(d.last_seen).getTime(), d.type_device);
                    const lector = allDevices.find(l => l.id === d.id_device_father && l.type_device === 'Lector');
                    const modeMeta = d.operating_mode ? MODE_LABELS[d.operating_mode] : null;
                    return (
                      <tr key={d.id} onClick={() => onSelectDevice(d)}
                        className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20 cursor-pointer`}>
                        <td className="py-1.5 px-2 text-text-100 truncate max-w-36 font-medium">{d.name}</td>
                        <td className="py-1.5 px-2 text-text-200 font-mono text-[10px]">{d.dev_eui}</td>
                        <td className={`py-1.5 px-2 text-[10px] ${estacion != null ? stationBatteryColor(estacion) : batteryColor(voltage)}`}>
                          {estacion != null ? formatStationBattery(estacion) : formatBattery(voltage)}
                        </td>
                        <td className={`py-1.5 px-2 text-[10px] ${esUltimoDatoHoy(d.last_seen) ? "text-green-400 font-semibold" : "text-text-300"}`}>{d.last_seen ? format(new Date(d.last_seen), "dd MMM HH:mm") : '—'}</td>
                        {buscando && (
                          <td className="py-1.5 px-2 text-[10px] text-text-300">{d.type_device === 'SubEstacion' ? 'SubEst.' : d.type_device}</td>
                        )}
                        {!buscando && deviceTab === 'Gps' && (
                          <td className="py-1.5 px-2 text-[10px]">
                            {modeMeta
                              ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${modeMeta.className}`}>{modeMeta.label}</span>
                              : d.operating_mode
                                ? <span className="text-text-300">{d.operating_mode}</span>
                                : <span className="text-text-400">—</span>}
                          </td>
                        )}
                        {!buscando && deviceTab === 'Gateway' && (
                          <td className="py-1.5 px-2 text-[10px]">
                            {/* El chip va verde cuando el GATEWAY está reportando (no es un estado del
                                lector: solo indica que hay uno asignado). Si no reporta, queda neutro. */}
                            {lector
                              ? <span title={gatewayActivo ? 'Lector asignado · gateway reportando' : 'Lector asignado · gateway sin reportar'}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${gatewayActivo ? 'bg-green-500/10 text-green-400' : 'bg-bg-200/60 text-text-200'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gatewayActivo ? 'bg-green-400' : 'bg-text-400'}`} />
                                  {lector.name}
                                </span>
                              : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-text-300/10 text-text-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-text-400 shrink-0" />
                                  Sin lector
                                </span>}
                          </td>
                        )}
                        {!buscando && deviceTab === 'Gateway' && (
                          <td className="py-1.5 px-2">
                            {(() => {
                              const up = uptimePorGateway.get(d.id);
                              return up
                                ? <MonitorUptimeStrip s={up} />
                                : <span className="text-[10px] text-text-400">—</span>;
                            })()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <tr><td colSpan={buscando ? 5 : deviceTab === 'Gateway' ? 6 : deviceTab === 'Gps' ? 5 : 4} className="px-4 py-8 text-center text-text-300 text-xs">
                      {buscando ? `Sin resultados para «${searchTerm}»` : 'Cargando dispositivos...'}
                    </td></tr>
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
