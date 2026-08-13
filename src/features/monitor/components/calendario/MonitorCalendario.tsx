import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMonitorCalendar, useMonitorAlertsByDate } from "../../hooks/useMonitor";
import { monitorService } from "../../services/monitor.service";
import {
  IconChevronLeft, IconChevronRight,
  IconAlertTriangle, IconAlertCircle, IconMoodSearch, IconWifiOff,
  IconFileReport, IconX,
} from "@tabler/icons-react";
import MonitorTrackingModal from "../shared/MonitorTrackingModal";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  critica:            { label: "Crítica",       color: "text-red-400 bg-red-500/10", icon: IconAlertTriangle },
  atencion:           { label: "Atención",       color: "text-yellow-400 bg-yellow-500/10", icon: IconAlertCircle },
  apertura:           { label: "Apertura",       color: "text-red-400 bg-red-500/10", icon: IconAlertTriangle },
  presencia:          { label: "Presencia",      color: "text-yellow-400 bg-yellow-500/10", icon: IconAlertCircle },
  movimientos_anomalos: { label: "Mov. Anómalo", color: "text-orange-400 bg-orange-500/10", icon: IconMoodSearch },
  desconexionGW:      { label: "Desconexión GW", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
  desconexionGPS:     { label: "Desconexión GPS", color: "text-red-400 bg-red-500/10", icon: IconWifiOff },
  desconexion220:     { label: "Desconexión CA 220", color: "text-orange-400 bg-orange-500/10", icon: IconWifiOff },
  desconexionbatGW:   { label: "Desconexión Batería GW", color: "text-orange-400 bg-orange-500/10", icon: IconWifiOff },
};

async function exportPDF(day: string, dayAlerts: any[]) {
  const rows = dayAlerts || [];
  if (!rows.length) return;
  const title = `Alertas y Tracking - ${day}`;
  const from = new Date(`${day}T00:00:00`).toISOString();
  const to = new Date(`${day}T23:59:59`).toISOString();

  // Obtener alertas con tracking_data (igual que el reporte general)
  const deviceIds = [...new Set(rows.map(a => a.device_id).filter(Boolean))];
  let alerts = rows;
  try {
    const res = await monitorService.getReportAlerts({ deviceIds, from, to });
    if (res?.alerts?.length) alerts = res.alerts;
  } catch { /* si falla, usar alertas locales */ }

  const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const criticals = alerts.filter((a: any) => a.type === 'critica' || a.type === 'apertura');
  const attentions = alerts.filter((a: any) => a.type === 'atencion' || a.type === 'apertura' || a.type === 'presencia');
  const resolved = alerts.filter((a: any) => a.status === 'resolved' || a.resolved_at);

  // Agrupar por dispositivo
  const byDevice = new Map<number, { name: string; dev_eui: string; type_device: string; items: any[] }>();
  alerts.forEach((a: any) => {
    const id = a.device_id;
    if (!byDevice.has(id)) byDevice.set(id, { name: a.device_name || `#${id}`, dev_eui: a.dev_eui || '—', type_device: a.type_device || '—', items: [] });
    byDevice.get(id)!.items.push(a);
  });

  const trackMaps: { id: string; label: string; points: any[] }[] = [];
  let mapCounter = 0;
  const trackMapDiv = (pts: any[], label: string) => {
    const valid = (pts || []).filter(p => Number.isFinite(parseFloat(p.latitude)) && Number.isFinite(parseFloat(p.longitude)));
    if (valid.length < 2) return '';
    const id = `track-map-${++mapCounter}`;
    trackMaps.push({ id, label, points: valid });
    const startT = format(new Date(valid[0].timestamp), "dd/MM HH:mm");
    const endT = format(new Date(valid[valid.length - 1].timestamp), "dd/MM HH:mm");
    return `<div style="margin-top:8px;page-break-inside:avoid">
      <div id="${id}" class="track-map" style="width:690px;max-width:100%;height:280px;border:1px solid #e2e8f0;border-radius:8px;background:#e8e8e8;overflow:hidden"></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:8px;color:#888">
        <span>🟢 Inicio ${startT}</span>
        <span>${valid.length} puntos</span>
        <span>🔴 Fin ${endT}</span>
      </div>
    </div>`;
  };

  const typeBadge = (type: string) => {
    const critical = ['critica', 'apertura', 'presencia'].includes(type);
    return `<span style="background:${critical ? '#fef2f2' : '#fefce8'};color:${critical ? '#dc2626' : '#a16207'};font-weight:700;font-size:10px;text-transform:uppercase;padding:3px 8px;border-radius:4px">${esc(type)}</span>`;
  };

  const deviceSections = [...byDevice.values()].map(d => `
    <div style="page-break-after:always;font-family:Arial,sans-serif;padding:24px">
      <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px">
        <h2 style="font-size:15px;color:#111;margin:0">${esc(d.name)}</h2>
        <p style="font-size:10px;color:#888;margin:2px 0 0">${esc(d.dev_eui)} · ${esc(d.type_device)}</p>
      </div>
      ${d.items.map((a: any) => `
        <div style="border:1px solid #f3f4f6;border-radius:8px;margin-bottom:12px;padding:10px;background:#fff">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${typeBadge(a.type)}
            <span style="font-size:10px;color:${a.resolved_at ? '#16a34a' : '#dc2626'};font-weight:600">${a.resolved_at ? '● Resuelta' : '● Activa'}</span>
            <span style="font-size:10px;color:#666;white-space:nowrap">${format(new Date(a.created_at), "dd/MM HH:mm:ss")}</span>
            ${a.resolved_at ? `<span style="font-size:9px;color:#888">→ ${format(new Date(a.resolved_at), "dd/MM HH:mm")}</span>` : ''}
          </div>
          ${a.metadata?.reason ? `<p style="font-size:10px;color:#555;margin:6px 0 0"><b>Motivo:</b> ${esc(a.metadata.reason)}</p>` : ''}
          ${a.metadata?.details ? `<p style="font-size:9px;color:#888;margin:2px 0 0">${esc(typeof a.metadata.details === 'string' ? a.metadata.details : JSON.stringify(a.metadata.details))}</p>` : ''}
          ${(a.type === 'critica' || a.type === 'apertura' || a.type === 'movimientos_anomalos') ? trackMapDiv(a.tracking_data, `${esc(a.type)} ${format(new Date(a.created_at), "dd/MM HH:mm")}`) : ''}
        </div>`).join('')}
    </div>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      @page{margin:12mm 10mm}
      body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0;padding:0}
      .leaflet-container{background:#dfe6ea}
      .leaflet-control-attribution{font-size:8px !important}
      .track-map{page-break-inside:avoid}
    </style>
  </head><body>
    <div style="font-family:Arial,sans-serif;padding:30px">
      <div style="text-align:center;padding:30px 20px">
        <h1 style="font-size:22px;color:#111;margin:0 0 6px">Reporte de Alertas y Tracking</h1>
        <p style="font-size:12px;color:#666">${day} · ${alerts.length} alertas · Generado: ${format(new Date(), "yyyy-MM-dd HH:mm")}</p>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;border:1px solid #fecaca"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Críticas</p><p style="font-size:20px;font-weight:700;color:#ef4444;margin:2px 0 0">${criticals.length}</p></div>
        <div style="flex:1;min-width:100px;background:#fffbeb;border-radius:8px;padding:12px;text-align:center;border:1px solid #fde68a"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Atención</p><p style="font-size:20px;font-weight:700;color:#d97706;margin:2px 0 0">${attentions.length}</p></div>
        <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;border:1px solid #bbf7d0"><p style="font-size:10px;color:#888;margin:0;text-transform:uppercase">Resueltas</p><p style="font-size:20px;font-weight:700;color:#16a34a;margin:2px 0 0">${resolved.length}</p></div>
      </div>
    </div>
    ${deviceSections}
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
    <script>
      window.__TRACK_MAPS__ = ${JSON.stringify(trackMaps)};
      window.__MAPS__ = [];
      function initMaps() {
        var maps = window.__TRACK_MAPS__ || [];
        if (maps.length === 0) { setTimeout(function(){ window.print(); }, 400); return; }
        var pending = 0;
        function checkDone() {
          if (pending <= 0) {
            setTimeout(function(){
              window.__MAPS__.forEach(function(mm){ try { mm.invalidateSize(); } catch(e){} });
              setTimeout(function(){ window.print(); }, 700);
            }, 250);
          }
        }
        maps.forEach(function(m) {
          pending++;
          var finished = false;
          function done() { if (finished) return; finished = true; pending--; checkDone(); }
          var el = document.getElementById(m.id);
          if (!el) { done(); return; }
          try {
            var map = L.map(m.id, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
            window.__MAPS__.push(map);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            var pts = m.points.map(function(p){ return [parseFloat(p.latitude), parseFloat(p.longitude)]; });
            L.polyline(pts, { color: '#ef4444', weight: 3, opacity: 0.85 }).addTo(map);
            pts.forEach(function(pos, i) {
              var isFirst = i === 0, isLast = i === pts.length - 1;
              var color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
              L.circleMarker(pos, { radius: isFirst || isLast ? 8 : 4, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }).addTo(map);
            });
            map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
            map.whenReady(function(){ setTimeout(function(){ map.invalidateSize(); }, 100); });
            map.on('load', done);
            setTimeout(done, 8000);
          } catch (e) { done(); }
        });
      }
      if (document.readyState === 'complete') initMaps();
      else window.addEventListener('load', initMaps);
    <\/script>
  </body></html>`;
  const win = window.open('', '_blank', 'width=1000,height=1400');
  win?.document.write(html);
  win?.document.close();
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
    const map = new Map<number, MonitorCalendarDay>();
    (calendar || []).forEach(d => map.set(Number(d.dia), d as MonitorCalendarDay));
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
        <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg bg-bg-200/40 hover:bg-bg-200/70 text-text-200 hover:text-text-100 transition-colors border border-border/20">
              <IconChevronLeft size={18} />
            </button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg bg-bg-200/40 hover:bg-bg-200/70 text-text-200 hover:text-text-100 transition-colors border border-border/20">
              <IconChevronRight size={18} />
            </button>
          </div>
          <div className="text-center">
            <h3 className="text-base font-extrabold text-text-100 capitalize tracking-tight">{format(new Date(year, month - 1), "MMMM yyyy", { locale: es })}</h3>
            <p className="text-[10px] text-text-300 mt-0.5">
              {daysInMonth} días · {calendar?.reduce((s, d) => s + (d.total || 0), 0) || 0} alertas
            </p>
          </div>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDate(null); }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${year === today.getFullYear() && month === today.getMonth() + 1 ? "bg-brand-100/15 text-brand-100 border-brand-100/30" : "bg-bg-200/40 text-text-200 hover:bg-bg-200/70 border-border/20"}`}>
            Hoy
          </button>
        </div>

        {/* Day names */}
        <div className="shrink-0 grid grid-cols-7 px-2 py-1.5 text-[10px] font-bold text-text-300 uppercase tracking-wider text-center border-b border-border/10">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
            <span key={d} className="py-0.5">{d}</span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto p-2 bg-bg-100">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayData = calendarMap.get(day) as MonitorCalendarDay | undefined;
              const isT = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isS = selectedDate === dayStr;
              const hasAlerts = dayData && dayData.total > 0;

              let severity: "none" | "critical" | "warning" = "none";
              if (hasAlerts) {
                if (dayData!.criticas > 0 || dayData!.apertura > 0 || dayData!.presencia > 0 || dayData!.desconexion > 0) severity = "critical";
                else if (dayData!.atencion > 0 || dayData!.movimientos > 0) severity = "warning";
              }

              const severityStyle: Record<"critical" | "warning", { background: string; borderLeft: string }> = {
                critical: { background: "rgba(239,68,68,0.25)", borderLeft: "3px solid rgb(239,68,68)" },
                warning:  { background: "rgba(234,179,8,0.25)", borderLeft: "3px solid rgb(234,179,8)" },
              };

              return (
                <button key={day} onClick={() => setSelectedDate(isS ? null : dayStr)}
                  style={severity !== "none" ? { ...severityStyle[severity], borderRadius: 10 } : undefined}
                  className={`relative rounded-lg p-1.5 text-left transition-all min-h-[64px] border group ${isS ? "ring-2 ring-brand-100/60 border-brand-100/40 shadow-lg shadow-brand-100/5" : isT && severity === "none" ? "ring-1 ring-brand-200/30 border-brand-200/20" : severity === "none" ? "border-transparent hover:border-border/30 hover:bg-bg-200/50 hover:shadow-sm" : "border-transparent hover:border-border/30 hover:shadow-sm"}`}>
                  <div className="flex items-start justify-between gap-1">
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md text-[11px] font-bold ${isT ? "bg-brand-100/20 text-brand-100" : severity === "critical" ? "bg-red-500/15 text-red-400" : severity === "warning" ? "bg-yellow-500/15 text-yellow-400" : "text-text-200"}`}>{day}</span>
                    {hasAlerts && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${severity === "critical" ? "bg-red-500/20 text-red-300" : severity === "warning" ? "bg-yellow-500/20 text-yellow-300" : "bg-bg-200/60 text-text-300"}`}>
                        {dayData!.total}
                      </span>
                    )}
                  </div>
                  {hasAlerts && (
                    <div className="mt-1 space-y-[2px]">
                      {dayData!.criticas > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 shadow-[0_0_4px_rgba(248,113,113,0.6)]" /><span className="text-[9px] text-red-300 font-medium truncate">Crítica {dayData!.criticas}</span></div>}
                      {dayData!.apertura > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span className="text-[9px] text-red-300 font-medium truncate">Apertura {dayData!.apertura}</span></div>}
                      {dayData!.presencia > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" /><span className="text-[9px] text-rose-300 font-medium truncate">Presencia {dayData!.presencia}</span></div>}
                      {dayData!.atencion > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" /><span className="text-[9px] text-yellow-300 font-medium truncate">Atención {dayData!.atencion}</span></div>}
                      {dayData!.movimientos > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" /><span className="text-[9px] text-orange-300 font-medium truncate">Mov. {dayData!.movimientos}</span></div>}
                      {dayData!.desconexion > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /><span className="text-[9px] text-amber-300 font-medium truncate">Descon. {dayData!.desconexion}</span></div>}
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
        <div className="w-[45%] rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0 animate-fade-in-up">
          <div className="shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between bg-bg-200/30">
            <div>
              <h3 className="text-sm font-bold text-text-100">
                Alertas del {format(new Date(selectedDate), "d 'de' MMMM", { locale: es })}
              </h3>
              <p className="text-[11px] text-text-300 mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${alerts && alerts.length > 0 ? "bg-green-400" : "bg-text-300"}`} />
                {alerts?.length || 0} alertas
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {alerts && alerts.length > 0 && (
                <button onClick={() => exportPDF(selectedDate, alerts)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm shadow-green-600/20">
                  <IconFileReport size={14} /> PDF
                </button>
              )}              <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-lg hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
                <IconX size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full"><p className="text-[13px] text-text-300 animate-pulse">Cargando...</p></div>
            ) : !alerts || alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <IconAlertCircle size={28} className="text-text-300/60" />
                <p className="text-[13px] text-text-300">Sin alertas este día</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                    <th className="text-left py-2 px-2 font-medium w-[28px]"> </th>
                    <th className="text-left py-2 px-2 font-medium">Dispositivo</th>
                    <th className="text-left py-2 px-2 font-medium">Tipo</th>
                    <th className="text-left py-2 px-2 font-medium">Alerta</th>
                    <th className="text-left py-2 px-2 font-medium w-[52px]">Hora</th>
                    <th className="text-right py-2 px-2 font-medium w-[68px]">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a: any, i: number) => {
                    const conf = TYPE_LABELS[a.type] || { label: a.type, color: "text-text-300 bg-bg-200/60", icon: IconAlertCircle };
                    const Icon = conf.icon;
                    return (
                      <tr key={a.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                        <td className="py-1.5 px-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${conf.color}`}>
                            <Icon size={10} />
                          </div>
                        </td>
                        <td className="py-1.5 px-2 font-semibold text-text-100 truncate max-w-[130px]">{a.device_name}</td>
                        <td className="py-1.5 px-2 text-text-300 text-[10px]">{a.type_device}</td>
                        <td className="py-1.5 px-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${conf.color}`}>{conf.label}</span>
                        </td>
                        <td className="py-1.5 px-2 text-text-300 font-mono text-[10px]">{format(new Date(a.created_at), "HH:mm")}</td>
                        <td className="py-1.5 px-2 text-right">
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
  dia: number; total: number; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number;
}
