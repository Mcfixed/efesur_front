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

  // Se escala contra el máximo, pero con un piso del 45 %: con valores casi iguales (238-245)
  // las barras se verían todas iguales. El número exacto va arriba de cada barra.
  const altura = (v: number) => (max <= 0 ? 0 : max === min ? 70 : 45 + Math.round(((v - min) / (max - min)) * 55));

  return (
    <div className={embedded ? "flex flex-col h-full min-h-0" : "rounded-lg resumen-card flex flex-col min-h-0 overflow-hidden"}>
      <div className={embedded ? "shrink-0 flex items-center justify-between gap-2 pb-1" : "shrink-0 flex items-center justify-between gap-2 px-3 py-2 resumen-card-head"}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">
          Dispositivos activos
          <span className="ml-1.5 text-text-400 normal-case tracking-normal font-medium">(últimos 7 días)</span>
        </p>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-text-200">
          {valores.length ? `${valores[valores.length - 1]} hoy` : "—"}
        </span>
      </div>

      <div className={embedded ? "flex-1 min-h-0 flex items-stretch gap-1.5" : "flex-1 min-h-0 flex items-stretch gap-1.5 px-3 pt-2 pb-1.5"}>
        {serie.length === 0 ? (
          <p className="text-[11px] text-text-200 text-center w-full py-4 self-center">Sin datos</p>
        ) : serie.map(d => (
          <div key={d.dia} className="flex-1 min-w-0 flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-text-200">{d.activos}</span>
            <div className="flex-1 w-full flex items-end rounded-md bg-bg-200/70 overflow-hidden">
              <div
                className="w-full rounded-md bg-emerald-500"
                style={{ height: `${altura(Number(d.activos) || 0)}%` }}
                title={`${d.activos} dispositivos activos · ${etiqueta(d.dia)}`}
              />
            </div>
            <span className="text-[9px] text-text-200 whitespace-nowrap">{etiqueta(d.dia)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
