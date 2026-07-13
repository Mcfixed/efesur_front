import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useStatusSummary, useActiveSensorsPerDay, useAlertsPerDay } from "../hooks/useStatus";
import { BarChartWrapper, AreaChartWrapper } from "@/libs/recharts";
import CalendarEventos from "./CalendarEventos";

import { IconDeviceSdCard, IconSignal5g, IconAlertTriangle, IconAlertCircle, IconMoodSearch, IconWifiOff, IconCalendarEvent } from "@tabler/icons-react";

const summaryCards = [
  { key: "totalSensores", label: "Total Sensores", icon: IconDeviceSdCard },
  { key: "cobertura", label: "Cobertura", icon: IconSignal5g },
  { key: "criticas", label: "Críticas", icon: IconAlertTriangle },
  { key: "atencion", label: "Atención", icon: IconAlertCircle },
  { key: "movimientos", label: "Movimientos", icon: IconMoodSearch },
  { key: "desconexion", label: "Desconexión", icon: IconWifiOff },
];

/** Determina el color del borde según la métrica */
function cardBorder(key: string, value: number | undefined): string {
  if (value == null) return "border-border/30";
  switch (key) {
    case "cobertura":
      return value >= 100 ? "border-green-500/40" : "border-red-500/40";
    case "criticas":
      return value > 0 ? "border-red-500/40" : "border-green-500/40";
    case "atencion":
      return value > 0 ? "border-yellow-500/40" : "border-green-500/40";
    case "movimientos":
      return value > 0 ? "border-orange-500/40" : "border-green-500/40";
    case "desconexion":
      return value > 0 ? "border-red-500/40" : "border-green-500/40";
    default:
      return "border-border/30";
  }
}

const TABS = [
  { key: "resumen", label: "Resumen", icon: IconDeviceSdCard },
  { key: "calendario", label: "Calendario de eventos", icon: IconCalendarEvent },
];

export default function Status() {
  const [activeTab, setActiveTab] = useState("resumen");
  const { data: summary, isLoading: summaryLoading } = useStatusSummary();
  const { data: activeSensors, isLoading: sensorsLoading } = useActiveSensorsPerDay();
  const { data: alertsPerDay, isLoading: alertsLoading } = useAlertsPerDay();

  // Fechas cortas: "2026-07-07" → "07/07"
  const sensorsChart = useMemo(() =>
    (activeSensors || []).filter(d => d.dia).map(d => ({ ...d, dia: format(new Date(d.dia), "dd/MM") })),
    [activeSensors]
  );

  const alertsChart = useMemo(() =>
    (alertsPerDay || []).filter(d => d.dia).map(d => ({ ...d, dia: format(new Date(d.dia), "dd/MM") })),
    [alertsPerDay]
  );

  return (
    <div className="p-3 h-[calc(100vh-40px)] flex flex-col gap-3 overflow-hidden">
      {/* ─── TABS ─── */}
      <div className="shrink-0 flex items-center gap-1 bg-bg-100 border border-border/30 rounded-xl p-1 shadow-sm">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                isActive
                  ? "bg-bg-200/80 text-text-100 shadow-sm"
                  : "text-text-300 hover:text-text-200"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "resumen" ? (
        <>
      {/* ─── TITLE ─── */}
      <div className="shrink-0">
        <h1 className="text-lg font-bold text-text-100 tracking-tight">Cobertura y operación diaria</h1>
        <p className="text-[11px] text-text-300 mt-0.5">Resumen general del estado de los sensores</p>
      </div>

      {/* ─── ROW 1: HORIZONTAL CARDS ─── */}
      <div className="grid grid-cols-6 gap-3 shrink-0">
        {summaryCards.map(({ key, label, icon: Icon }) => {
          const value = summary?.[key as keyof typeof summary];
          const isPct = key === "cobertura";
          const borderColor = cardBorder(key, value as number | undefined);
          const hasIssue = key !== "totalSensores" && key !== "cobertura" && (value as number) > 0;
          const isLowCoverage = key === "cobertura" && (value as number) < 100;
          return (
            <div
              key={key}
              className={`relative rounded-xl bg-bg-100 border shadow px-4 py-3.5 overflow-hidden transition-colors ${borderColor}`}
            >
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
                    {summaryLoading
                      ? <span className="animate-pulse text-text-300">--</span>
                      : isPct
                        ? <>{typeof value === "number" ? (
                          <span className="inline-flex items-baseline gap-0.5">
                            {Math.round(value)}<span className="text-xs font-normal text-text-300">%</span>
                          </span>
                        ) : "—"}</>
                        : value ?? "—"}
                    {!summaryLoading && (hasIssue || isLowCoverage) && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        key === "atencion" ? "bg-yellow-400" : "bg-red-400"
                      } shadow-[0_0_6px_${
                        key === "atencion" ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.5)"
                      }]`} />
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── ROW 2: CHARTS (50% height each) ─── */}
      <div className="flex-1 grid grid-rows-2 gap-3 min-h-0">
        {/* Active Sensors per Day */}
        <div className="rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2 border-b border-border/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
            <h3 className="text-[11px] font-semibold text-text-200 uppercase tracking-wider">Sensores activos por día</h3>
            {sensorsLoading && <span className="text-[10px] text-text-300 animate-pulse">cargando...</span>}
          </div>
          <div className="flex-1 min-h-0 p-2">
            <AreaChartWrapper
              data={sensorsChart}
              dataKey="activos"
              xAxisKey="dia"
              colors={["#14b8a6"]}
              showLegend={false}
              showGrid={true}
              gradient={true}
            />
          </div>
        </div>

        {/* Alerts per Day (stacked bar) */}
        <div className="rounded-xl bg-bg-100 border border-border/30 shadow overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2 border-b border-border/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
            <h3 className="text-[11px] font-semibold text-text-200 uppercase tracking-wider">Alertas por día</h3>
            {alertsLoading && <span className="text-[10px] text-text-300 animate-pulse">cargando...</span>}
          </div>
          <div className="flex-1 min-h-0 p-2">
            <BarChartWrapper
              data={alertsChart}
              dataKey={["criticas", "atencion", "movimientos"]}
              xAxisKey="dia"
              colors={["#ef4444", "#eab308", "#a855f7"]}
              stacked={true}
              showLegend={true}
            />
          </div>
        </div>
      </div>
        </>
      ) : (
        <CalendarEventos />
      )}
    </div>
  );
}
