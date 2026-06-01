import { useState, useMemo } from "react";
import { AreaChartWrapper } from "@/libs/recharts";
import { IconChevronDown, IconChevronUp, IconAlertOctagon, IconAlertCircle, IconClock } from "@tabler/icons-react";
import { format } from "date-fns";

interface Props {
  historyData?: { alerts?: any[] };
  isLoading: boolean;
}

export default function AlertsChart({ historyData, isLoading }: Props) {
  const [chartExpanded, setChartExpanded] = useState(true);
  const [chartAlertType, setChartAlertType] = useState<"critica" | "atencion">("critica");
  const [chartTimeRange, setChartTimeRange] = useState<"1h" | "24h" | "7d" | "30d" | "total">("24h");

  const chartData = useMemo(() => {
    if (!historyData?.alerts?.length) return [];
    const grouped: Record<string, number> = {};
    historyData.alerts.forEach((a: any) => {
      const date = new Date(a.created_at);
      const key = chartTimeRange === "1h" || chartTimeRange === "24h" ? format(date, "HH:mm") : format(date, "MM/dd");
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return Object.entries(grouped).map(([time, alertas]) => ({ time, alertas })).sort((a, b) => a.time.localeCompare(b.time));
  }, [historyData, chartTimeRange]);

  const chartColor = chartAlertType === "critica" ? "#ef4444" : "#eab308";
  const chartLabel = chartAlertType === "critica" ? "Críticas" : "Atención";

  return (
    <div className="w-full shrink-0 border-t border-border/30 bg-bg-200/80 backdrop-blur-sm">
      <button
        onClick={() => setChartExpanded(!chartExpanded)}
        className="w-full flex items-center justify-between px-3 py-1 text-[10px] text-text-300 hover:text-text-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider">Alertas {chartLabel}</span>
          <span className="text-text-300/60">•</span>
          <span className="text-text-300/60">{chartData.length} registros</span>
        </div>
        {chartExpanded ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
      </button>

      {chartExpanded && (
        <div className="px-2 pb-2 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => setChartAlertType("critica")} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${chartAlertType === "critica" ? "bg-red-500/15 text-red-400" : "bg-bg-300/50 text-text-300 hover:text-text-200"}`}>
                <IconAlertOctagon size={10} /> Críticas
              </button>
              <button onClick={() => setChartAlertType("atencion")} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${chartAlertType === "atencion" ? "bg-yellow-500/15 text-yellow-400" : "bg-bg-300/50 text-text-300 hover:text-text-200"}`}>
                <IconAlertCircle size={10} /> Atención
              </button>
            </div>
            <div className="h-3 w-px bg-border/30" />
            <div className="flex items-center gap-1">
              <IconClock size={10} className="text-text-300" />
              {(["1h", "24h", "7d", "30d", "total"] as const).map(r => (
                <button key={r} onClick={() => setChartTimeRange(r)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${chartTimeRange === r ? "bg-brand-100/15 text-brand-200" : "bg-bg-300/50 text-text-300 hover:text-text-200"}`}>
                  {r === "1h" ? "1H" : r === "24h" ? "24H" : r === "7d" ? "7D" : r === "30d" ? "30D" : "Todo"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-300/30 rounded-lg p-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-20"><p className="text-xs text-text-300">Cargando...</p></div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-20"><p className="text-xs text-text-300">Sin datos en este período</p></div>
            ) : (
              <AreaChartWrapper
                data={chartData} dataKey="alertas" xAxisKey="time"
                height={100} colors={[chartColor]}
                showGrid={true} showLegend={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
