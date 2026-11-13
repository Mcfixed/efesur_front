import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import { isFreshForDevice } from "../../utils/online";
import type { MonitorDevice } from "../../types/monitor.types";

/**
 * Selector de equipo para el título de los paneles de detalle: lista desplegable + flechas
 * anterior/siguiente, para cambiar de equipo sin volver a la tabla.
 */
interface Props {
  devices: MonitorDevice[];
  currentId: number;
  onSelect?: (device: MonitorDevice) => void;
  /** Separa la lista en "Activos" e "Inactivos" (sensores) */
  agrupar?: boolean;
  /** Texto de respaldo cuando la lista está vacía */
  fallbackName?: string | null;
}

/** ¿El equipo está reportando ahora? (mismo criterio que el resto del panel) */
function estaReportando(d: MonitorDevice): boolean {
  if (!d.is_active || !d.last_seen) return false;
  return isFreshForDevice(new Date(d.last_seen).getTime(), d.type_device);
}

const nombre = (d: MonitorDevice) => String(d.name || "").replace(/^Gateway\s/, "");

export default function DeviceSwitcher({ devices, currentId, onSelect, agrupar, fallbackName }: Props) {
  const ordenados = useMemo(
    () => [...devices].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [devices],
  );

  const activos = useMemo(() => (agrupar ? ordenados.filter(estaReportando) : ordenados), [ordenados, agrupar]);
  const inactivos = useMemo(() => (agrupar ? ordenados.filter(d => !estaReportando(d)) : []), [ordenados, agrupar]);

  const idx = ordenados.findIndex(d => d.id === currentId);
  const ir = (i: number) => {
    if (!ordenados.length || !onSelect) return;
    const next = ordenados[(i + ordenados.length) % ordenados.length];
    if (next && next.id !== currentId) onSelect(next);
  };

  const actual = ordenados.find(d => d.id === currentId) ?? null;
  const actualOn = actual ? estaReportando(actual) : false;

  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const abrir = () => {
    if (!onSelect || ordenados.length === 0) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(Math.max(260, r.width + 60), 380);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const espacioAbajo = window.innerHeight - r.bottom;
    // Si no cabe abajo, se abre hacia arriba
    setPos(espacioAbajo > 320
      ? { left, width, top: r.bottom + 4 }
      : { left, width, bottom: window.innerHeight - r.top + 4 });
    setBusqueda("");
    setOpen(true);
  };
  const cerrar = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      cerrar();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    // Cerrar al hacer scroll de la página, pero NO cuando el scroll ocurre dentro del panel
    // (al abrir centramos el equipo actual con scrollIntoView, y eso lo cerraba al instante).
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      cerrar();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Al abrir, deja visible el equipo actual
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>("[data-actual='1']")?.scrollIntoView({ block: "center" });
  }, [open]);

  const elegir = (d: MonitorDevice) => {
    cerrar();
    if (d.id !== currentId) onSelect?.(d);
  };

  const filtrar = (lista: MonitorDevice[]) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(d =>
      String(d.name || "").toLowerCase().includes(q) || String(d.dev_eui || "").toLowerCase().includes(q));
  };

  const grupos: { titulo: string | null; lista: MonitorDevice[] }[] = agrupar
    ? [
        { titulo: `Activos (${activos.length})`, lista: filtrar(activos) },
        { titulo: `Inactivos (${inactivos.length})`, lista: filtrar(inactivos) },
      ].filter(g => g.lista.length > 0)
    : [{ titulo: null, lista: filtrar(ordenados) }];

  const item = (d: MonitorDevice) => {
    const on = estaReportando(d);
    const esActual = d.id === currentId;
    return (
      <button
        key={d.id}
        data-actual={esActual ? "1" : undefined}
        onClick={() => elegir(d)}
        className={`w-full text-left px-2 py-0.75 rounded flex items-center gap-1.5 text-[12px] transition-colors ${
          esActual ? "bg-bg-300/70 text-text-100 font-semibold" : "text-text-200 hover:bg-bg-200/70 hover:text-text-100"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? "bg-emerald-400" : "bg-rose-400/70"}`} />
        <span className="truncate">{nombre(d)}</span>
      </button>
    );
  };

  return (
    <div className="flex items-center gap-0.5 min-w-0">
      {ordenados.length > 1 && (
        <button
          onClick={() => ir(idx - 1)}
          disabled={!onSelect}
          title="Equipo anterior"
          aria-label="Equipo anterior"
          className="shrink-0 p-0.5 rounded text-text-300 hover:text-text-100 hover:bg-bg-300/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <IconChevronLeft size={15} stroke={2.2} />
        </button>
      )}

      <div className="min-w-0">
        <button
          ref={btnRef}
          onClick={() => (open ? cerrar() : abrir())}
          disabled={!onSelect || ordenados.length === 0}
          title="Cambiar de equipo"
          className="min-w-0 max-w-[18rem] flex items-center gap-1.5 px-1 -ml-1 rounded-md hover:bg-bg-300/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${actualOn ? "bg-emerald-400" : "bg-rose-400/80"}`} />
          <span className="text-[16px] font-bold tracking-tight leading-tight text-text-100 truncate">
            {actual ? nombre(actual) : (fallbackName || "Sin equipos")}
          </span>
          <IconChevronDown
            size={13}
            stroke={2.2}
            className={`shrink-0 text-text-300 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className="fixed z-9999 rounded-lg border border-border/60 bg-bg-100 shadow-2xl shadow-black/40 overflow-hidden"
        >
          {ordenados.length > 8 && (
            <div className="p-1.5 border-b border-border/40">
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar equipo…"
                className="w-full bg-bg-200/60 border border-border/40 rounded px-2 py-1 text-[11px] text-text-100 placeholder:text-text-300 outline-none focus:border-border-200"
              />
            </div>
          )}
          <div ref={listRef} className="max-h-[min(60vh,20rem)] overflow-y-auto p-1">
            {grupos.map((g, gi) => (
              <div key={g.titulo ?? `g${gi}`}>
                {g.titulo && (
                  <p className="px-2 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-text-300">
                    {g.titulo}
                  </p>
                )}
                {g.lista.map(item)}
              </div>
            ))}
            {grupos.every(g => g.lista.length === 0) && (
              <p className="px-2 py-2 text-[11px] text-text-300">Sin resultados</p>
            )}
          </div>
        </div>,
        document.body,
      )}

      {ordenados.length > 1 && (
        <button
          onClick={() => ir(idx + 1)}
          disabled={!onSelect}
          title="Equipo siguiente"
          aria-label="Equipo siguiente"
          className="shrink-0 p-0.5 rounded text-text-300 hover:text-text-100 hover:bg-bg-300/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <IconChevronRight size={15} stroke={2.2} />
        </button>
      )}
    </div>
  );
}
