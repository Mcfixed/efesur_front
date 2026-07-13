import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AreaChartProps } from "../types";

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
];

/** Tooltip personalizado con fondo oscuro */
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d23]/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-2xl text-[11px]">
      <p className="text-white/60 text-[10px] mb-1.5 border-b border-white/5 pb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-[11px] leading-5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white font-bold">{p.value}</span>
          <span className="text-white/40">sensores</span>
        </p>
      ))}
    </div>
  );
}

export function AreaChartWrapper({
  data,
  dataKey,
  xAxisKey,
  height = 300,
  width = "100%",
  className,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  stacked = false,
  gradient = true,
}: AreaChartProps) {
  const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey];

  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          {gradient && (
            <defs>
              {dataKeys.map((key, index) => (
                <linearGradient
                  key={`gradient-${key}`}
                  id={`color-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={colors[index % colors.length]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={colors[index % colors.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
          )}
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />}
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={28} />
          {showTooltip && <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />}
          {showLegend && <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} iconType="circle" />}
          {dataKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={gradient ? `url(#color-${key})` : colors[index % colors.length]}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
