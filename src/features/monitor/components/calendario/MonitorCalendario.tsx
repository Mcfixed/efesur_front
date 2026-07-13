import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMonitorCalendar, useMonitorAlertsByDate } from "../../hooks/useMonitor";
import {
  IconChevronLeft, IconChevronRight,
  IconAlertTriangle, IconAlertCircle, IconMoodSearch, IconWifiOff,
  IconFileReport, IconX,
} from "@tabler/icons-react";
import MonitorTrackingModal from "../shared/MonitorTrackingModal";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  critica:            { label: "Crítica",       color: "text-red-400 bg-red-500/10", icon: IconAlertTriangle },
  atencion:           { label: "Atención",       color: "text-yellow-400 bg-yellow-500/10", icon: IconAlertCircle },
  movimientos_anomalos: { label: "Mov. Anómalo", color: "text-orange-400 bg-orange-500/10", icon: IconMoodSearch },
  desconexionGW:      { label: "Desconexión GW", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
  desconexionGPS:     { label: "Desconexión GPS", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
};

const TYPE_BG: Record<string, string> = {
  critica: "bg-red-500",
  atencion: "bg-yellow-500",
  movimientos_anomalos: "bg-orange-500",
  desconexionGW: "bg-red-500",
};

function exportPDF(day: string, alerts: any[]) {
  const rows = alerts || [];
  if (!rows.length) return;
  const title = `Alertas - ${day}`;
  const tableRows = rows.map((a: any) => {
    const meta = a.metadata ? Object.entries(a.metadata).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    return `<tr>
      <td>${a.device_name}</td>
      <td>${a.type_device}</td>
      <td>${a.type}</td>
      <td>${a.status}</td>
      <td>${format(new Date(a.created_at), "HH:mm:ss")}</td>
      <td>${meta}</td>
    </tr>`;
  }).join("");
  const win = window.open("", "_blank");
  win?.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:sans-serif;padding:20px;background:#fff;color:#222}
      h2{margin-bottom:5px;color:#111}
      .meta{color:#666;font-size:13px;margin-bottom:15px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      tr:nth-child(even){background:#fafafa}
    </style></head><body>
    <h2>${title}</h2>
    <p class="meta">Total alertas: ${rows.length} — Generado: ${format(new Date(), "yyyy-MM-dd HH:mm")}</p>
    <table>
      <thead><tr><th>Dispositivo</th><th>Tipo</th><th>Alerta</th><th>Estado</th><th>Hora</th><th>Metadata</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></body></html>
  `);
  win?.document.close();
  win?.print();
}

export default function MonitorCalendario() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [trackingAlertId, setTrackingAlertId] = useState<number | null>(null);

  const { data: calendar } = useMonitorCalendar(year, month);
  const { data: alerts, isLoading } = useMonitorAlertsByDate(selectedDate);

  const calendarMap = useMemo(() => {
    const map = new Map<number, typeof calendar>();
    (calendar || []).forEach(d => map.set(Number(d.dia), d));
    return map;
  }, [calendar]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else { setMonth(m => m - 1); } setSelectedDate(null); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else { setMonth(m => m + 1); } setSelectedDate(null); };

  return (
    <div className="flex-1 flex gap-3 min-h-0">
      {/* ─── CALENDAR ─── */}
      <div className={`rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0 ${selectedDate ? "w-[55%]" : "w-full"}`}>
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconChevronLeft size={18} />
          </button>
          <h3 className="text-sm font-bold text-text-100 capitalize">{format(new Date(year, month - 1), "MMMM yyyy", { locale: es })}</h3>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconChevronRight size={18} />
          </button>
        </div>

        {/* Day names */}
        <div className="shrink-0 grid grid-cols-7 px-2 py-1.5 text-[10px] font-semibold text-text-300 uppercase tracking-wider text-center">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto p-2">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayData = calendarMap.get(day) as MonitorCalendarDay | undefined;
              const isT = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isS = selectedDate === dayStr;
              const hasAlerts = dayData && dayData.total > 0;

              let severity = "none";
              if (hasAlerts) {
                if (dayData!.criticas > 0 || dayData!.desconexion > 0) severity = "critical";
                else if (dayData!.atencion > 0 || dayData!.movimientos > 0) severity = "warning";
              }

              const severityStyle = {
                critical: { background: "rgba(239,68,68,0.25)", borderLeft: "3px solid rgb(239,68,68)" },
                warning:  { background: "rgba(234,179,8,0.25)", borderLeft: "3px solid rgb(234,179,8)" },
              };

              return (
                <button key={day} onClick={() => setSelectedDate(isS ? null : dayStr)}
                  style={severity !== "none" ? severityStyle[severity] : undefined}
                  className={`relative rounded-lg p-1.5 text-left transition-all min-h-[56px] ${isS ? "ring-2 ring-brand-100/50" : isT && severity === "none" ? "ring-1 ring-brand-200/30" : severity === "none" ? "hover:bg-bg-200/40" : ""}`}>
                  <span className={`text-[11px] font-semibold ${severity === "critical" ? "text-red-400" : severity === "warning" ? "text-yellow-400" : isT ? "text-brand-200" : "text-text-100"}`}>{day}</span>
                  {hasAlerts && (
                    <div className="mt-0.5 space-y-[2px]">
                      {dayData!.criticas > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span className="text-[9px] text-red-300 font-medium">Crítica {dayData!.criticas}</span></div>}
                      {dayData!.atencion > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" /><span className="text-[9px] text-yellow-300 font-medium">Atención {dayData!.atencion}</span></div>}
                      {dayData!.movimientos > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" /><span className="text-[9px] text-orange-300 font-medium">Mov. {dayData!.movimientos}</span></div>}
                      {dayData!.desconexion > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span className="text-[9px] text-red-300 font-medium">Descon. {dayData!.desconexion}</span></div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── SIDE PANEL ─── */}
      {selectedDate && (
        <div className="w-[45%] rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text-100">
                Alertas del {format(new Date(selectedDate), "d 'de' MMMM", { locale: es })}
              </h3>
              <p className="text-[11px] text-text-300 mt-0.5">{alerts?.length || 0} alertas</p>
            </div>
            <div className="flex items-center gap-1.5">
              {alerts && alerts.length > 0 && (
                <button onClick={() => exportPDF(selectedDate, alerts)}
                  className="flex items-center gap-1 text-[11px] text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-lg transition-colors">
                  <IconFileReport size={14} /> PDF
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
                <IconX size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full"><p className="text-[13px] text-text-300 animate-pulse">Cargando...</p></div>
            ) : !alerts || alerts.length === 0 ? (
              <div className="flex items-center justify-center h-full"><p className="text-[13px] text-text-300">Sin alertas este día</p></div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-text-400 border-b border-border/20">
                    <th className="text-left px-2.5 py-1.5 font-medium w-[28px]"> </th>
                    <th className="text-left px-2.5 py-1.5 font-medium">Dispositivo</th>
                    <th className="text-left px-2.5 py-1.5 font-medium">Tipo</th>
                    <th className="text-left px-2.5 py-1.5 font-medium">Alerta</th>
                    <th className="text-left px-2.5 py-1.5 font-medium w-[52px]">Hora</th>
                    <th className="text-right px-2.5 py-1.5 font-medium w-[68px]">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a: any) => {
                    const conf = TYPE_LABELS[a.type] || { label: a.type, color: "text-text-300 bg-bg-200/60", icon: IconAlertCircle };
                    const Icon = conf.icon;
                    return (
                      <tr key={a.id} className="border-b border-border/10 hover:bg-bg-200/30 transition-colors">
                        <td className="px-2.5 py-1.5">
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${conf.color}`}>
                            <Icon size={10} />
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold text-text-100 truncate max-w-[130px]">{a.device_name}</td>
                        <td className="px-2.5 py-1.5 text-text-300">{a.type_device}</td>
                        <td className="px-2.5 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${conf.color}`}>{conf.label}</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-text-300 font-mono">{format(new Date(a.created_at), "HH:mm")}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          {a.type === "critica" ? (
                            <button onClick={() => setTrackingAlertId(a.id)}
                              className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded transition-colors">
                              Trackeo
                            </button>
                          ) : (
                            <span className="text-[10px] text-text-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {trackingAlertId && (
        <MonitorTrackingModal
          alertId={trackingAlertId}
          alertTitle=""
          onClose={() => setTrackingAlertId(null)}
        />
      )}
    </div>
  );
}

interface MonitorCalendarDay {
  dia: number; total: number; criticas: number; atencion: number; movimientos: number; desconexion: number;
}
