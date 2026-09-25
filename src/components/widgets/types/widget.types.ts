import type { CSSProperties, ReactNode } from "react";

// ─── Posición en grid ──────────────────────────────────────────────────────────
export interface WidgetGridPosition {
  /** Columna de inicio (1-based) */
  col?: number;
  /** Fila de inicio (1-based) */
  row?: number;
  colSpan?: number;
  rowSpan?: number;
}

// ─── Posición absoluta ─────────────────────────────────────────────────────────
export interface WidgetAbsolutePosition {
  x: number;
  y: number;
  width?: number | string;
  height?: number | string;
}

// ─── Config base del widget container ─────────────────────────────────────────
export interface WidgetContainerProps {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  gridPosition?: WidgetGridPosition;
  /** Si se activa, el widget flota en posición absoluta */
  absolutePosition?: WidgetAbsolutePosition;
  /** Permite arrastrar el widget cuando está en modo absoluto */
  draggable?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Callback cuando cambia la posición por drag */
  onPositionChange?: (pos: WidgetAbsolutePosition) => void;
}

// ─── Widget Grid ──────────────────────────────────────────────────────────────
export interface WidgetGridProps {
  children: ReactNode;
  /** Número de columnas del grid (default: 12) */
  columns?: number;
  gap?: number | string;
  className?: string;
}

// ─── Datos de gráfica genérica ─────────────────────────────────────────────────
export type ChartDataItem = Record<string, string | number>;

// ─── Props compartidas de widgets de gráfica ──────────────────────────────────
export interface BaseChartWidgetProps extends Omit<WidgetContainerProps, "children"> {
  data: ChartDataItem[];
  xAxisKey: string;
  dataKey: string | string[];
  chartHeight?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  compact?: boolean;
}

export interface LineChartWidgetProps extends BaseChartWidgetProps {
  curved?: boolean;
  dot?: boolean;
  strokeWidth?: number;
}

export interface BarChartWidgetProps extends BaseChartWidgetProps {
  stacked?: boolean;
  barSize?: number;
}

export interface PieChartWidgetProps extends Omit<BaseChartWidgetProps, "xAxisKey" | "dataKey"> {
  data: ChartDataItem[];
  dataKey: string;
  nameKey: string;
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
}

export interface AreaChartWidgetProps extends BaseChartWidgetProps {
  curved?: boolean;
  fillOpacity?: number;
}

// ─── Widget Tabla ─────────────────────────────────────────────────────────────
export interface TableColumn<T> {
  key: keyof T;
  header: string;
  width?: string | number;
  render?: (value: any, row: any) => ReactNode;
}

export interface DataTableWidgetProps<T extends object = any>
  extends Omit<WidgetContainerProps, "children"> {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  /** Filas por página (0 = sin paginación) */
  pageSize?: number;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  /** Activa un buscador por texto sobre todas las columnas */
  searchable?: boolean;
  searchPlaceholder?: string;
}

// ─── Widgets de Estado ────────────────────────────────────────────────────────
export type TrendDirection = "up" | "down" | "neutral";

export interface StatCardWidgetProps extends Omit<WidgetContainerProps, "children"> {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    direction: TrendDirection;
    label?: string;
  };
  icon?: ReactNode;
  accentColor?: string;
}

export interface KPIItem {
  label: string;
  value: string | number;
  unit?: string;
  target?: number;
  trend?: TrendDirection;
  color?: string;
}

export interface KPIWidgetProps extends Omit<WidgetContainerProps, "children"> {
  items: KPIItem[];
  columns?: 1 | 2 | 3 | 4;
}

export interface StatusItem {
  id: string;
  label: string;
  status: "online" | "offline" | "warning" | "error" | "idle";
  value?: string;
  lastSeen?: string;
}

export interface StatusListWidgetProps extends Omit<WidgetContainerProps, "children"> {
  items: StatusItem[];
  maxVisible?: number;
}

export interface ProgressItem {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export interface ProgressWidgetProps extends Omit<WidgetContainerProps, "children"> {
  items: ProgressItem[];
}
