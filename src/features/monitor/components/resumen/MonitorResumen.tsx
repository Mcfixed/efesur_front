import { useMemo } from "react";
import { format } from "date-fns";
import { useMonitorSummary, useMonitorActiveSensors, useMonitorAlertsPerDay } from "../../hooks/useMonitor";
import { BarChartWrapper, AreaChartWrapper } from "@/libs/recharts";
import { IconDeviceSdCard, IconSignal5g, IconAlertTriangle, IconAlertCircle, IconMoodSearch, IconWifiOff } from "@tabler/icons-react";

const cards = [
  { key: "totalSensores", label: "Total Sensores", icon: IconDeviceSdCard },
  { key: "cobertura", label: "Cobertura", icon: IconSignal5g },
  { key: "criticas", label: "Críticas", icon: IconAlertTriangle },
  { key: "atencion", label: "Atención", icon: IconAlertCircle },
  { key: "movimientos", label: "Movimientos", icon: IconMoodSearch },
  { key: "desconexion", label: "Desconexión", icon: IconWifiOff },
];

function border(key: string, v: number | undefined): string {
  if (v == null) return "border-border/30";
  switch (key) {
    case "cobertura": return v >= 100 ? "border-green-500/40" : "border-red-500/40";
    case "criticas": return v > 0 ? "border-red-500/40" : "border-green-500/40";
    case "atencion": return v > 0 ? "border-yellow-500/40" : "border-green-500/40";
    case "movimientos": return v > 0 ? "border-orange-500/40" : "border-green-500/40";
    case "desconexion": return v > 0 ? "border-red-500/40" : "border-green-500/40";
    default: return "border-border/30";
  }
}

export default function MonitorResumen() {
  const { data: summary, isLoading } = useMonitorSummary();
  const { data: sensors } = useMonitorActiveSensors();
  const { data: alertsPerDay } = useMonitorAlertsPerDay();

  const sensorChart = useMemo(() => {
    if (!sensors?.length) return [];
    return sensors.map(s => ({ dia: format(new Date(s.dia), "dd/MM"), activos: s.activos }));
  }, [sensors]);

  const alertChart = useMemo(() => {
    if (!alertsPerDay?.length) return [];
    return alertsPerDay.map(a => ({
      dia: format(new Date(a.dia), "dd/MM"),
      criticas: a.criticas,
      atencion: a.atencion,
      movimientos: a.movimientos,
    }));
  }, [alertsPerDay]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[13px] text-brand-200 animate-pulse">Cargando resumen...</span>
      </div>
    );
  }

  return (
    <div className="p-3 h-full flex flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-lg font-bold text-text-100 tracking-tight">Monitor</h1>
        <p className="text-[11px] text-text-300 mt-0.5">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-6 gap-3 shrink-0">
        {cards.map(({ key, label, icon: Icon }) => {
          const val = (summary as any)?.[key];
          const isPct = key === "cobertura";
          const borderColor = border(key, val);
          const hasIssue = key !== "totalSensores" && key !== "cobertura" && (val as number) > 0;
          const isLowCoverage = key === "cobertura" && (val as number) < 100;
          return (
            <div key={key} className={`relative rounded-xl bg-bg-100 border shadow px-4 py-3.5 overflow-hidden transition-colors ${borderColor}`}>
              <div className="flex items-center gap-3 relative">
                <div className="w-9 h-9 rounded-lg bg-bg-200/80 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-text-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-300 mb-0.5 flex items-center gap-1.5">
                    {label}
                    <span className="text-[8px] font-semibold text-text-200 bg-bg-300/30 px-1 py-0.5 rounded">HOY</span>
                  </p>
                  <p className="text-[24px] font-bold leading-none tracking-tight text-text-100 flex items-center gap-2">
                    {isLoading
                      ? <span className="animate-pulse text-text-300">--</span>
                      : isPct
                        ? <>{typeof val === "number" ? (
                          <span className="inline-flex items-baseline gap-0.5">
                            {Math.round(val)}<span className="text-xs font-normal text-text-300">%</span>
                          </span>
                        ) : "—"}</>
                        : val ?? "—"}
                    {!isLoading && (hasIssue || isLowCoverage) && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${key === "atencion" ? "bg-yellow-400" : "bg-red-400"} shadow-[0_0_6px_${key === "atencion" ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.5)"}]`} />
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 grid grid-rows-2 gap-3 min-h-0">
        <div className="rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2 border-b border-border/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
            <h3 className="text-[11px] font-semibold text-text-200 uppercase tracking-wider">Sensores activos por día</h3>
          </div>
          <div className="flex-1 min-h-0 p-2">
            {sensorChart.length > 0 ? (
              <AreaChartWrapper data={sensorChart} dataKey="activos" xAxisKey="dia" colors={["#14b8a6"]} showLegend={false} showGrid={true} gradient={true} />
            ) : (
              <div className="flex items-center justify-center h-full text-[12px] text-text-300">Sin datos</div>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2 border-b border-border/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
            <h3 className="text-[11px] font-semibold text-text-200 uppercase tracking-wider">Alertas por día</h3>
          </div>
          <div className="flex-1 min-h-0 p-2">
            {alertChart.length > 0 ? (
              <BarChartWrapper data={alertChart} dataKey={["criticas", "atencion", "movimientos"]} xAxisKey="dia" colors={["#ef4444", "#eab308", "#a855f7"]} stacked={true} showLegend={true} />
            ) : (
              <div className="flex items-center justify-center h-full text-[12px] text-text-300">Sin datos</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
