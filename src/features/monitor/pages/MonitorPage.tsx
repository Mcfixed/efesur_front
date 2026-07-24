import { useState, useMemo } from "react";
import MonitorResumen from "../components/resumen/MonitorResumen";
import MonitorCalendario from "../components/calendario/MonitorCalendario";
import MonitorHeatMap from "../components/tecnico/MonitorHeatMap";
import MonitorTelemetryView from "../components/tecnico/MonitorTelemetryView";
import { useBetterSession } from "@/libs/better-auth";
import { IconChartBar, IconCalendarEvent, IconRadar, IconDeviceAnalytics } from "@tabler/icons-react";

const ALL_TABS = [
  { key: "resumen", label: "Resumen", icon: IconChartBar },
  { key: "calendario", label: "Calendario", icon: IconCalendarEvent },
  { key: "mapa", label: "Mapa de calor", icon: IconRadar },
  { key: "tecnico", label: "Panel técnico", icon: IconDeviceAnalytics },
];

export default function MonitorPage() {
  const { user } = useBetterSession();
  const role = user?.role || 'visualizador';
  const TABS = useMemo(() => {
    if (role === 'admin_efe') return ALL_TABS.filter(t => t.key !== 'tecnico');
    return ALL_TABS;
  }, [role]);
  const [tab, setTab] = useState("resumen");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-1 bg-bg-100/50 border-b border-border/20 px-5 py-0">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2.5 px-5 py-3 text-[14px] font-bold transition-all ${
                active
                  ? "text-brand-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-200 after:rounded-full"
                  : "text-text-300 hover:text-text-200"
              }`}
            ><Icon size={18} /> {t.label}</button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "resumen" && <MonitorResumen />}
        {tab === "calendario" && <MonitorCalendario />}
        {tab === "mapa" && <MonitorHeatMap />}
        {tab === "tecnico" && <MonitorTelemetryView />}
      </div>
    </div>
  );
}
