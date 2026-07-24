import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { BarChartProps } from "../types";

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
];

/** Tooltip personalizado con fondo oscuro */
function DarkTooltip({ active, payload, label, nameMap }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d23]/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-2xl text-[11px]">
      <p className="text-white/60 text-[10px] mb-1.5 border-b border-white/5 pb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-[11px] leading-5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white font-bold">{p.value}</span>
          <span className="text-white/40">{nameMap?.[p.name] || p.name}</span>
        </p>
      ))}
    </div>
  );
}

export function BarChartWrapper({
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
  barSize,
  nameMap,
}: BarChartProps & { nameMap?: Record<string, string> }) {
  const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey];

  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />}
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval={0} angle={-20} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={28} />
          {showTooltip && <Tooltip content={<DarkTooltip nameMap={nameMap} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />}
          {showLegend && <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} iconType="circle" />}
          {dataKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[index % colors.length]}
              stackId={stacked ? "stack" : undefined}
              barSize={barSize}
              radius={[2, 2, 0, 0]}
              maxBarSize={24}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
