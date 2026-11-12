import { useMemo } from "react";
import { format } from "date-fns";
import { IconPlugConnected, IconSolarPanel } from "@tabler/icons-react";
import { useMonitorGatewaysUptime, useMonitorDevices, useMonitorLatestTelemetry } from "../../hooks/useMonitor";
import { isFreshForDevice } from "../../utils/online";
import { buildUptimePorGateway, MonitorUptimeStrip, type UptimeGateway } from "../shared/MonitorUptimeStrip";

interface Fila {
  id: number;
  name: string;
  is_active: boolean;
  last_seen: string | null;
  /** Reportando ahora mismo (mismo criterio que el panel técnico: 5 min para gateways) */
  online: boolean;
  up?: UptimeGateway;
}

/** Punto de estado: ping animado cuando el gateway está reportando ahora. */
function PingEstado({ online, titulo }: { online: boolean; titulo: string }) {
  return (
    <span className="relative flex w-1.5 h-1.5 shrink-0" title={titulo}>
      {online && (
        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
      )}
      <span className={`relative w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-rose-500"}`} />
    </span>
  );
}

/**
 * Fuente de energía del gabinete: enchufe cuando el lector reporta red 220 V,
 * panel solar cuando no hay red (el equipo va a batería).
 */
function IconoEnergia({ conRed }: { conRed: boolean }) {
  const titulo = conRed ? "Conectado a la red (220 V)" : "Alimentado por panel solar";
  return (
    <span className="inline-flex h-3 items-center" title={titulo} aria-label={titulo}>
      {conRed
        ? <IconPlugConnected size={13} stroke={2} className="text-emerald-400" />
        : <IconSolarPanel size={13} stroke={2} className="text-amber-400" />}
    </span>
  );
}

/**
 * Estado de gateways (uptime de 7 días). Usa exactamente el mismo componente y cálculo que la
 * tabla del panel técnico, para que ambas vistas coincidan número a número.
 */
export default function ResumenGatewayUptime({ onOpenDevice }: { onOpenDevice?: (id: number) => void }) {
  const { data, isLoading } = useMonitorGatewaysUptime(7);
  const { data: devices } = useMonitorDevices();
  const { data: latest } = useMonitorLatestTelemetry(500);

  // ¿El gabinete tiene CA 220? Se lee del lector asignado al gateway (BlueSmartIP67.voltaje_V > 0)
  const conElectricidad = useMemo(() => {
    const out = new Map<number, boolean>();
    const lista: any[] = Array.isArray(latest) ? latest : ((latest as any)?.telemetry ?? []);
    const porId = new Map<number, any>((devices ?? []).map((d: any) => [d.id, d]));
    for (const g of data?.gateways ?? []) {
      const gw = porId.get(g.id);
      const lector = gw?.id_device_father ? porId.get(gw.id_device_father) : null;
      if (!lector) { out.set(g.id, false); continue; }
      const eui = String(lector.dev_eui || "").toLowerCase();
      const t = lista.find((x: any) => String(x.dev_eui || "").toLowerCase() === eui || x.device_id === lector.id);
      const v = t?.object?.BlueSmartIP67?.voltaje_V;
      out.set(g.id, typeof v === "number" && v > 0);
    }
    return out;
  }, [data, devices, latest]);

  const filas = useMemo<Fila[]>(() => {
    const map = buildUptimePorGateway(data);
    return (data?.gateways ?? [])
      .map(g => {
        const ts = g.last_seen ? new Date(g.last_seen).getTime() : NaN;
        return {
          id: g.id,
          name: g.name,
          is_active: g.is_active,
          last_seen: g.last_seen,
          online: g.is_active && isFreshForDevice(ts, "Gateway"),
          up: map.get(g.id),
        };
      })
      // Peores primero: es lo que hay que ir a mirar
      .sort((a, b) => (a.up?.uptime ?? 101) - (b.up?.uptime ?? 101));
  }, [data]);

  return (
    <div className="rounded-lg resumen-card flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 resumen-card-head">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">
          Estado de gateways (uptime)
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-200">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            En línea
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Offline
          </span>
          <span className="text-[10px] font-semibold text-text-200 bg-bg-300 px-1.5 py-0.5 rounded-full border border-border">
            {data?.dias ?? 7}D
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto resumen-scroll">
        {isLoading ? (
          <p className="text-[11px] text-text-100 text-center py-6 animate-pulse">Cargando uptime...</p>
        ) : filas.length === 0 ? (
          <p className="text-[11px] text-text-100 text-center py-6">Sin gateways</p>
        ) : (
          <table className="w-full text-[11px]">            <thead className="sticky top-0 z-10">
              <tr className="resumen-thead text-text-200 uppercase tracking-[0.08em] text-[10px] font-semibold">
                <th className="text-left py-1.5 px-3 font-semibold">Nombre</th>
                <th
                  className="text-left py-1.5 px-2 font-semibold w-full cursor-help"
                  title="Uptime de los últimos 7 días: cada grupo de bloques es un día y cada bloque 2 horas"
                >
                  Uptime gateway
                </th>
                <th className="text-center py-1.5 px-2 font-semibold">Energía</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr
                  key={f.id}
                  className={`resumen-row ${onOpenDevice ? "cursor-pointer" : ""}`}
                  onClick={onOpenDevice ? () => onOpenDevice(f.id) : undefined}
                  title={onOpenDevice ? `Abrir el panel de ${f.name}` : undefined}
                >
                  <td className="h-10 py-2 px-3 max-w-44" title={f.name}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PingEstado
                        online={f.online}
                        titulo={`${f.online ? "En línea" : "Sin reporte"}${f.last_seen ? ` · últ. ${format(new Date(f.last_seen), "dd/MM HH:mm")}` : " · nunca reportó"}`}
                      />
                      <span className="text-[12.5px] font-semibold text-text-100 truncate">{f.name.replace(/^Gateway\s/, "")}</span>
                    </div>
                  </td>
                  <td className="h-10 py-2 px-2">
                    {f.up ? <MonitorUptimeStrip s={f.up} /> : <span className="text-[11px] text-text-300">—</span>}
                  </td>
                  <td className="h-10 py-2 px-2 text-center">
                    <IconoEnergia conRed={conElectricidad.get(f.id) === true} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
