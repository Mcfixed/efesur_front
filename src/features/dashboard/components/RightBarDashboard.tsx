import { useMemo, useState } from "react";
import { IconX, IconCheck, IconRadar, IconAlertTriangle, IconAlertCircle, IconDoor, IconUser, IconWifiOff, IconBellOff, IconRun, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { format } from "date-fns";
import RightBar from "@/components/bars/RightBar";
import { useResolveAlert } from "../hooks/useDashboard";
import { useMonitorDevices } from "@/features/monitor/hooks/useMonitor";

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
  const { data: allDevices } = useMonitorDevices();

  // Mapa dev_eui -> nombre para resolver EUIs dentro del metadata
  const euiNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (allDevices || []).forEach((d: any) => {
      if (d.dev_eui) map.set(d.dev_eui.toLowerCase(), d.name);
    });
    return map;
  }, [allDevices]);

  const resolveEui = (value: string): string => {
    if (!value) return value;
    // Reemplazar cada dev_eui conocido que aparezca dentro del texto por su nombre
    let out = value;
    euiNameMap.forEach((name, eui) => {
      if (out.toLowerCase().includes(eui)) {
        out = out.replace(new RegExp(eui, 'gi'), name);
      }
    });
    return out;
  };

  const [expandedMetaAlertId, setExpandedMetaAlertId] = useState<number | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null);
  const [resolveReason, setResolveReason] = useState("");
  const [showConfirmResolver, setShowConfirmResolver] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [lastCommandMsg, setLastCommandMsg] = useState<string | null>(null);
  const [lastCommandAction, setLastCommandAction] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [commandsSent, setCommandsSent] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cs_cmd') || '[]')); } catch { return new Set(); }
  });

  // Última alerta creada hace menos de 1 minuto
  const latest = timelineData.length ? timelineData.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b) : null;
  const newestAlertId = latest && Date.now() - new Date(latest.created_at).getTime() < 60000 ? latest.id : null;

  const handleOpenResolve = (id: number) => {
    setResolvingAlertId(id);
    setResolveReason("");
    setShowConfirmResolver(false);
    setShowReasonInput(false);
    setLastCommandMsg(null);
    setLastCommandAction(null);
    setPendingCommand(null);
  };
  // Enviar solo comando (abortar/persecucion) SIN resolver la alerta
  const handleSendCommand = (action: string) => {
    if (resolvingAlertId === null) return;
    resolveMutation.mutate(
      { id: resolvingAlertId, reason: '', action },
      {
        onSuccess: () => {
          const labels: Record<string, string> = { abortar: 'Abortar emergencia enviado al sensor', persecucion: 'Modo persecución activado en el sensor' };
          setLastCommandMsg(labels[action] || `Comando ${action} enviado`);
          setLastCommandAction(action);
          setCommandsSent(prev => {
            const next = new Set(prev).add(resolvingAlertId!);
            localStorage.setItem('cs_cmd', JSON.stringify([...next]));
            return next;
          });
        },
      }
    );
  };
  // Abrir input de motivo para resolver visualmente
  const handleOpenResolverOnly = () => { setShowReasonInput(true); };
  // Confirmar envío de comando (persecución/abortar) — acción importante, pasa por confirmación
  const confirmSendCommand = () => {
    if (!pendingCommand) return;
    const action = pendingCommand;
    setPendingCommand(null);
    handleSendCommand(action);
  };
  // Confirmar resolución visual
  const handleConfirmResolverOnly = () => {
    if (resolvingAlertId === null || !resolveReason.trim()) return;
    resolveMutation.mutate({ id: resolvingAlertId, reason: resolveReason.trim(), action: 'resolver' });
    setResolvingAlertId(null);
    setResolveReason("");
    setShowConfirmResolver(false);
    setShowReasonInput(false);
    setLastCommandMsg(null);
    setLastCommandAction(null);
  };

  const criticalActive = timelineData.filter((a: any) => a.priority === 0);
  const allAlerts = timelineData;
  // Alerta que se está resolviendo y su estado de comando (desde metadata del backend)
  const resolvingAlert = resolvingAlertId !== null ? timelineData.find((a: any) => a.id === resolvingAlertId) : undefined;
  const cmd = resolvingAlert?.metadata?.command;

  const ALERT_CONFIG: Record<string, { border: string; bg: string; bar: string; textColor: string; label: string; Icon: any; iconColor: string }> = {
    critica:            { border: '1px solid rgba(239,68,68,1)', bg: 'linear-gradient(135deg, rgba(239,68,68,0.20), rgba(239,68,68,0.06))', bar: 'linear-gradient(180deg, rgba(239,68,68,0.90), rgba(239,68,68,0.30))', textColor: '#fca5a5', label: 'Crítica', Icon: IconAlertTriangle, iconColor: '#ef4444' },
    apertura:           { border: '1px solid rgba(239,68,68,0.15)', bg: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.01))', bar: 'linear-gradient(180deg, rgba(239,68,68,0.60), rgba(239,68,68,0.15))', textColor: '#fca5a5', label: 'Apertura', Icon: IconDoor, iconColor: '#ef4444' },
    presencia:          { border: '1px solid rgba(239,68,68,0.15)', bg: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.01))', bar: 'linear-gradient(180deg, rgba(239,68,68,0.60), rgba(239,68,68,0.15))', textColor: '#fca5a5', label: 'Presencia', Icon: IconUser, iconColor: '#ef4444' },
    atencion:           { border: '1px solid rgba(234,179,8,0.10)', bg: 'linear-gradient(135deg, rgba(234,179,8,0.05), rgba(234,179,8,0.01))', bar: 'linear-gradient(180deg, rgba(253,224,71,0.80), rgba(234,179,8,0.15))', textColor: '#fde047', label: 'Atención', Icon: IconAlertCircle, iconColor: '#eab308' },
    desconexionGW:      { border: '1px solid rgba(249,115,22,0.15)', bg: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(249,115,22,0.01))', bar: 'linear-gradient(180deg, rgba(249,115,22,0.60), rgba(249,115,22,0.15))', textColor: '#fdba74', label: 'GW Off', Icon: IconWifiOff, iconColor: '#f97316' },
    desconexionGPS:     { border: '1px solid rgba(249,115,22,0.15)', bg: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(249,115,22,0.01))', bar: 'linear-gradient(180deg, rgba(249,115,22,0.60), rgba(249,115,22,0.15))', textColor: '#fdba74', label: 'GPS Off', Icon: IconWifiOff, iconColor: '#f97316' },
    desconexion220:     { border: '1px solid rgba(249,115,22,0.15)', bg: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(249,115,22,0.01))', bar: 'linear-gradient(180deg, rgba(249,115,22,0.60), rgba(249,115,22,0.15))', textColor: '#fdba74', label: 'CA 220 Off', Icon: IconWifiOff, iconColor: '#f97316' },
    desconexionbatGW:   { border: '1px solid rgba(249,115,22,0.15)', bg: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(249,115,22,0.01))', bar: 'linear-gradient(180deg, rgba(249,115,22,0.60), rgba(249,115,22,0.15))', textColor: '#fdba74', label: 'Batería GW Off', Icon: IconWifiOff, iconColor: '#f97316' },
    movimientos_anomalos: { border: '1px solid rgba(168,85,247,0.12)', bg: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.01))', bar: 'linear-gradient(180deg, rgba(192,132,252,0.80), rgba(168,85,247,0.15))', textColor: '#d8b4fe', label: 'Mov. Anómalo', Icon: IconRadar, iconColor: '#a855f7' },
  };
  const getAlertCfg = (type: string) => ALERT_CONFIG[type] || { border: '1px solid rgba(255,255,255,0.08)', bg: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', bar: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))', textColor: '#9ca3af', label: type, Icon: IconAlertCircle, iconColor: '#6b7280' };

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

      <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pb-4 scrollbar-thin">
        {isLoading ? (
          <p className="text-xs text-text-300 text-center py-4">Cargando...</p>
        ) : timelineData.length === 0 ? (
          <p className="text-xs text-text-300 text-center py-4">Sin alertas en este período</p>
        ) : (
          <>
            {/* ── PINNED: Active critical alerts ── */}
            {criticalActive.length > 0 && (
              <div className="mb-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-red-400/70 px-1 mb-1.5 flex items-center gap-1">
                  <IconAlertTriangle size={10} />
                  Críticas activas
                </p>
                {criticalActive.map((alert: any) => {
                  const cfg = getAlertCfg(alert.type);
                  const Icon = cfg.Icon;
                  return (
                    <div key={`p-${alert.id}`} className="group relative py-2.5 px-3 rounded-lg transition-all duration-200 mb-1.5"
                      style={{ border: '1px solid rgba(239,68,68,0.30)', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))', boxShadow: '0 0 12px rgba(239,68,68,0.08)' }}>
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(239,68,68,0.90), rgba(239,68,68,0.30))' }} />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 pl-3">
                          <div className="flex items-center gap-2">
                            <span className="relative flex w-2 h-2 shrink-0">
                              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                              <span className="relative w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                            </span>
                            <span className="text-[13px] font-bold truncate tracking-wide" style={{ color: '#fca5a5' }}>{alert.device_name}</span>
                            {alert.id === newestAlertId && <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand-200 bg-brand-100/20 px-1.5 py-0.5 rounded-full border border-brand-100/20 shrink-0">Nuevo</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Icon size={12} color={cfg.iconColor} />
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(252,165,165,0.6)' }}>{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{cfg.label}</span>
                          </div>
                          {alert.metadata?.reason && <p className="text-[10px] leading-tight truncate mt-1" style={{ color: 'rgba(252,165,165,0.5)' }}>{alert.metadata.reason}</p>}
                        </div>
                        {alert.type === 'critica' && (
                          <button onClick={() => handleOpenResolve(alert.id)} disabled={resolveMutation.isPending}
                            className="shrink-0 flex items-center gap-1 bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/35 text-[8px] font-semibold text-red-400 px-1.5 py-0.5 rounded-lg transition-all duration-200 opacity-70 group-hover:opacity-100"
                          ><IconCheck size={9} /> Resolver</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="h-px bg-linear-to-r from-red-500/40 via-red-500/15 to-transparent my-2.5" />
              </div>
            )}

            {/* ── ALL alerts in chronological order ── */}
            {allAlerts.map((alert: any) => {
              const cfg = getAlertCfg(alert.type);
              const Icon = cfg.Icon;
              return (
                <div key={`a-${alert.id}`} className="group relative py-2 px-3 rounded transition-all duration-200"
                  style={{ border: cfg.border, background: cfg.bg }}>
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: cfg.bar }} />
                  <div className="flex items-center gap-2.5 pl-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${cfg.iconColor}18`, border: `1px solid ${cfg.iconColor}30` }}>
                      <Icon size={13} color={cfg.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-semibold truncate tracking-wide" style={{ color: cfg.textColor }}>
                          {alert.device_name}
                        </p>
                        {alert.id === newestAlertId && <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-brand-200 bg-brand-100/20 px-1.5 py-0.5 rounded-full border border-brand-100/20 shrink-0">Nuevo</span>}
                      </div>
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {format(new Date(alert.created_at), "dd/MM HH:mm")}
                        </span>
                        <span className="text-[8px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${cfg.iconColor}20`, color: cfg.textColor }}>
                          {cfg.label}
                        </span>
                      </div>
                      {alert.metadata?.reason && (
                        <p className="text-[9px] leading-tight truncate mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{alert.metadata.reason}</p>
                      )}
                      {alert.type === 'movimientos_anomalos' && alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedMetaAlertId(expandedMetaAlertId === alert.id ? null : alert.id); }}
                          className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors"
                          style={{ color: '#d8b4fe', backgroundColor: 'rgba(168,85,247,0.12)' }}
                        >
                          {expandedMetaAlertId === alert.id ? <IconChevronUp size={11} /> : <IconChevronDown size={11} />}
                          {expandedMetaAlertId === alert.id ? 'Ocultar detalle' : 'Ver detalle'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  // Modal principal: enviar comando o resolver
  const resolveModal = resolvingAlertId !== null && !showReasonInput && !showConfirmResolver && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-100 border border-border/50 rounded-xl shadow-2xl p-5 w-105 max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-100">Acción sobre alerta crítica</h3>
          <button onClick={() => setResolvingAlertId(null)} className="text-text-300 hover:text-text-100 outline-none"><IconX size={18} /></button>
        </div>

        {lastCommandMsg ? (
          <div className="text-center py-4">
            <p className="text-[14px] font-semibold text-green-400 mb-2 flex items-center justify-center gap-2">
              {lastCommandAction === 'persecucion' ? <IconRun size={16} /> : <IconBellOff size={16} />}
              <span>{lastCommandMsg}</span>
            </p>
            <p className="text-[12px] font-medium text-text-200 mb-4">La alerta crítica continúa activa en el panel</p>
            <button onClick={() => { setResolvingAlertId(null); setLastCommandMsg(null); setLastCommandAction(null); }}
              className="px-4 py-2 text-xs text-text-300 bg-bg-200 hover:bg-bg-300 rounded-lg transition-colors">Cerrar</button>
          </div>
        ) : cmd === 'abortar' ? (
          <>
            <div className="text-center py-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-300 bg-orange-500/10 px-3 py-1 rounded-full">
                <IconBellOff size={12} />
                Alerta abortada — no se pueden enviar más comandos
              </span>
            </div>
            <button onClick={handleOpenResolverOnly}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
              <IconCheck size={16} />
              <span>Resolver alerta visualmente</span>
            </button>
          </>
        ) : pendingCommand ? (
          <>
            <div className="text-center py-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-yellow-300 bg-yellow-500/10 px-3 py-1 rounded-full">
                <IconAlertTriangle size={12} />
                Confirmar envío de comando
              </span>
            </div>
            <p className="text-xs text-text-300 mb-4">
              {pendingCommand === 'persecucion' ? (
                <>¿Enviar <strong className="text-red-400">Modo persecución</strong> al sensor? El sensor seguirá transmitiendo en seguimiento continuo hasta agotar batería.</>
              ) : (
                <>¿Enviar <strong className="text-orange-400">Abortar emergencia</strong> al sensor? Detendrá la alerta y no se podrán enviar más comandos.</>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setPendingCommand(null)} disabled={resolveMutation.isPending}
                className="px-3 py-1.5 text-xs text-text-300 hover:text-text-100 bg-bg-200 hover:bg-bg-300 rounded-lg transition-colors">Volver</button>
              <button onClick={confirmSendCommand} disabled={resolveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50">
                {resolveMutation.isPending ? "Enviando..." : (<><IconCheck size={13} /> Sí, enviar</>)}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-text-300 mb-4">Selecciona una acción para el sensor:</p>
            <div className="space-y-2">
              <button onClick={() => setPendingCommand('abortar')} disabled={resolveMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[12px] font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-40">
                <IconBellOff size={18} />
                <div className="text-left">
                  <p>Abortar emergencia</p>
                  <p className="text-[10px] font-normal text-white/70">Envía comando al sensor para detener la alerta</p>
                </div>
                {resolveMutation.isPending && <span className="ml-auto text-[10px] animate-pulse">Enviando...</span>}
              </button>
              <button onClick={() => setPendingCommand('persecucion')} disabled={resolveMutation.isPending || cmd === 'persecucion'}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40">
                <IconRun size={18} />
                <div className="text-left">
                  <p>Modo persecución</p>
                  <p className="text-[10px] font-normal text-white/70">{cmd === 'persecucion' ? 'Persecución ya activa en el sensor' : 'Activa seguimiento continuo hasta agotar batería'}</p>
                </div>
                {resolveMutation.isPending && <span className="ml-auto text-[10px] animate-pulse">Enviando...</span>}
              </button>
              <div className="border-t border-border/30 pt-3 mt-3">
                <button onClick={handleOpenResolverOnly}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[11px] font-medium text-text-300 bg-bg-200 hover:bg-bg-300 transition-colors">
                  <IconCheck size={16} />
                  <span>Solo resolver alerta visualmente</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Paso 2: Input de motivo + confirmación para resolver visualmente
  const reasonModal = showReasonInput && resolvingAlertId !== null && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-100 border border-border/50 rounded-xl shadow-2xl p-5 w-95 max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-100">Resolver alerta visualmente</h3>
          <button onClick={() => { setShowReasonInput(false); setResolveReason(""); }} className="text-text-300 hover:text-text-100 outline-none"><IconX size={18} /></button>
        </div>
        <p className="text-xs text-text-300 mb-3">Ingresa el motivo de resolución:</p>
        <textarea value={resolveReason} onChange={e => setResolveReason(e.target.value)}
          placeholder="Ej: Se realizó mantenimiento correctivo..."
          className="w-full bg-bg-200 border border-border/50 rounded-lg px-3 py-2 text-sm text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 resize-none"
          rows={3} autoFocus
        />
        {!commandsSent.has(resolvingAlertId) && (
          <p className="text-[10px] text-yellow-400/80 mt-2 mb-3 flex items-center gap-1">
            <IconAlertTriangle size={11} className="shrink-0" />
            <span>El sensor <span className="text-red-400">no recibirá ningún comando</span>. Seguirá enviando alertas por 6 horas.</span>
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-3">
          <button onClick={() => { setShowReasonInput(false); setResolveReason(""); }} className="px-3 py-1.5 text-xs text-text-300 hover:text-text-100 bg-bg-200 hover:bg-bg-300 rounded-lg transition-colors">Cancelar</button>
          <button onClick={() => { if (resolveReason.trim()) setShowConfirmResolver(true); }}
            disabled={!resolveReason.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50">
            Continuar
          </button>
        </div>
      </div>
    </div>
  );

  // Confirmación final para resolver visual
  const confirmResolveModal = showConfirmResolver && resolvingAlertId !== null && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-100 border border-border/50 rounded-xl shadow-2xl p-5 w-95 max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-yellow-400">¿Resolver solo visual?</h3>
          <button onClick={() => setShowConfirmResolver(false)} className="text-text-300 hover:text-text-100 outline-none"><IconX size={18} /></button>
        </div>
        {commandsSent.has(resolvingAlertId) ? (
          <p className="text-xs text-green-400 mb-4 flex items-center gap-1.5">
            <IconCheck size={13} className="shrink-0" />
            <span>Comando ya enviado al sensor. Solo se resolverá la alerta visualmente.</span>
          </p>
        ) : (
          <p className="text-xs text-text-300 mb-4">El sensor seguirá enviando alertas críticas durante 6 horas si no se envía un comando de abortar emergencia o modo persecución.</p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setShowConfirmResolver(false)} className="px-3 py-1.5 text-xs text-text-300 hover:text-text-100 bg-bg-200 hover:bg-bg-300 rounded-lg transition-colors">Volver</button>
          <button onClick={handleConfirmResolverOnly} disabled={resolveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >{resolveMutation.isPending ? "Resolviendo..." : (<><IconCheck size={13} /> Resolver igual</>)}</button>
        </div>
      </div>
    </div>
  );

  // ─── Popup de metadata (movimientos anómalos) ───
  const expandedAlert = expandedMetaAlertId != null ? timelineData.find((a: any) => a.id === expandedMetaAlertId) : null;
  const metaModal = expandedAlert && expandedAlert.metadata && Object.keys(expandedAlert.metadata).length > 0 && (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setExpandedMetaAlertId(null)}>
      <div className="bg-bg-100 border border-border/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <IconRadar size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold text-text-100">Detalle Mov. Anómalo</h3>
          </div>
          <button onClick={() => setExpandedMetaAlertId(null)} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100 transition-colors">
            <IconX size={16} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-text-100">{expandedAlert.device_name}</span>
          <span className="font-mono text-text-300">{format(new Date(expandedAlert.created_at), "dd/MM HH:mm:ss")}</span>
        </div>
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1.5">
          {Object.entries(expandedAlert.metadata).map(([k, v]) => {
            const rawValue = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
            const displayValue = resolveEui(rawValue);
            const isDevEui = euiNameMap.has(String(v).toLowerCase());
            return (
              <div key={k} className="flex items-start gap-2 text-[11px]">
                <span className="font-semibold text-purple-300 capitalize shrink-0 w-28 truncate">{k.replace(/_/g, ' ')}</span>
                <span className="text-text-200" style={{ overflowWrap: 'break-word' }}>{displayValue}</span>
                {isDevEui && <IconCheck size={12} className="text-teal-400 shrink-0 ml-auto" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const allModals = <>{resolveModal}{reasonModal}{confirmResolveModal}{metaModal}</>;

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
        {allModals}
      </>
    );
  }

  if (isMobile && !isOpen) {
    return (
      <>
        <button className="absolute right-0 z-50 top-[50%] rounded-s-sm bg-brand-100 p-1" onClick={() => setOpen?.(true)}>
          <IconX size={24} stroke={1.5} className="text-white rotate-45" />
        </button>
        {allModals}
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
      {allModals}
    </>
  );
}
