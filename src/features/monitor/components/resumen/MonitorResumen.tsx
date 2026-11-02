import { useMemo, useState } from "react";
import { format } from "date-fns";
import { IconFileReport } from "@tabler/icons-react";
import {
  useMonitorSummary,
  useMonitorDevices,
  useMonitorActiveSensors,
  useMonitorAlertsByDate,
} from "../../hooks/useMonitor";
import { isFreshForDevice } from "../../utils/online";
import { formatBattery, formatStationBattery } from "../../utils/battery";
import type { MonitorDevice } from "../../types/monitor.types";
import MonitorReportModal from "../tecnico/MonitorReportModal";
import ResumenSystemCards, { type ResumenTipo } from "./ResumenSystemCards";
import ResumenGatewayUptime from "./ResumenGatewayUptime";
import ResumenSensorActivity, { type EstadoSensor, type SensorActividad } from "./ResumenSensorActivity";

const VACIO: ResumenTipo = { total: 0, activos: 0, conAlertas: 0 };

/** ¿El equipo está reportando? Mismo criterio que usa el panel técnico. */
function estaReportando(d: MonitorDevice): boolean {
  return d.is_active && !!d.last_seen && isFreshForDevice(new Date(d.last_seen).getTime(), d.type_device);
}

function hace(ts: number): string {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Último dato del equipo: fecha + hace cuánto, o "nunca reportó" */
function ultimoDato(d: MonitorDevice): string {
  if (!d.last_seen) return "nunca reportó";
  const ts = new Date(d.last_seen).getTime();
  if (!Number.isFinite(ts)) return "nunca reportó";
  return `${format(new Date(ts), "dd/MM HH:mm")} · ${hace(ts)}`;
}

/** Lectura principal del último dato: banco 12 V (lectores/gateways) o batería del sensor (mV) */
function lecturaPrincipal(d: MonitorDevice): string | null {
  if (d.battery_v != null) {
    const bv = Number(d.battery_v);
    if (Number.isFinite(bv)) return formatStationBattery(bv);
  }
  const raw = d.last_value != null && `${d.last_value}` !== "" ? Number(d.last_value) : null;
  if (raw != null && Number.isFinite(raw) && raw > 1000) return formatBattery(raw);
  return null;
}

/** "V1PK6/11-13" → vía 1 · PK 6 · poste 11 (para ordenar el mapa por punto kilométrico) */
function parsePk(name: string): { via: number | null; pk: number | null; poste: number | null } {
  const m = /^\s*V\s*(\d+)\s*PK\s*(\d+)\s*\/\s*(\d+)?/i.exec(name);
  if (!m) return { via: null, pk: null, poste: null };
  return {
    via: Number(m[1]),
    pk: Number(m[2]),
    poste: m[3] != null ? Number(m[3]) : null,
  };
}

export default function MonitorResumen() {
  const hoy = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const { data: summary, isLoading } = useMonitorSummary();
  const { data: devices } = useMonitorDevices();
  const { data: alertsHoy } = useMonitorAlertsByDate(hoy);
  const { data: activeSensors } = useMonitorActiveSensors();
  const [reportOpen, setReportOpen] = useState(false);

  // Totales y equipos reportando por tipo (Gateway / Gps / Lector)
  const porTipo = useMemo(() => {
    const acc: Record<string, { total: number; activos: number }> = {
      Gateway: { total: 0, activos: 0 },
      Gps: { total: 0, activos: 0 },
      Lector: { total: 0, activos: 0 },
    };
    for (const d of devices ?? []) {
      const e = (acc[d.type_device] ??= { total: 0, activos: 0 });
      e.total += 1;
      if (estaReportando(d)) e.activos += 1;
    }
    return acc;
  }, [devices]);

  // Cantidad de equipos distintos con alertas hoy, por tipo
  const conAlertasPorTipo = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    for (const a of alertsHoy ?? []) {
      const key = a.device_id != null ? `id:${a.device_id}` : `name:${a.device_name}`;
      (acc[a.type_device] ??= new Set()).add(key);
    }
    return {
      Gateway: acc.Gateway?.size ?? 0,
      Gps: acc.Gps?.size ?? 0,
      Lector: acc.Lector?.size ?? 0,
    };
  }, [alertsHoy]);

  const cards = {
    gateways: { ...(porTipo.Gateway ?? VACIO), conAlertas: conAlertasPorTipo.Gateway },
    gps: { ...(porTipo.Gps ?? VACIO), conAlertas: conAlertasPorTipo.Gps },
    lectores: { ...(porTipo.Lector ?? VACIO), conAlertas: conAlertasPorTipo.Lector },
  };

  // Mapa de actividad: SOLO sensores GPS, con estado de reporte (activo / sin reporte)
  const sensores = useMemo<SensorActividad[]>(() => {
    return (devices ?? [])
      .filter(d => d.type_device === "Gps")
      .map(d => {
        const estado: EstadoSensor = estaReportando(d) ? "activo" : "inactivo";
        return {
          id: d.id,
          name: d.name,
          devEui: d.dev_eui,
          tipo: d.type_device,
          estado,
          ...parsePk(d.name),
          ultimo: ultimoDato(d),
          bateria: lecturaPrincipal(d),
        };
      });
  }, [devices]);

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[13px] text-brand-200 animate-pulse">Cargando resumen...</span>
      </div>
    );
  }

  return (
    <div className="p-2 h-full flex flex-col gap-1.5 overflow-hidden resumen-canvas">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-text-100">Panel de Monitoreo</h1>
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full transition-colors shadow-sm shadow-emerald-600/25 shrink-0"
        >
          <IconFileReport size={14} /> Reporte
        </button>
      </div>

      {reportOpen && <MonitorReportModal onClose={() => setReportOpen(false)} />}

      <ResumenSystemCards
        gateways={cards.gateways}
        gps={cards.gps}
        lectores={cards.lectores}
        criticas={summary?.criticas ?? 0}
        atencion={summary?.atencion ?? 0}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-1.5">
        <div className="min-h-0 xl:col-span-5 flex flex-col">
          <ResumenGatewayUptime />
        </div>

        <div className="min-h-0 xl:col-span-7 flex flex-col gap-1.5">
          <div className="flex-1 min-h-0 flex flex-col">
            <ResumenSensorActivity sensores={sensores} activosPorDia={activeSensors ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
