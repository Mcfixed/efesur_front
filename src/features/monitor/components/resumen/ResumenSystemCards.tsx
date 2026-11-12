import { IconAlertTriangle, IconAntenna, IconBook, IconDeviceSdCard } from "@tabler/icons-react";

export interface ResumenTipo {
  total: number;
  activos: number;
  conAlertas: number;
}

interface Props {
  gateways: ResumenTipo;
  gps: ResumenTipo;
  lectores: ResumenTipo;
  criticas: number;
  atencion: number;
}

function Chip({ valor, etiqueta, tone }: { valor: number; etiqueta: string; tone: "ok" | "bad" | "warn" }) {
  return (
    <span className={`resumen-chip resumen-chip-${tone}`}>
      <span className="tabular-nums">{valor}</span>
      <span className="font-medium opacity-80">{etiqueta}</span>
    </span>
  );
}

function CardEquipo({ label, icon: Icon, data }: { label: string; icon: typeof IconAntenna; data: ResumenTipo }) {
  return (
    <div className="rounded-lg resumen-card p-3.5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">{label}</p>
        <span className="resumen-icon shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-bg-300 border border-border/70">
          <Icon size={15} stroke={1.7} />
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums text-text-100">{data.total}</span>
        <span className="text-[11px] font-medium text-text-300 mb-0.5">total</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip valor={data.activos} etiqueta="activos" tone="ok" />
        <Chip valor={data.conAlertas} etiqueta="alertas" tone="bad" />
      </div>
    </div>
  );
}

export default function ResumenSystemCards({ gateways, gps, lectores, criticas, atencion }: Props) {
  const hayCriticas = criticas > 0;
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 shrink-0">
      <CardEquipo label="Gateways" icon={IconAntenna} data={gateways} />
      <CardEquipo label="Dispositivos GPS" icon={IconDeviceSdCard} data={gps} />
      <CardEquipo label="Lectores" icon={IconBook} data={lectores} />

      <div className={`rounded-lg resumen-card p-3.5 flex flex-col gap-2 min-w-0 ${hayCriticas ? "ring-1 ring-rose-500/35" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-200 truncate">Alertas críticas hoy</p>
          <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-lg border ${hayCriticas ? "bg-rose-500/15 border-rose-500/40 text-rose-500" : "bg-bg-300 border-border/70 text-text-300"}`}>
            <IconAlertTriangle size={15} stroke={1.7} />
          </span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className={`text-[30px] font-semibold leading-none tracking-tight tabular-nums ${hayCriticas ? "text-rose-500" : "text-emerald-600"}`}>{criticas}</span>
          <span className="text-[11px] font-medium text-text-300 mb-0.5">críticas</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip valor={atencion} etiqueta="atención" tone="warn" />
        </div>
      </div>
    </div>
  );
}
