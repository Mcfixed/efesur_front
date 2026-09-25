import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMonitorSummary, useMonitorActiveSensors, useMonitorAlertsPerDay } from "../../hooks/useMonitor";
import { ActiveSensorsChart, AlertsPerDayChart } from "./ResumenCharts";
import { IconDeviceSdCard, IconSignal5g, IconAlertTriangle, IconAlertCircle, IconDoor, IconUser, IconMoodSearch, IconWifiOff, IconFileReport } from "@tabler/icons-react";
import MonitorReportModal from "../tecnico/MonitorReportModal";

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
  const [reportOpen, setReportOpen] = useState(false);

  const sensorChart = useMemo(() => {
    if (!sensors?.length) return [];
    return sensors.map(s => ({ dia: format(new Date(s.dia), "dd/MM"), activos: Number(s.activos) || 0 }));
  }, [sensors]);

  const alertChart = useMemo(() => {
    if (!alertsPerDay?.length) return [];
    return alertsPerDay.map(a => ({
      dia: format(new Date(a.dia), "dd/MM"),
      criticas: Number(a.criticas) || 0,
      atencion: Number(a.atencion) || 0,
      apertura: Number(a.apertura) || 0,
      presencia: Number(a.presencia) || 0,
      movimientos: Number(a.movimientos) || 0,
      desconexion: Number(a.desconexion) || 0,
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
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-text-100 tracking-tight">Monitor</h1>
          <p className="text-[10px] text-text-300">Resumen general del sistema</p>
        </div>
        <button onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm">
          <IconFileReport size={14} /> Reporte
        </button>
      </div>

      {reportOpen && <MonitorReportModal onClose={() => setReportOpen(false)} />}

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
        <ActiveSensorsChart data={sensorChart} />
        <AlertsPerDayChart data={alertChart} />
      </div>
    </div>
  );
}
