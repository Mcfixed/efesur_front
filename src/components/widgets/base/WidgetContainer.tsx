import {
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { IconGripHorizontal, IconX } from "@tabler/icons-react";
import type { WidgetContainerProps, WidgetAbsolutePosition } from "../types";

/**
 * Contenedor base de widget.
 *
 * – En modo **grid** (default): se posiciona mediante `gridPosition`
 *   (colSpan, rowSpan, col, row) dentro de un `WidgetGrid`.
 * – En modo **absoluto**: flota sobre la página y puede arrastrarse.
 */
export function WidgetContainer({
  title,
  subtitle,
  headerActions,
  gridPosition,
  absolutePosition,
  draggable = false,
  className = "",
  style,
  children,
  onPositionChange,
}: WidgetContainerProps) {
  // ─── Estado de posición para modo absoluto ────────────────────────────────
  const [pos, setPos] = useState<WidgetAbsolutePosition>(
    absolutePosition ?? { x: 0, y: 0 }
  );
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Drag handlers (sólo en modo absoluto + draggable) ───────────────────
  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!absolutePosition || !draggable) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragOffset.current = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
      };

      const onMove = (ev: globalThis.MouseEvent) => {
        if (!dragOffset.current) return;
        const newPos: WidgetAbsolutePosition = {
          ...pos,
          x: ev.clientX - dragOffset.current.dx,
          y: ev.clientY - dragOffset.current.dy,
        };
        setPos(newPos);
        onPositionChange?.(newPos);
      };

      const onUp = () => {
        dragOffset.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [absolutePosition, draggable, pos, onPositionChange]
  );

  // ─── Estilos dinámicos ────────────────────────────────────────────────────
  const containerStyle: CSSProperties = absolutePosition
    ? {
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: absolutePosition.width ?? "auto",
        height: absolutePosition.height ?? "auto",
        zIndex: 100,
        ...style,
      }
    : gridPosition
    ? {
        gridColumn: gridPosition.col
          ? `${gridPosition.col} / span ${gridPosition.colSpan ?? 1}`
          : `span ${gridPosition.colSpan ?? 1}`,
        gridRow: gridPosition.row
          ? `${gridPosition.row} / span ${gridPosition.rowSpan ?? 1}`
          : gridPosition.rowSpan
          ? `span ${gridPosition.rowSpan}`
          : undefined,
        ...style,
      }
    : style;

  const isDraggable = absolutePosition && draggable;

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={[
        "flex flex-col rounded-lg border border-border/30 bg-bg-100 shadow overflow-hidden",
        isDraggable ? "cursor-grab active:cursor-grabbing select-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      {(title || headerActions || isDraggable) && (
        <div
          className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-border/30"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isDraggable && (
              <IconGripHorizontal
                size={16}
                className="shrink-0 text-text-200"
              />
            )}
            <div className="min-w-0">
              {title && (
                <p className="text-sm font-semibold text-text-100 truncate">
                  {title}
                </p>
              )}
              {subtitle && (
                <p className="text-xs text-text-200 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {headerActions && (
            <div className="flex items-center gap-1 shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 min-h-0">{children}</div>
    </div>
  );
}

// ─── Botón utilitario para acciones del header ──────────────────────────────
interface WidgetHeaderButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}

export function WidgetHeaderButton({
  onClick,
  icon,
  label,
}: WidgetHeaderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="p-1 rounded-md text-text-200 hover:text-text-100 hover:bg-bg-300 transition-colors"
    >
      {icon}
    </button>
  );
}

/** Botón de cierre listo para usar en `headerActions` */
export function WidgetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <WidgetHeaderButton
      onClick={onClose}
      label="Cerrar widget"
      icon={<IconX size={14} />}
    />
  );
}
