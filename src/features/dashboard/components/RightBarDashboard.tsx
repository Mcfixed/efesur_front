import { useState } from "react";
import { IconX, IconCheck, IconRadar } from "@tabler/icons-react";
import { format } from "date-fns";
import RightBar from "@/components/bars/RightBar";
import { useResolveAlert } from "../hooks/useDashboard";

interface Props {
  timelineData: any[];
  timelineRange: string;
  setTimelineRange: (r: string) => void;
  isLoading: boolean;
  isMobile?: boolean;
  isOpen?: boolean;
  setOpen?: (v: boolean) => void;
}

const ranges = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "total", label: "Todo" },
];

export default function RightBarDashboard({ timelineData, timelineRange, setTimelineRange, isLoading, isMobile, isOpen, setOpen }: Props) {
  const resolveMutation = useResolveAlert();
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null);
  const [resolveReason, setResolveReason] = useState("");

  // Última alerta creada hace menos de 1 minuto
  const latest = timelineData.length ? timelineData.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b) : null;
  const newestAlertId = latest && Date.now() - new Date(latest.created_at).getTime() < 60000 ? latest.id : null;

  const handleOpenResolve = (id: number) => { setResolvingAlertId(id); setResolveReason(""); };
  const handleConfirmResolve = () => {
    if (resolvingAlertId === null || !resolveReason.trim()) return;
    resolveMutation.mutate({ id: resolvingAlertId, reason: resolveReason.trim() });
    setResolvingAlertId(null);
    setResolveReason("");
  };

  const criticalActive = timelineData.filter((a: any) => a.priority === 0);
  const atencionActive = timelineData.filter((a: any) => a.priority === 1);
  const history = timelineData.filter((a: any) => a.priority === 2);

  const content = (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="flex items-center gap-1 px-1 mb-2 shrink-0">
        {ranges.map(r => (
          <button key={r.key} onClick={() => setTimelineRange(r.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${timelineRange === r.key ? "bg-brand-100/15 text-brand-200" : "bg-bg-300/50 text-text-300 hover:text-text-200"}`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-[9px] text-text-300 ml-auto">{timelineData.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pb-4 scrollbar-thin">
        {isLoading ? (
          <p className="text-xs text-text-300 text-center py-4">Cargando...</p>
        ) : timelineData.length === 0 ? (
          <p className="text-xs text-text-300 text-center py-4">Sin alertas en este período</p>
        ) : (
          <>
            {criticalActive.map((alert: any) => (
              <div key={`c-${alert.id}`} className="group relative py-2 px-3 rounded-lg border border-red-500/20 bg-linear-to-br from-red-500/8 to-red-500/2 hover:from-red-500/12 hover:to-red-500/4 transition-all duration-200">
                {/* Barra lateral decorativa */}
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-linear-to-b from-red-500/80 to-red-500/20" />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 pl-2">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex w-1.5 h-1.5 shrink-0">
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                        <span className="relative w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
                      </span>
                      <span className="text-[11px] font-bold text-red-300 truncate tracking-wide">{alert.device_name}</span>
                      {alert.id === newestAlertId && <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand-200 bg-brand-100/20 px-1.5 py-0.5 rounded-full border border-brand-100/20 shrink-0">Nuevo</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-red-300/60">{format(new Date(alert.created_at), "dd MMM · HH:mm")}</span>
                      <span className="text-[7px] font-semibold uppercase tracking-wide text-red-400/50 bg-red-500/10 px-1.5 py-0.5 rounded-full">Crítica</span>
                    </div>
                    {alert.metadata?.reason && (
                      <p className="text-[9px] text-red-300/50 leading-tight truncate mt-0.5">{alert.metadata.reason}</p>
                    )}
                  </div>
                  <button onClick={() => handleOpenResolve(alert.id)} disabled={resolveMutation.isPending}
                    className="shrink-0 flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-[8px] font-semibold text-red-400 px-1.5 py-0.5 rounded-lg transition-all duration-200 opacity-70 group-hover:opacity-100"
                  >
                    <IconCheck size={9} /> Resolver
                  </button>
                </div>
              </div>
            ))}


            {criticalActive.length > 0 && (atencionActive.length > 0 || history.length > 0) && (
              <div className="h-px bg-linear-to-r from-red-500/30 via-red-500/10 to-transparent my-2" />
            )}

            {atencionActive.map((alert: any) => (
              <div key={`a-${alert.id}`} className="group relative py-1 px-3 rounded border border-yellow-500/5 bg-yellow-500/4 hover:bg-yellow-500/7 transition-all duration-200">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-yellow-300/90" />
                <div className="flex items-start gap-2 pl-2">
                  <span className="mt-0.5 w-4 h-4 rounded flex items-center justify-center bg-yellow-500/15 text-[8px] shrink-0">
                    <IconRadar size={10} className="text-yellow-300/90" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px]  text-yellow-300/90 truncate">{alert.device_name}</p>
                      {alert.id === newestAlertId && <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand-200 bg-brand-100/20 px-1.5 py-0.5 rounded-full border border-brand-100/20 shrink-0">Nuevo</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px]  text-yellow-200/45">{format(new Date(alert.created_at), "dd MMM · HH:mm")}</span>
                      <span className="text-[7px] font-semibold uppercase tracking-wide text-yellow-300/80 bg-yellow-500/8 px-1.5 py-0.5 rounded">Movimiento</span>
                    </div>
                    {alert.metadata?.reason && (
                      <p className="text-[9px] text-yellow-300/30 mt-0.5 truncate leading-tight">{alert.metadata.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(criticalActive.length > 0 || atencionActive.length > 0) && history.length > 0 && (
              <div className="h-px bg-linear-to-r from-yellow-500/30 via-yellow-500/10 to-transparent my-2" />
            )}

            {history.map((alert: any) => (
              <div key={`h-${alert.id}`} className="group relative p-3 rounded-xl border border-white/4 bg-linear-to-br from-white/3 to-white/1 hover:from-white/5 hover:to-white/2 transition-all duration-300">
                <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-linear-to-b from-white/12 to-white/3" />
                <div className="flex items-start gap-2 pl-2">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 border ${alert.type === 'critica' ? 'bg-red-500/20 border-red-500/20 text-red-400' : 'bg-yellow-500/20 border-yellow-500/20 text-yellow-400'}`}>
                    {alert.type === 'critica' ? '!' : '⚡'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-bold text-text-300/60 truncate tracking-wide line-through decoration-white/6">
                        {alert.device_name}
                      </p>
                      <span className="text-[7px] font-semibold uppercase tracking-[0.08em] text-text-400/40 bg-white/4 px-1.5 py-0.5 rounded-full border border-white/5">Resuelta</span>
                      {alert.id === newestAlertId && <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand-200 bg-brand-100/20 px-1.5 py-0.5 rounded-full border border-brand-100/20 shrink-0">Nuevo</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-text-400/50">{format(new Date(alert.created_at), "dd MMM yyyy · HH:mm")}</span>
                    </div>
                    {alert.user_reason && (
                      <div className="mt-1.5 flex items-start gap-1">
                        <span className="text-[9px] text-text-400/30 mt-0.5">└</span>
                        <p className="text-[10px] text-text-400/40 leading-tight line-clamp-2 italic">{alert.user_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  // Modal de resolución
  const resolveModal = resolvingAlertId !== null && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-100 border border-border/50 rounded-xl shadow-2xl p-5 w-95 max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-100">Resolver Alerta Crítica</h3>
          <button onClick={() => setResolvingAlertId(null)} className="text-text-300 hover:text-text-100 outline-none"><IconX size={18} /></button>
        </div>
        <p className="text-xs text-text-300 mb-3">Ingresa el motivo de resolución:</p>
        <textarea value={resolveReason} onChange={e => setResolveReason(e.target.value)}
          placeholder="Ej: Se realizó mantenimiento correctivo..."
          className="w-full bg-bg-200 border border-border/50 rounded-lg px-3 py-2 text-sm text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 resize-none"
          rows={3} autoFocus
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          <button onClick={() => setResolvingAlertId(null)} className="px-3 py-1.5 text-xs text-text-300 hover:text-text-100 bg-bg-200 hover:bg-bg-300 rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleConfirmResolve} disabled={!resolveReason.trim() || resolveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolveMutation.isPending ? "Resolviendo..." : "✓ Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile && isOpen) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-bg-100">
          <div className="flex items-center justify-between p-2 border-b border-border/30">
            <h2 className="text-sm font-bold text-text-100">Centro de Alertas</h2>
            <button onClick={() => setOpen?.(false)} className="text-text-300 outline-none"><IconX size={20} /></button>
          </div>
          <div className="h-[calc(100vh-48px)] overflow-hidden">{content}</div>
        </div>
        {resolveModal}
      </>
    );
  }

  if (isMobile && !isOpen) {
    return (
      <>
        <button className="absolute right-0 z-50 top-[50%] rounded-s-sm bg-brand-100 p-1" onClick={() => setOpen?.(true)}>
          <IconX size={24} stroke={1.5} className="text-white rotate-45" />
        </button>
        {resolveModal}
      </>
    );
  }

  return (
    <>
      <div className="relative col-span-2 z-50 h-full flex flex-col">
        <RightBar title="Centro de Alertas" subTitle="Monitoreo en tiempo real">
          {content}
        </RightBar>
      </div>
      {resolveModal}
    </>
  );
}
