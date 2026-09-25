import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconActivity, IconAlertTriangle, IconInbox, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { useTheme } from "@/context/ThemeContext";

export interface ActiveSensorsPoint {
  dia: string;
  activos: number;
}

export interface AlertsPerDayPoint {
  dia: string;
  criticas: number;
  atencion: number;
  apertura: number;
  presencia: number;
  movimientos: number;
  desconexion: number;
}

const SENSOR_COLOR = "#14b8a6";

// Orden de apilado: de abajo hacia arriba (el último tramo es el que cierra la barra)
const ALERT_SERIES = [
  { key: "criticas", label: "Críticas", color: "#ef4444" },
  { key: "atencion", label: "Atención", color: "#f59e0b" },
  { key: "movimientos", label: "Movimientos", color: "#a855f7" },
  { key: "presencia", label: "Presencia", color: "#facc15" },
  { key: "apertura", label: "Apertura", color: "#f43f5e" },
  { key: "desconexion", label: "Desconexión", color: "#fb923c" },
] as const;

// Colores de ejes, rejilla y tooltip según el tema activo
function useChartSkin() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    dark,
    axis: dark ? "rgba(255,255,255,0.38)" : "rgba(15,23,42,0.45)",
    grid: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)",
    muted: dark ? "rgba(255,255,255,0.30)" : "rgba(15,23,42,0.32)",
    cursor: dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
    tooltip: dark ? "border-white/10 bg-[#0d0f13]/95" : "border-black/10 bg-white/95",
    tooltipTitle: dark ? "text-white/55" : "text-slate-500",
    tooltipMuted: dark ? "text-white/45" : "text-slate-500",
    tooltipValue: dark ? "text-white" : "text-slate-900",
    tooltipDivider: dark ? "border-white/10" : "border-black/10",
  };
}

type Skin = ReturnType<typeof useChartSkin>;

interface TooltipItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface TooltipInjected {
  active?: boolean;
  label?: string | number;
  payload?: TooltipItem[];
}

function SensorsTooltip({ active, label, payload, skin }: TooltipInjected & { skin: Skin }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-md ${skin.tooltip}`}>
      <p className={`text-[10px] font-medium ${skin.tooltipTitle}`}>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: SENSOR_COLOR }} />
        <span className={`text-[12px] font-bold tabular-nums ${skin.tooltipValue}`}>{payload[0].value}</span>
        <span className={`text-[10px] ${skin.tooltipMuted}`}>sensores activos</span>
      </div>
    </div>
  );
}

function AlertsTooltip({ active, label, payload, skin }: TooltipInjected & { skin: Skin }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => Number(p.value) > 0);
  const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  return (
    <div className={`min-w-37.5 rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-md ${skin.tooltip}`}>
      <p className={`text-[10px] font-medium ${skin.tooltipTitle}`}>{label}</p>
      <div className="mt-1 space-y-0.5">
        {rows.length === 0 ? (
          <p className={`text-[10px] ${skin.tooltipMuted}`}>Sin alertas</p>
        ) : rows.map(r => {
          const serie = ALERT_SERIES.find(s => s.key === r.dataKey || s.key === r.name);
          return (
            <div key={String(r.dataKey ?? r.name)} className="flex items-center gap-2 text-[11px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color ?? serie?.color }} />
              <span className={skin.tooltipMuted}>{serie?.label ?? r.name}</span>
              <span className={`ml-auto font-bold tabular-nums ${skin.tooltipValue}`}>{r.value}</span>
            </div>
          );
        })}
      </div>
      <div className={`mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5 ${skin.tooltipDivider}`}>
        <span className={`text-[9px] font-semibold uppercase tracking-wider ${skin.tooltipMuted}`}>Total</span>
        <span className={`text-[12px] font-bold tabular-nums ${skin.tooltipValue}`}>{total}</span>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <span className="flex items-baseline gap-1 rounded-md border border-border/40 bg-bg-300/30 px-1.5 py-0.5">
      <span className="text-[8px] font-medium uppercase tracking-wide text-text-300">{label}</span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color: color ?? "var(--text-100)" }}>{value}</span>
    </span>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  accent,
  stats,
  children,
}: {
  icon: typeof IconActivity;
  title: string;
  subtitle: string;
  accent: string;
  stats?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-bg-100 border border-border/30 shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/20 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
            <Icon size={13} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[10px] font-semibold uppercase tracking-wider text-text-200">{title}</h3>
            <p className="text-[9px] text-text-300">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{stats}</div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-text-300">
      <IconInbox size={18} stroke={1.5} />
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

export function ActiveSensorsChart({ data }: { data: ActiveSensorsPoint[] }) {
  const skin = useChartSkin();
  const stats = useMemo(() => {
    if (!data.length) return null;
    const values = data.map(d => d.activos);
    const total = values.reduce((a, b) => a + b, 0);
    return {
      last: values[values.length - 1],
      delta: values.length > 1 ? values[values.length - 1] - values[values.length - 2] : null,
      avg: Math.round((total / values.length) * 10) / 10,
      max: Math.max(...values),
    };
  }, [data]);
  // Etiquetas del eje X: ~8 visibles para que no se pisen
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <Card
      icon={IconActivity}
      title="Sensores activos por día"
      subtitle="Últimos 30 días"
      accent={SENSOR_COLOR}
      stats={stats && (
        <>
          <Chip label="último" value={stats.last} color={SENSOR_COLOR} />
          {stats.delta != null && stats.delta !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${stats.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {stats.delta > 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
              {Math.abs(stats.delta)}
            </span>
          )}
          <Chip label="prom" value={stats.avg} />
          <Chip label="máx" value={stats.max} />
        </>
      )}
    >
      <div className="min-h-0 flex-1 px-1 pb-1">
        {data.length === 0 ? (
          <EmptyState label="Sin datos de sensores" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 14, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="resumenSensores" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SENSOR_COLOR} stopOpacity={0.45} />
                  <stop offset="60%" stopColor={SENSOR_COLOR} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={SENSOR_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={skin.grid} vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: skin.axis }} tickLine={false} axisLine={false} interval={interval} tickMargin={6} />
              <YAxis
                tick={{ fontSize: 10, fill: skin.axis }}
                tickLine={false}
                axisLine={false}
                width={34}
                allowDecimals={false}
                domain={[0, "auto"]}
                tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : "")}
              />
              <Tooltip content={<SensorsTooltip skin={skin} />} cursor={{ stroke: skin.muted, strokeDasharray: "3 3" }} />
              {stats && <ReferenceLine y={stats.avg} stroke={skin.muted} strokeDasharray="4 4" />}
              <Area
                type="monotone"
                dataKey="activos"
                stroke={SENSOR_COLOR}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="url(#resumenSensores)"
                dot={false}
                activeDot={{ r: 4, fill: SENSOR_COLOR, stroke: skin.dark ? "#0d0f13" : "#ffffff", strokeWidth: 2 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

export function AlertsPerDayChart({ data }: { data: AlertsPerDayPoint[] }) {
  const skin = useChartSkin();
  const stats = useMemo(() => {
    if (!data.length) return null;
    const totales = data.map(d => ALERT_SERIES.reduce((sum, s) => sum + (Number(d[s.key]) || 0), 0));
    const total = totales.reduce((a, b) => a + b, 0);
    return {
      total,
      avg: Math.round((total / data.length) * 10) / 10,
      max: Math.max(...totales),
      bySerie: ALERT_SERIES.map(s => ({ ...s, value: data.reduce((sum, d) => sum + (Number(d[s.key]) || 0), 0) })),
    };
  }, [data]);
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <Card
      icon={IconAlertTriangle}
      title="Alertas por día"
      subtitle="Últimos 30 días · por tipo"
      accent="#f59e0b"
      stats={stats && (
        <>
          <Chip label="total" value={stats.total} color="#f59e0b" />
          <Chip label="prom/día" value={stats.avg} />
          <Chip label="día máx" value={stats.max} />
        </>
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 px-3 pt-1.5">
        {stats?.bySerie.map(s => (
          <span key={s.key} className="flex items-center gap-1 text-[9px] text-text-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            <span className="text-text-200">{s.label}</span>
            <span className="font-semibold tabular-nums" style={{ color: s.value ? s.color : undefined }}>{s.value}</span>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 px-1 pb-1">
        {data.length === 0 ? (
          <EmptyState label="Sin alertas en el período" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 14, bottom: 0, left: 0 }} barCategoryGap="18%">
              <defs>
                {ALERT_SERIES.map(s => (
                  <linearGradient key={s.key} id={`resumenAlerta-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.62} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={skin.grid} vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: skin.axis }} tickLine={false} axisLine={false} interval={interval} tickMargin={6} />
              <YAxis
                tick={{ fontSize: 10, fill: skin.axis }}
                tickLine={false}
                axisLine={false}
                width={34}
                allowDecimals={false}
                domain={[0, "auto"]}
                tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : "")}
              />
              <Tooltip content={<AlertsTooltip skin={skin} />} cursor={{ fill: skin.cursor }} />
              {stats && <ReferenceLine y={stats.avg} stroke={skin.muted} strokeDasharray="4 4" />}
              {ALERT_SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="alertas"
                  fill={`url(#resumenAlerta-${s.key})`}
                  radius={i === ALERT_SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={26}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
