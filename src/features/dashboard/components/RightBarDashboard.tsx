import { useState } from "react";
import { IconX, IconCheck } from "@tabler/icons-react";
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
              <div key={`c-${alert.id}`} className="p-2 rounded-lg border bg-red-500/10 border-red-500/20">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span className="text-[11px] font-semibold text-red-400 truncate">{alert.device_name}</span>
                    </div>
                    <p className="text-[9px] text-text-300 mt-0.5">{format(new Date(alert.created_at), "yyyy/MM/dd HH:mm")}</p>
                    {alert.metadata?.reason && <p className="text-[9px] text-text-300/70 mt-0.5 truncate">{alert.metadata.reason}</p>}
                  </div>
                  <button onClick={() => handleOpenResolve(alert.id)} disabled={resolveMutation.isPending}
                    className="shrink-0 flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-[9px] text-red-400 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <IconCheck size={10} /> Resolver
                  </button>
                </div>
              </div>
            ))}

            {criticalActive.length > 0 && (atencionActive.length > 0 || history.length > 0) && (
              <div className="h-px bg-linear-to-r from-red-500/30 via-red-500/10 to-transparent my-2" />
            )}

            {atencionActive.map((alert: any) => (
              <div key={`a-${alert.id}`} className="p-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5">
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px] shrink-0">🟡</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-yellow-400/90 truncate">{alert.device_name}</p>
                    <p className="text-[9px] text-text-300 mt-0.5">{format(new Date(alert.created_at), "yyyy/MM/dd HH:mm")}</p>
                    {alert.metadata?.reason && <p className="text-[9px] text-text-300/70 mt-0.5 truncate">{alert.metadata.reason}</p>}
                  </div>
                </div>
              </div>
            ))}

            {(criticalActive.length > 0 || atencionActive.length > 0) && history.length > 0 && (
              <div className="h-px bg-linear-to-r from-yellow-500/30 via-yellow-500/10 to-transparent my-2" />
            )}

            {history.map((alert: any) => (
              <div key={`h-${alert.id}`} className="p-2 rounded-lg border border-border/20 bg-bg-300/30">
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px] shrink-0">{alert.type === 'critica' ? '🔴' : '🟡'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-text-300/70 truncate">
                      {alert.device_name}
                      <span className="text-[9px] text-text-300/50 ml-1">(resuelta)</span>
                    </p>
                    <p className="text-[9px] text-text-300 mt-0.5">{format(new Date(alert.created_at), "yyyy/MM/dd HH:mm")}</p>
                    {alert.user_reason && <p className="text-[9px] text-text-300/50 mt-0.5 truncate italic">{alert.user_reason}</p>}
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
