import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MonitorHeatMap from "../tecnico/MonitorHeatMap";
import ResumenActiveDevices, { type DiaActivos } from "./ResumenActiveDevices";

export type EstadoSensor = "activo" | "inactivo";

/** ahora → grilla por PK con el estado de reporte; mapa → mapa geográfico en vista cobertura */
export type VistaActividad = "ahora" | "mapa";

export interface SensorActividad {
  id: number;
  name: string;
  devEui: string;
  tipo: string;
  estado: EstadoSensor;
  /** Ubicación parseada del nombre (V1PK6/11-13 → vía 1, PK 6, poste 11) */
  via: number | null;
  pk: number | null;
  poste: number | null;
  /** Último dato: "02/11 14:32 · hace 5 min" o "nunca reportó" */
  ultimo: string;
  /** Lectura principal (batería / banco 12 V) ya formateada */
  bateria: string | null;
}

function colorCelda(s: SensorActividad): string {
  return s.estado === "activo" ? "bg-emerald-500" : "bg-slate-400/70";
}

function estadoVisible(s: SensorActividad): { label: string; className: string } {
  return s.estado === "activo"
    ? { label: "Reportando", className: "resumen-num-ok" }
    : { label: "Sin reporte", className: "resumen-num-muted" };
}

interface Hover {
  s: SensorActividad;
  x: number;
  y: number;
  /** true = el tooltip se abre hacia abajo (celda cerca del borde superior) */
  abajo: boolean;
}

/**
 * Mapa de actividad: un cuadro por sensor con su estado de reporte.
 * Verde = reportando, plomo = sin reporte (no muestra alertas).
 * Al pasar el mouse se muestra el sensor y su último dato.
 */
export default function ResumenSensorActivity({ sensores, activosPorDia = [], onOpenDevice }: { sensores: SensorActividad[]; activosPorDia?: DiaActivos[]; onOpenDevice?: (id: number) => void }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [vista, setVista] = useState<VistaActividad>("ahora");

  // Agrupados por vía + PK y ordenados como el recorrido de la vía:
  // PK ascendente y, dentro de cada PK, por número de poste.
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; via: number | null; pk: number | null; sensores: SensorActividad[] }>();
    for (const s of sensores) {
      const key = s.pk == null ? "sin-pk" : `v${s.via ?? 0}-p${s.pk}`;
      let g = map.get(key);
      if (!g) { g = { key, via: s.via, pk: s.pk, sensores: [] }; map.set(key, g); }
      g.sensores.push(s);
    }
    const lista = [...map.values()];
    for (const g of lista) {
      g.sensores.sort((a, b) =>
        (a.poste ?? Number.MAX_SAFE_INTEGER) - (b.poste ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name, "es", { numeric: true }));
    }
    lista.sort((a, b) => {
      if (a.pk == null && b.pk == null) return 0;
      if (a.pk == null) return 1;
      if (b.pk == null) return -1;
      return (a.via ?? 0) - (b.via ?? 0) || a.pk - b.pk;
    });
    return lista;
  }, [sensores]);

  const conteo = useMemo(() => {
    let activos = 0, sinReporte = 0;
    for (const s of sensores) {
      if (s.estado === "activo") activos += 1;
      else sinReporte += 1;
    }
    return { activos, sinReporte };
  }, [sensores]);

  return (
    <div className="rounded-lg resumen-card flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 resumen-card-head">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">
          Mapa de actividad de sensores
          <span className="ml-1.5 text-text-300 normal-case tracking-normal font-medium">({sensores.length})</span>
        </p>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden sm:inline text-[12px] text-text-200 whitespace-nowrap">
            <span className="font-bold resumen-num-ok">{conteo.activos}</span> activos ·{" "}
            <span className="font-bold resumen-num-muted">{conteo.sinReporte}</span> sin reporte
          </span>
          <div className="flex items-center gap-0.5 rounded-lg resumen-seg p-0.5">
            {([
              ["ahora", "Ahora", "Grilla por PK con el estado de reporte de cada sensor"],
              ["mapa", "Mapa", "Mapa geográfico en vista cobertura, con sensores, gateways y popups"],
            ] as const).map(([v, label, hint]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                title={hint}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${vista === v ? "resumen-seg-btn text-text-100" : "text-text-300 hover:text-text-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vista === "mapa" ? (
        <div className="flex-1 min-h-0">
          <MonitorHeatMap compact initialView="cobertura" />
        </div>
      ) : (
      <>
      <div className="flex-1 min-h-0 overflow-y-auto p-2" onMouseLeave={() => setHover(null)}>
        {sensores.length === 0 ? (
          <p className="text-[11px] text-text-300 text-center py-6">Sin sensores</p>
        ) : (
          <div
            className="grid gap-x-2 gap-y-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))" }}
          >
            {/* Columnas de ancho uniforme: cada PK ocupa la misma celda, así las etiquetas
                quedan alineadas en filas y columnas aunque tengan distinta cantidad de sensores. */}
            {grupos.map(g => (
              <div key={g.key} className="min-w-0">
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-200 whitespace-nowrap">
                    {g.pk == null ? "Sin PK" : `PK ${g.pk}`}
                  </span>
                </div>
                {/* Todos los sensores del PK en una sola línea: crecen hasta 14 px y se
                    achican si el tramo tiene muchos, sin desbordar la columna. */}
                <div className="flex gap-0.75">
                  {g.sensores.map(s => (
                    <div
                      key={s.id}
                      title={`${s.name} · ${s.ultimo}`}
                      className={`flex-1 min-w-0 max-w-3.5 aspect-square rounded-xs ${onOpenDevice ? "cursor-pointer" : "cursor-help"} ${colorCelda(s)}`}
                      onClick={onOpenDevice ? () => { setHover(null); onOpenDevice(s.id); } : undefined}
                      onMouseEnter={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const abajo = r.top < 110;
                        setHover({ s, x: r.left + r.width / 2, y: abajo ? r.bottom : r.top, abajo });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 h-28 border-t border-border/50 p-2">
        <ResumenActiveDevices data={activosPorDia} embedded />
      </div>
      </>
      )}

      {/* Tooltip con el sensor y su último dato (en portal: no lo recortan los overflow del layout) */}
      {hover && createPortal(
        <div
          className={`fixed z-60 pointer-events-none -translate-x-1/2 ${hover.abajo ? "" : "-translate-y-full"}`}
          style={{
            left: Math.min(Math.max(hover.x, 110), (typeof window !== "undefined" ? window.innerWidth : 1200) - 110),
            top: hover.abajo ? hover.y + 8 : hover.y - 8,
          }}
        >
          <div className="rounded-lg border border-border bg-bg-200 shadow-2xl px-2.5 py-2 min-w-52 max-w-64">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-sm shrink-0 ${colorCelda(hover.s)}`} />
              <p className="text-[12px] font-bold text-text-100 truncate">{hover.s.name}</p>
            </div>
            <p className="text-[10px] font-mono text-text-300 truncate mt-0.5">
              {hover.s.devEui} · {hover.s.tipo === "SubEstacion" ? "SubEst." : hover.s.tipo}
            </p>
            <div className="mt-1.5 pt-1.5 border-t border-border/60 space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-300">Estado</span>
                <span className={`font-semibold ${estadoVisible(hover.s).className}`}>
                  {estadoVisible(hover.s).label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-300">Último dato</span>
                <span className="font-medium text-text-100 text-right">{hover.s.ultimo}</span>
              </div>
              {hover.s.bateria && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-300">Batería</span>
                  <span className="font-medium text-text-100 font-mono">{hover.s.bateria}</span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
