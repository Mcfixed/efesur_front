import { useState, useMemo } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { WidgetContainer } from "../base/WidgetContainer";
import type { DataTableWidgetProps, TableColumn } from "../types";

/**
 * Widget de tabla de datos con paginación y orden de columnas.
 *
 * @example
 * <DataTableWidget
 *   title="Dispositivos"
 *   data={devices}
 *   columns={[
 *     { key: "nombre", header: "Nombre" },
 *     { key: "estado", header: "Estado", render: (v) => <Badge>{v}</Badge> },
 *     { key: "ip", header: "IP" },
 *   ]}
 *   pageSize={8}
 *   striped
 *   gridPosition={{ colSpan: 12 }}
 * />
 */
export function DataTableWidget<T extends object>({
  title,
  subtitle,
  headerActions,
  gridPosition,
  absolutePosition,
  draggable,
  className,
  style,
  onPositionChange,
  data,
  columns,
  pageSize = 8,
  striped = true,
  hoverable = true,
  compact = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
}: DataTableWidgetProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  // ─── Buscar (por valores crudos y texto de renders) ──────────────────────
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!searchable || !q) return data;
    return data.filter((row) =>
      columns.some((col) => {
        const raw = row[col.key];
        const rawStr = raw == null ? "" : String(raw).toLowerCase();
        if (rawStr.includes(q)) return true;
        if (col.render) {
          const r = col.render(row[col.key], row);
          if (typeof r === "string" || typeof r === "number") {
            if (String(r).toLowerCase().includes(q)) return true;
          }
        }
        return false;
      })
    );
  }, [data, columns, searchable, searchTerm]);

  // ─── Ordenar ─────────────────────────────────────────────────────────────
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  // ─── Paginar ─────────────────────────────────────────────────────────────
  const total = sorted.length;
  const pages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  const visible =
    pageSize > 0 ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;

  const handleSort = (col: TableColumn<T>) => {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const cellPad = compact ? "py-1.5 px-2" : "py-2 px-2";

  return (
    <WidgetContainer
      title={title}
      subtitle={subtitle}
      headerActions={
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300" />
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="w-52 pl-7 pr-7 py-1.5 text-xs rounded-md bg-bg-200/60 border border-border/30 text-text-100 placeholder:text-text-300 focus:outline-none focus:border-brand-200/50 focus:ring-1 focus:ring-brand-200/30 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setPage(0);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-300 hover:text-text-200 transition-colors"
                  title="Limpiar búsqueda"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          )}
          {headerActions}
        </div>
      }
      gridPosition={gridPosition}
      absolutePosition={absolutePosition}
      draggable={draggable}
      className={className}
      style={style}
      onPositionChange={onPositionChange}
    >
      <div className="overflow-x-auto -mx-4 -my-4">
        <table className="w-full text-xs text-left">
          {/* ── Head ──────────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={[
                    cellPad,
                    "text-left font-medium whitespace-nowrap cursor-pointer select-none hover:text-text-100 transition-colors",
                  ].join(" ")}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <IconChevronUp size={12} />
                      ) : (
                        <IconChevronDown size={12} />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-text-300 text-xs"
                >
                  Sin datos
                </td>
              </tr>
            ) : (
              visible.map((row, ri) => (
                <tr
                  key={ri}
                  className={[
                    "border-b border-border/20 transition-colors",
                    striped ? (ri % 2 === 1 ? "bg-bg-200/30" : "bg-bg-100") : "bg-bg-100",
                    hoverable ? "hover:bg-bg-200/60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`${cellPad} text-text-200`}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ────────────────────────────────────────────────────── */}
      {pageSize > 0 && pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-400">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de{" "}
            {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded hover:bg-bg-100/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronLeft size={14} />
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded hover:bg-bg-100/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
}
