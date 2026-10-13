import { useMemo, useState } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { IconX, IconFileSpreadsheet, IconAlertTriangle, IconFileTypePdf } from "@tabler/icons-react";
import { useMonitorDayReport } from "../../hooks/useMonitor";
import { voltageToPercent } from "../../utils/battery";
import type { MonitorDaySensor } from "../../types/monitor.types";

interface Props {
  dia: string;            // YYYY-MM-DD (día de Chile)
  onClose: () => void;
}

type Filtro = "todos" | "ok" | "sin";

// ─── Colores por umbral (mismos criterios que el mapa de calor y el panel de sensores) ───
function rssiClass(rssi: number | null): string {
  if (rssi == null) return "text-gray-600";
  if (rssi >= -100) return "text-green-400";
  if (rssi >= -110) return "text-teal-400";
  if (rssi >= -118) return "text-sky-400";
  if (rssi >= -120) return "text-orange-400";
  return "text-red-400";
}
function snrClass(snr: number | null): string {
  if (snr == null) return "text-gray-600";
  if (snr >= 10) return "text-green-400";
  if (snr >= 5) return "text-yellow-400";
  return "text-red-400";
}
function batClass(mv: number | null): string {
  const pct = voltageToPercent(mv);
  if (pct == null) return "text-gray-600";
  if (pct >= 50) return "text-green-400";
  if (pct >= 20) return "text-orange-400";
  return "text-red-400";
}

const fmtBat = (mv: number | null) => (mv == null ? "—" : `${(mv / 1000).toFixed(2)} V · ${voltageToPercent(mv)}%`);
const fmtFecha = (ts: string | null, conHora = false) => (ts ? format(new Date(ts), conHora ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy") : "—");

export default function MonitorDayReportModal({ dia, onClose }: Props) {
  const { data, isLoading, isError } = useMonitorDayReport(dia);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const sensores = useMemo(() => data?.sensores ?? [], [data]);
  const filas = useMemo(() => {
    if (filtro === "ok") return sensores.filter(s => s.ultimo_ts);
    if (filtro === "sin") return sensores.filter(s => !s.ultimo_ts);
    return sensores;
  }, [sensores, filtro]);

  const total = data?.total ?? 0;
  const conDatos = data?.conDatos ?? 0;
  const sinDatos = data?.sinDatos ?? 0;
  const cobertura = total > 0 ? Math.round((conDatos / total) * 100) : 0;

  // ─── Excel: la columna "Estado" permite filtrar/ordenar (SheetJS community no escribe colores) ───
  // Se exporta lo que se está viendo: si hay un filtro activo, solo esas filas.
  const exportExcel = () => {
    const rows = filas.map(s => ({
      "Sensor": s.name,
      "Estado": s.ultimo_ts ? "OK" : "SIN DATOS",
      "Batería (V)": s.bat_mv != null ? Number((s.bat_mv / 1000).toFixed(2)) : "",
      "Batería (%)": voltageToPercent(s.bat_mv) ?? "",
      "Mejor gateway": s.gw_name ?? (s.gw_eui ? `(no registrado) ${s.gw_eui}` : ""),
      "SNR (dB)": s.snr ?? "",
      "RSSI (dBm)": s.rssi ?? "",
      "Último dato (día)": s.ultimo_ts ? format(new Date(s.ultimo_ts), "yyyy-MM-dd HH:mm:ss") : "",
      "Último dato conocido": s.last_seen_global ? format(new Date(s.last_seen_global), "yyyy-MM-dd HH:mm:ss") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 32 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 10 }, { wch: 11 }, { wch: 20 }, { wch: 20 }];
    ws["!autofilter"] = { ref: `A1:I${rows.length + 1}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sensores ${dia}`);
    XLSX.writeFile(wb, `sensores_${dia}.xlsx`);
  };

  // ─── PDF: mismo patrón que los informes de la app (HTML + imprimir → "Guardar como PDF") ───
  // Aquí sí se pueden usar colores (a diferencia del .xlsx), así que los sin datos van en rojo.
  const exportPdf = () => {
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const filasHtml = filas.map(s => {
      const ok = !!s.ultimo_ts;
      const gw = s.gw_name ?? (s.gw_eui ? `(no registrado) ${String(s.gw_eui).slice(-6)}` : "—");
      const gris = "color:#9ca3af";
      const celda = (txt: string, extra = "") => `<td style="padding:4px 6px;border:1px solid #e5e7eb;${ok ? "" : gris};${extra}">${txt}</td>`;
      return `<tr style="break-inside:avoid;${ok ? "" : "background:#f9fafb"}">
        ${celda(`<b>${esc(s.name)}</b><br><span style="font-size:9px;color:#9ca3af">${esc(s.dev_eui)}</span>`)}
        ${celda(ok ? "<span style=\"color:#047857;font-weight:700\">OK</span>" : "<span style=\"color:#b91c1c;font-weight:700\">SIN DATOS</span>")}
        ${celda(esc(fmtBat(s.bat_mv)), "text-align:right;font-family:monospace")}
        ${celda(esc(gw))}
        ${celda(s.snr != null ? s.snr.toFixed(2) : "—", "text-align:right;font-family:monospace")}
        ${celda(s.rssi != null ? s.rssi.toFixed(0) : "—", "text-align:right;font-family:monospace")}
        ${celda(ok ? esc(fmtFecha(s.ultimo_ts, true)) : `<span style="color:#b91c1c">sin datos</span> · últ. ${esc(fmtFecha(s.last_seen_global))}`, "font-size:10px")}
      </tr>`;
    }).join("");

    const filtroTxt = filtro === "todos" ? "todos los sensores" : filtro === "ok" ? "solo con datos" : "solo sin datos";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sensores ${esc(dia)}</title>
      <style>
        @page{size:A4 landscape;margin:10mm}
        body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0}
        table{width:100%;border-collapse:collapse;font-size:10px}
        thead{display:table-header-group}
        th{background:#f3f4f6;border:1px solid #e5e7eb;padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.4px;color:#374151}
        @media print{body{padding:0}}
      </style></head><body>
      <h1 style="font-size:18px;margin:0 0 4px">Reporte de sensores del dia</h1>
      <p style="font-size:11px;color:#6b7280;margin:0 0 10px">${esc(format(new Date(`${dia}T12:00:00`), "dd/MM/yyyy"))} · ${filas.length} filas (${esc(filtroTxt)}) · ${conDatos} con datos · ${sinDatos} sin datos · ${cobertura}% cobertura</p>
      <table>
        <thead><tr>
          <th>Sensor</th><th>Estado</th><th style="text-align:right">Bateria</th><th>Mejor gateway</th>
          <th style="text-align:right">SNR (dB)</th><th style="text-align:right">RSSI (dBm)</th><th>Ultimo dato</th>
        </tr></thead>
        <tbody>${filasHtml || `<tr><td colspan="7" style="padding:8px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af">Sin filas para el filtro seleccionado</td></tr>`}</tbody>
      </table>
      <p style="font-size:9px;color:#9ca3af;margin-top:10px">Generado el ${esc(format(new Date(), "dd/MM/yyyy HH:mm"))} · ordenado por Via/PK/poste</p>
      </body></html>`;

    const win = window.open("", "_blank");
    win?.document.write(html);
    win?.document.close();
    setTimeout(() => win?.print(), 500);
  };

  const filtros: { key: Filtro; label: string; n: number }[] = [
    { key: "todos", label: "Todos", n: total },
    { key: "ok", label: "Con datos", n: conDatos },
    { key: "sin", label: "Sin datos", n: sinDatos },
  ];

  return (
    <div className="absolute inset-0 z-1000 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full max-h-175 w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d0f13]/95 shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
            <IconFileSpreadsheet size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-100">Reporte de sensores del día</h2>
            <p className="text-[11px] text-gray-400">
              {format(new Date(`${dia}T12:00:00`), "dd/MM/yyyy")} · una fila por sensor activo (último registro del día)
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">{conDatos} con datos</span>
              <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">{sinDatos} sin datos</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gray-300">{cobertura}% cobertura</span>
            </div>
            <button onClick={onClose} title="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100">
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Filtros + acción */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
          <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
            {filtros.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${filtro === f.key ? "bg-white/15 text-gray-100" : "text-gray-400 hover:text-gray-100"}`}>
                {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{filas.length} filas (lo que ves)</span>
            <button onClick={exportPdf} disabled={!filas.length} title="Vista previa en PDF (imprimir → Guardar como PDF)"
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
              <IconFileTypePdf size={14} /> PDF
            </button>
            <button onClick={exportExcel} disabled={!filas.length} title="Descargar Excel del día"
              className="flex items-center gap-1.5 rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-1.5 text-[12px] font-semibold text-teal-300 transition-colors hover:bg-teal-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              <IconFileSpreadsheet size={14} /> Descargar Excel
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex h-full items-center justify-center gap-2 text-[13px] text-gray-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
              Cargando reporte...
            </div>
          )}
          {isError && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <IconAlertTriangle size={18} className="text-yellow-400" />
              <p className="text-[13px]">No se pudo cargar el reporte del día</p>
            </div>
          )}
          {!isLoading && !isError && filas.length === 0 && (
            <div className="flex h-full items-center justify-center text-[13px] text-gray-500">Sin sensores para este filtro</div>
          )}
          {!isLoading && !isError && filas.length > 0 && (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#14161a]">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2 text-left font-semibold">Sensor</th>
                  <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  <th className="px-3 py-2 text-left font-semibold">Batería</th>
                  <th className="px-3 py-2 text-left font-semibold">Mejor gateway</th>
                  <th className="px-3 py-2 text-right font-semibold">SNR</th>
                  <th className="px-3 py-2 text-right font-semibold">RSSI</th>
                  <th className="px-4 py-2 text-left font-semibold">Último dato</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((s: MonitorDaySensor) => {
                  const sinDatos = !s.ultimo_ts;
                  return (
                    <tr key={s.id} className={`border-b border-white/5 ${sinDatos ? "bg-white/2" : "hover:bg-white/5"}`}>
                      <td className={`px-4 py-1.5 ${sinDatos ? "text-gray-500" : "text-gray-100"}`}>
                        <span className="block truncate">{s.name}</span>
                        <span className="block font-mono text-[10px] text-gray-600">{s.dev_eui}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {sinDatos ? (
                          <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400">SIN DATOS</span>
                        ) : (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">OK</span>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 font-mono ${batClass(s.bat_mv)}`}>{fmtBat(s.bat_mv)}</td>
                      <td className={`px-3 py-1.5 ${sinDatos ? "text-gray-600" : "text-gray-300"}`}>
                        {s.gw_name ?? (s.gw_eui ? <span className="text-gray-500">(no registrado) {String(s.gw_eui).slice(-6)}</span> : "—")}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${snrClass(s.snr)}`}>{s.snr != null ? s.snr.toFixed(2) : "—"}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${rssiClass(s.rssi)}`}>{s.rssi != null ? s.rssi.toFixed(0) : "—"}</td>
                      <td className="px-4 py-1.5">
                        {sinDatos ? (
                          <span className="text-gray-500">
                            sin datos{s.last_seen_global ? ` · últ. ${fmtFecha(s.last_seen_global)}` : " · nunca reportó"}
                          </span>
                        ) : (
                          <span className="font-mono text-gray-300">{fmtFecha(s.ultimo_ts, true)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 border-t border-white/10 px-4 py-2 text-[10px] text-gray-500">
          Las dos exportaciones incluyen solo las filas visibles (filtro aplicado). El Excel lleva la columna{" "}
          <span className="text-gray-300">Estado</span> (OK / SIN DATOS) con autofiltro, porque SheetJS community no escribe colores de celda;
          el PDF sí imprime los sin datos en rojo.
        </div>
      </div>
    </div>
  );
}
