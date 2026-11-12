import { useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { IconFileSpreadsheet } from "@tabler/icons-react";
import MonitorDayReportModal from "../shared/MonitorDayReportModal";

export interface DiaActivos {
  dia: string;      // "YYYY-MM-DD" (día de Chile, tal como lo entrega el backend)
  activos: number;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// El backend manda la fecha como "YYYY-MM-DD": se arma en local para no correrse un día
// al interpretarla como UTC.
function parseDia(dia: string): Date {
  const [y, m, d] = dia.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function etiqueta(dia: string): string {
  const d = parseDia(dia);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** Mini gráfico de dispositivos activos por día (últimos 7 días). */
export default function ResumenActiveDevices({ data, embedded = false }: { data: DiaActivos[]; embedded?: boolean }) {
  const serie = data.slice(-7);
  const valores = serie.map(d => Number(d.activos) || 0);
  const max = valores.length ? Math.max(...valores) : 0;
  const min = valores.length ? Math.min(...valores) : 0;

  // Reporte del día (mismo modal del mapa de calor): activos e inactivos del día elegido
  const hoy = format(new Date(), "yyyy-MM-dd");
  const [reportDia, setReportDia] = useState(hoy);
  const [reportOpen, setReportOpen] = useState(false);

  // Se escala contra el máximo, pero con un piso del 45 %: con valores casi iguales (238-245)
  // las barras se verían todas iguales. El número exacto va arriba de cada barra.
  const altura = (v: number) => (max <= 0 ? 0 : max === min ? 70 : 45 + Math.round(((v - min) / (max - min)) * 55));

  return (
    <div className={embedded ? "flex flex-col h-full min-h-0" : "rounded-lg resumen-card flex flex-col min-h-0 overflow-hidden"}>
      <div className={embedded ? "shrink-0 flex items-center justify-between gap-2 pb-1" : "shrink-0 flex items-center justify-between gap-2 px-3 py-2 resumen-card-head"}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">
          Dispositivos activos
          <span className="ml-1.5 text-text-300 normal-case tracking-normal font-medium">(últimos 7 días)</span>
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-200 whitespace-nowrap">
            {valores.length ? `${valores[valores.length - 1]} hoy` : "—"}
          </span>
          <input type="date" value={reportDia} max={hoy}
            onChange={e => setReportDia(e.target.value)}
            title="Día del reporte"
            className="rounded-md border border-border bg-bg-200 px-1.5 py-0.5 text-[11px] text-text-100 outline-none transition-colors focus:border-brand-100/60" />
          <button type="button" onClick={() => setReportOpen(true)} disabled={!reportDia}
            title="Ver el reporte del día (activos e inactivos) y descargarlo en Excel"
            className="flex items-center gap-1 rounded-md border border-brand-100/30 bg-brand-100/10 px-2 py-0.5 text-[11px] font-semibold text-brand-100 transition-colors hover:bg-brand-100/15 disabled:opacity-40 whitespace-nowrap">
            <IconFileSpreadsheet size={12} /> Reporte del día
          </button>
        </div>
      </div>

      <div className={embedded ? "flex-1 min-h-0 flex items-stretch gap-1.5" : "flex-1 min-h-0 flex items-stretch gap-1.5 px-3 pt-2 pb-1.5"}>
        {serie.length === 0 ? (
          <p className="text-[11px] text-text-200 text-center w-full py-4 self-center">Sin datos</p>
        ) : serie.map(d => (
          <div key={d.dia} className="flex-1 min-w-0 flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-text-200">{d.activos}</span>
            <div className="flex-1 w-full flex items-end rounded-md bg-bg-300/70 overflow-hidden">
              <div
                className="w-full rounded-md bg-emerald-500"
                style={{ height: `${altura(Number(d.activos) || 0)}%` }}
                title={`${d.activos} dispositivos activos · ${etiqueta(d.dia)}`}
              />
            </div>
            <span className="text-[10px] text-text-200 whitespace-nowrap">{etiqueta(d.dia)}</span>
          </div>
        ))}
      </div>

      {/* Reporte del día en portal: cubre toda la pantalla sin que lo recorte el overflow del panel */}
      {reportOpen && createPortal(
        <MonitorDayReportModal dia={reportDia} onClose={() => setReportOpen(false)} />,
        document.body,
      )}
    </div>
  );
}
