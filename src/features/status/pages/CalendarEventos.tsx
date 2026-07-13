import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAlertsCalendar, useAlertsByDate } from "../hooks/useStatus";
import TrackingModal from "../components/TrackingModal";
import {
  IconChevronLeft, IconChevronRight,
  IconAlertTriangle, IconAlertCircle, IconMoodSearch, IconWifiOff,
  IconFileReport, IconX,
} from "@tabler/icons-react";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  critica:            { label: "Crítica",       color: "text-red-400 bg-red-500/10", icon: IconAlertTriangle },
  atencion:           { label: "Atención",       color: "text-yellow-400 bg-yellow-500/10", icon: IconAlertCircle },
  movimientos_anomalos: { label: "Mov. Anómalo", color: "text-orange-400 bg-orange-500/10", icon: IconMoodSearch },
  desconexionGW:      { label: "Desconexión GW", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
  desconexionGPS:     { label: "Desconexión GPS", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
};

function exportPDF(day: string, alerts: any[]) {
  const rows = alerts || [];
  if (!rows.length) return;
  const title = `Alertas - ${day}`;
  const tableRows = rows.map(a => {
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

export default function CalendarEventos() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [trackingAlertId, setTrackingAlertId] = useState<number | null>(null);

  const { data: calendarData } = useAlertsCalendar(year, month);
  const selectedDate = selectedDay ? `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` : null;
  const { data: dayAlerts, isLoading: detailLoading } = useAlertsByDate(selectedDate);

  const calendarMap = useMemo(() => {
    const map = new Map<number, typeof calendarData[0]>();
    (calendarData || []).forEach(d => map.set(Number(d.dia), d));
    return map;
  }, [calendarData]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const monthName = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  return (
    <div className="flex-1 flex gap-3 min-h-0">
      {/* ─── CALENDAR ─── */}
      <div className={`rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0 ${selectedDay ? "w-[55%]" : "w-full"}`}>
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconChevronLeft size={18} />
          </button>
          <h3 className="text-sm font-bold text-text-100 capitalize">{monthName}</h3>
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
            {/* Empty cells for days before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const info = calendarMap.get(day);
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const isSelected = day === selectedDay;
              const hasAlerts = info && info.total > 0;

              // Severidad del día
              let severity = "none";
              if (hasAlerts) {
                if (info!.criticas > 0 || info!.desconexion > 0) severity = "critical";
                else if (info!.atencion > 0 || info!.movimientos > 0) severity = "warning";
              }

              const severityStyle = {
                critical: { background: "rgba(239,68,68,0.25)", borderLeft: "3px solid rgb(239,68,68)" },
                warning:  { background: "rgba(234,179,8,0.25)", borderLeft: "3px solid rgb(234,179,8)" },
                none:     {},
              };

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={severity !== "none" ? severityStyle[severity] : undefined}
                  className={`
                    relative rounded-lg p-1.5 text-left transition-all min-h-[56px]
                    ${isSelected ? "ring-2 ring-brand-100/50" : isToday && severity === "none" ? "ring-1 ring-brand-200/30" : severity === "none" ? "hover:bg-bg-200/40" : ""}
                  `}
                >
                  <span className={`text-[11px] font-semibold ${severity === "critical" ? "text-red-400" : severity === "warning" ? "text-yellow-400" : isToday ? "text-brand-200" : "text-text-100"}`}>
                    {day}
                  </span>
                  {hasAlerts && (
                    <div className="mt-0.5 space-y-[2px]">
                      {info!.criticas > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          <span className="text-[9px] text-red-300 font-medium">Crítica {info!.criticas}</span>
                        </div>
                      )}
                      {info!.atencion > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                          <span className="text-[9px] text-yellow-300 font-medium">Atención {info!.atencion}</span>
                        </div>
                      )}
                      {info!.movimientos > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                          <span className="text-[9px] text-orange-300 font-medium">Mov. {info!.movimientos}</span>
                        </div>
                      )}
                      {info!.desconexion > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          <span className="text-[9px] text-red-300 font-medium">Descon. {info!.desconexion}</span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── SIDE PANEL ─── */}
      {selectedDay && (
        <div className="w-[45%] rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text-100">
                Alertas del {selectedDay} de {format(new Date(year, month - 1, 1), "MMMM", { locale: es })}
              </h3>
              <p className="text-[11px] text-text-300 mt-0.5">{dayAlerts?.length || 0} alertas</p>
            </div>
            <div className="flex items-center gap-1.5">
              {dayAlerts && dayAlerts.length > 0 && (
                <button
                  onClick={() => exportPDF(selectedDate!, dayAlerts)}
                  className="flex items-center gap-1 text-[11px] text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <IconFileReport size={14} /> PDF
                </button>
              )}
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
                <IconX size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px] text-text-300 animate-pulse">Cargando...</p>
              </div>
            ) : !dayAlerts || dayAlerts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px] text-text-300">Sin alertas este día</p>
              </div>
            ) : (
              <div className="space-y-px">
                {dayAlerts.map(alert => {
                  const conf = TYPE_LABELS[alert.type] || { label: alert.type, color: "text-text-300 bg-bg-200/60", icon: IconAlertTriangle };
                  const Icon = conf.icon;
                  return (
                    <div key={alert.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-bg-200/40 border border-border/20 text-[11px]">
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${conf.color}`}>
                        <Icon size={10} />
                      </div>
                      <span className="font-semibold text-text-100 truncate min-w-0 max-w-[120px]">{alert.device_name}</span>
                      <span className="text-text-400 shrink-0">|</span>
                      <span className="text-text-300 shrink-0">{conf.label}</span>
                      <span className="text-text-400 shrink-0">·</span>
                      <span className="text-text-300 shrink-0">{alert.type_device}</span>
                      <span className="text-text-400 shrink-0">·</span>
                      <span className="text-text-300 shrink-0">{format(new Date(alert.created_at), "HH:mm")}</span>
                      {alert.type === "critica" && (
                        <button
                          onClick={() => setTrackingAlertId(alert.id)}
                          className="ml-auto shrink-0 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded transition-colors"
                        >
                          Trackeo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TRACKING MODAL ─── */}
      {trackingAlertId && (
        <TrackingModal
          alertId={trackingAlertId}
          alertTitle={`Alerta #${trackingAlertId}`}
          onClose={() => setTrackingAlertId(null)}
        />
      )}
    </div>
  );
}
