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
  // Dispositivo al que se quiere saltar desde el resumen (abre el panel técnico con él seleccionado)
  const [focusDeviceId, setFocusDeviceId] = useState<number | null>(null);
  // Pestaña desde la que se saltó (para que "Atrás" en el panel del equipo vuelva ahí)
  const [tabOrigen, setTabOrigen] = useState<string | null>(null);

  // El salto desde el resumen solo lo usan los administradores
  const puedeSaltar = role === 'admin_efe' || role === 'superadmin';
  const abrirDispositivo = (id: number) => {
    if (!puedeSaltar) return;
    setTabOrigen(tab);
    setFocusDeviceId(id);
    setTab('tecnico');
  };
  // "Atrás" en el panel del equipo: si se entró desde el resumen, vuelve al resumen
  const volverAlOrigen = () => {
    setFocusDeviceId(null);
    if (tabOrigen && tabOrigen !== 'tecnico') setTab(tabOrigen);
    setTabOrigen(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 bg-bg-100 border-b border-border px-5">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-brand-100 text-brand-100"
                    : "border-transparent text-text-200 hover:text-text-100"
                }`}
              ><Icon size={16} stroke={1.5} /> {t.label}</button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "resumen" && <MonitorResumen onOpenDevice={puedeSaltar ? abrirDispositivo : undefined} />}
        {tab === "calendario" && <MonitorCalendario />}
        {tab === "mapa" && <MonitorHeatMap />}
        {tab === "tecnico" && <MonitorTelemetryView focusDeviceId={focusDeviceId} onVolverAlOrigen={volverAlOrigen} />}
      </div>
    </div>
  );
}
