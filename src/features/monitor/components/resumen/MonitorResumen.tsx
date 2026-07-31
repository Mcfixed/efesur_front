import { useMemo } from "react";
import { format } from "date-fns";
import { useMonitorSummary, useMonitorActiveSensors, useMonitorAlertsPerDay } from "../../hooks/useMonitor";
import { BarChartWrapper, AreaChartWrapper } from "@/libs/recharts";
import { IconDeviceSdCard, IconSignal5g, IconAlertTriangle, IconAlertCircle, IconDoor, IconUser, IconMoodSearch, IconWifiOff } from "@tabler/icons-react";

const cards = [
  { key: "totalSensores", label: "Total Sensores", icon: IconDeviceSdCard },
  { key: "cobertura", label: "Cobertura", icon: IconSignal5g },
  { key: "criticas", label: "Críticas", icon: IconAlertTriangle },
  { key: "atencion", label: "Atención", icon: IconAlertCircle },
  { key: "apertura", label: "Apertura", icon: IconDoor },
  { key: "presencia", label: "Presencia", icon: IconUser },
  { key: "movimientos", label: "Movimientos", icon: IconMoodSearch },
  { key: "desconexion", label: "Desconexión", icon: IconWifiOff },
];

function border(key: string, v: number | undefined): string {
  if (v == null) return "border-border/30";
  switch (key) {
    case "cobertura": return v >= 100 ? "border-green-500/40" : "border-red-500/40";
    case "criticas": return v > 0 ? "border-red-500/40" : "border-green-500/40";
    case "atencion": return v > 0 ? "border-yellow-500/40" : "border-green-500/40";
    case "apertura": return v > 0 ? "border-red-500/40" : "border-green-500/40";
    case "presencia": return v > 0 ? "border-yellow-500/40" : "border-green-500/40";
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
      apertura: a.apertura,
      presencia: a.presencia,
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
    <div className="p-2 h-full flex flex-col gap-2 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-base font-bold text-text-100 tracking-tight">Monitor</h1>
        <p className="text-[10px] text-text-300">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-8 gap-1.5 shrink-0">
        {cards.map(({ key, label, icon: Icon }) => {
          const val = (summary as any)?.[key];
          const isPct = key === "cobertura";
          const borderColor = border(key, val);
          const hasIssue = key !== "totalSensores" && key !== "cobertura" && (val as number) > 0;
          const isLowCoverage = key === "cobertura" && (val as number) < 100;
          return (
            <div key={key} className={`relative flex items-start justify-between gap-3 border border-border-200/40 p-3 rounded-lg bg-bg-100 transition-colors ${borderColor}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-200 uppercase tracking-wide truncate flex items-center gap-1">
                  {label}
                  <span className="text-[9px] font-semibold text-text-200 bg-bg-300/60 px-1 py-0.5 rounded shrink-0">HOY</span>
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-bold leading-none tracking-tight text-text-100">
                    {isLoading
                      ? <span className="animate-pulse text-text-300">--</span>
                      : isPct
                        ? <>{typeof val === "number" ? (
                          <span className="inline-flex items-baseline gap-0.5">
                            {Math.round(val)}<span className="text-sm font-normal text-text-300">%</span>
                          </span>
                        ) : "—"}</>
                        : val ?? "—"}
                  </span>
                </div>
                {!isLoading && (hasIssue || isLowCoverage) && (
                  <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 mt-1 ${key === "atencion" || key === "presencia" ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ boxShadow: `0 0 4px ${key === "atencion" || key === "presencia" ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.5)"}` }} />
                )}
              </div>
              <div className="shrink-0 p-2.5 rounded-lg bg-bg-300" style={{ color: "#8ecae0" }}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 grid grid-rows-2 gap-1.5 min-h-0">
        <div className="rounded-lg bg-bg-100 border border-border/30 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <h3 className="text-[10px] font-semibold text-text-200 uppercase tracking-wider">Sensores activos por día</h3>
          </div>
          <div className="flex-1 min-h-0 p-1">
            {sensorChart.length > 0 ? (
              <AreaChartWrapper data={sensorChart} dataKey="activos" xAxisKey="dia" colors={["#14b8a6"]} showLegend={false} showGrid={true} gradient={true} />
            ) : (
              <div className="flex items-center justify-center h-full text-[12px] text-text-300">Sin datos</div>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-bg-100 border border-border/30 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <h3 className="text-[10px] font-semibold text-text-200 uppercase tracking-wider">Alertas por día</h3>
          </div>
          <div className="flex-1 min-h-0 p-1">
            {alertChart.length > 0 ? (
              <BarChartWrapper data={alertChart} dataKey={["criticas", "apertura", "presencia", "atencion", "movimientos"]} xAxisKey="dia" colors={["#ef4444", "#dc2626", "#ef4444", "#eab308", "#a855f7"]} stacked={true} showLegend={true} nameMap={{ criticas: 'Críticas', apertura: 'Apertura', presencia: 'Presencia', atencion: 'Atención', movimientos: 'Movimientos' }} />
            ) : (
              <div className="flex items-center justify-center h-full text-[12px] text-text-300">Sin datos</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
