import { useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
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
}: DataTableWidgetProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Ordenar ─────────────────────────────────────────────────────────────
  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

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

  const cellPad = compact ? "px-3 py-1.5" : "px-4 py-2.5";

  return (
    <WidgetContainer
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
      gridPosition={gridPosition}
      absolutePosition={absolutePosition}
      draggable={draggable}
      className={className}
      style={style}
      onPositionChange={onPositionChange}
    >
      <div className="overflow-x-auto -mx-4 -my-4">
        <table className="w-full text-sm text-left">
          {/* ── Head ──────────────────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-border/30 bg-bg-100">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={[
                    cellPad,
                    "text-xs font-semibold text-text-200 uppercase tracking-wide whitespace-nowrap",
                    "cursor-pointer select-none hover:text-text-100 transition-colors",
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
                  className="px-4 py-8 text-center text-text-400 text-sm"
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
                    striped && ri % 2 === 1 ? "bg-bg-100/60" : "",
                    hoverable ? "hover:bg-bg-100/70" : "",
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
