import { useState, useMemo } from "react";
import { useGpsDevices, useChirpstackCommands, useSendCommand } from "../hooks/useChirpstack";
import { chirpstackService } from "../services/chirpstack.service";
import { IconCheck, IconX, IconDeviceSdCard, IconAlertTriangle, IconSend, IconLock } from "@tabler/icons-react";
import { toast } from "sonner";

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  PRODUCCION:  { label: "Producción",  color: "text-teal-400 bg-teal-500/10" },
  TRANSPORTE:  { label: "Transporte",  color: "text-blue-400 bg-blue-500/10" },
  MANTENIMIENTO: { label: "Mantenimiento", color: "text-yellow-400 bg-yellow-500/10" },
  VALIDACION:  { label: "Validación",  color: "text-purple-400 bg-purple-500/10" },
  EMERGENCIA:  { label: "Emergencia",  color: "text-red-400 bg-red-500/10" },
};

type SelectionMode = "none" | "all" | "some";

export default function ChirpstackConfig() {
  const { data: devices, isLoading } = useGpsDevices();
  const { data: commands, isLoading: commandsLoading } = useChirpstackCommands();
  const sendMutation = useSendCommand();

  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<any>(null);
  const [confirmCmd, setConfirmCmd] = useState<string | null>(null);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await chirpstackService.chirpstackAuth(password);
      setAuthorized(true);
      toast.success("Acceso autorizado");
    } catch {
      toast.error("Contraseña incorrecta");
    }
    setAuthLoading(false);
    setPassword("");
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-bg-100 border border-border/30 rounded-xl shadow-xl p-8 w-full max-w-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-100/10 flex items-center justify-center">
              <IconLock size={28} className="text-brand-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-100">Acceso restringido</h2>
              <p className="text-[12px] text-text-300 mt-1">Ingresa la contraseña de administrador para acceder a la configuración ChirpStack</p>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              placeholder="Contraseña"
              className="w-full bg-bg-200/60 border border-border/30 rounded-lg px-4 py-2.5 text-[13px] text-text-100 outline-none focus:border-brand-100/50 text-center"
              autoFocus
            />
            <button
              onClick={handleAuth}
              disabled={!password || authLoading}
              className="w-full px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-brand-100 hover:bg-brand-200 transition-colors disabled:opacity-30"
            >
              {authLoading ? "Verificando..." : "Ingresar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const toggleDevice = (devEui: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(devEui)) next.delete(devEui);
      else next.add(devEui);
      return next;
    });
    setLastResult(null);
  };

  const toggleAll = () => {
    if (!devices) return;
    if (selMode === "all") setSelected(new Set());
    else setSelected(new Set(devices.map(d => d.dev_eui)));
    setLastResult(null);
  };

  const handleSend = async (commandKey: string) => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un dispositivo");
      return;
    }
    setConfirmCmd(commandKey);
  };

  const executeSend = async () => {
    if (!confirmCmd) return;
    setConfirmCmd(null);
    try {
      const result = await sendMutation.mutateAsync({
        devEuis: Array.from(selected),
        command: confirmCmd,
      });
      setLastResult(result);
      toast.success(`Comando "${result.commandLabel}" enviado: ${result.exito} éxitos, ${result.fallo} fallos`);
    } catch (err: any) {
      toast.error(err.message || "Error al enviar comando");
    }
  };

  // Calcular selectionMode inline
  const selMode: SelectionMode = !devices || devices.length === 0 ? "none"
    : selected.size === devices.length ? "all"
    : selected.size > 0 ? "some" : "none";

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-100">Configuración Dispositivos ChirpStack</h2>
          <p className="text-[12px] text-text-300 mt-0.5">
            {isLoading ? "Cargando..." : `${devices?.length || 0} dispositivos GPS encontrados`}
          </p>
        </div>
      </div>

      {/* ─── Comandos ─── */}
      <div className="space-y-3">
        {commandsLoading ? (
          <div className="text-[12px] text-text-300 animate-pulse">Cargando comandos...</div>
        ) : !commands || commands.length === 0 ? (
          <div className="text-[12px] text-text-300">No hay comandos disponibles</div>
        ) : (
          <>
          {/* Modos de operación */}
          <div>
            <p className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mb-1.5">Modos de Operación</p>
            <div className="grid grid-cols-5 gap-2">
              {commands.filter(c => c.group === "modo").map(cmd => {
                const colors: Record<string, string> = {
                  PRODUCCION: "from-teal-600 to-teal-800 hover:to-teal-700",
                  TRANSPORTE: "from-blue-600 to-blue-800 hover:to-blue-700",
                  MANTENIMIENTO: "from-yellow-600 to-yellow-800 hover:to-yellow-700",
                  VALIDACION: "from-purple-600 to-purple-800 hover:to-purple-700",
                  EMERGENCIA: "from-red-600 to-red-800 hover:to-red-700",
                };
                return (
                  <button
                    key={cmd.key}
                    onClick={() => handleSend(cmd.key)}
                    disabled={selected.size === 0 || sendMutation.isPending}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-white text-[12px] font-semibold bg-linear-to-br ${
                      colors[cmd.key] || "from-gray-600 to-gray-800"
                    } transition-all shadow disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {cmd.label}
                    <span className="text-[9px] ml-auto opacity-60">F{cmd.fPort}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Utilidades */}
          <div>
            <p className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mb-1.5">Utilidades</p>
            <div className="grid grid-cols-3 gap-2">
              {commands.filter(c => c.group === "util").map(cmd => (
                <button
                  key={cmd.key}
                  onClick={() => handleSend(cmd.key)}
                  disabled={selected.size === 0 || sendMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-[12px] font-semibold bg-linear-to-br from-gray-600 to-gray-800 hover:to-gray-700 transition-all shadow disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {cmd.label}
                  <span className="text-[9px] ml-auto opacity-60">F{cmd.fPort}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Emergencia / Mantenimiento */}
          <div>
            <p className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mb-1.5">Emergencia y Mantenimiento</p>
            <div className="grid grid-cols-3 gap-2">
              {commands.filter(c => c.group === "emergencia" || c.group === "mantenimiento").map(cmd => (
                <button
                  key={cmd.key}
                  onClick={() => handleSend(cmd.key)}
                  disabled={selected.size === 0 || sendMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-[12px] font-semibold bg-linear-to-br from-red-700 to-red-900 hover:to-red-800 transition-all shadow disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {cmd.label}
                  <span className="text-[9px] ml-auto opacity-60">F{cmd.fPort}</span>
                </button>
              ))}
            </div>
          </div>
          </>
        )}
      </div>

      {/* ─── Resultado ─── */}
      {lastResult && (
        <div>
          <div className={`rounded-lg px-4 py-2.5 text-[12px] flex items-center gap-2 ${
            lastResult.fallo > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
          }`}>
            {lastResult.fallo > 0 ? <IconX size={16} /> : <IconCheck size={16} />}
            <span className="font-semibold">{lastResult.commandLabel}:</span>
            <span>{lastResult.exito} enviados</span>
            {lastResult.fallo > 0 && <span>, {lastResult.fallo} fallos</span>}
          </div>
          {lastResult.fallo > 0 && lastResult.detalles && (
            <div className="mt-2 space-y-1">
              {lastResult.detalles.filter(d => d.status === 'error').map((d: any) => (
                <div key={d.devEui} className="text-[11px] text-red-400/80 bg-red-500/5 rounded px-3 py-1.5">
                  <span className="font-mono font-semibold">{d.devEui}:</span> {d.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tabla de dispositivos ─── */}
      <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-bg-200/40">
          <button
            onClick={toggleAll}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selMode === "all"
                ? "bg-brand-100 border-brand-100"
                : selMode === "some"
                  ? "bg-brand-100/30 border-brand-100/50"
                  : "border-text-300 hover:border-text-200"
            }`}
          >
            {(selMode === "all" || selMode === "some") && (
              <IconCheck size={10} className="text-white" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider flex-1">
            Dispositivo
          </span>
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider w-24">
            Modo actual
          </span>
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider w-20 text-right">
            {selected.size} selec.
          </span>
        </div>

        {/* Body */}
        <div className="max-h-96 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-text-300">Cargando dispositivos...</div>
          ) : !devices || devices.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text-300">No hay dispositivos GPS activos</div>
          ) : (
            devices.map(d => (
              <div
                key={d.dev_eui}
                onClick={() => toggleDevice(d.dev_eui)}
                className={`flex items-center gap-2 px-3 py-2 border-b border-border/10 cursor-pointer transition-colors text-[12px] hover:bg-bg-200/40 ${
                  selected.has(d.dev_eui) ? "bg-brand-100/5" : ""
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  selected.has(d.dev_eui)
                    ? "bg-brand-100 border-brand-100"
                    : "border-text-400"
                }`}>
                  {selected.has(d.dev_eui) && <IconCheck size={10} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <IconDeviceSdCard size={14} className="text-text-300 shrink-0" />
                  <span className="font-medium text-text-100 truncate">{d.name}</span>
                  <span className="text-[10px] font-mono text-text-300 truncate">{d.dev_eui}</span>
                </div>
                <span className="w-24 text-[10px]">
                  {(() => {
                    const mode = MODE_LABELS[d.operating_mode];
                    return mode
                      ? <span className={`${mode.color} px-1.5 py-0.5 rounded font-medium`}>{mode.label}</span>
                      : <span className="text-text-300">{d.operating_mode}</span>;
                  })()}
                </span>
                <span className="w-20 text-right text-text-300">
                  {selected.has(d.dev_eui) ? "✓" : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Spinner de envío ─── */}
      {sendMutation.isPending && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-bg-100 border border-border/30 rounded-xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-100 border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-text-100 font-medium">Enviando comando...</p>
            <p className="text-[11px] text-text-300">{selected.size} dispositivos</p>
          </div>
        </div>
      )}

      {/* ─── Modal de confirmación ─── */}
      {confirmCmd && (() => {
        const cmd = commands?.find(c => c.key === confirmCmd);
        const selectedDevices = devices?.filter(d => selected.has(d.dev_eui)) || [];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-bg-100 border border-border/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <IconAlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-100">¿Enviar comando?</h3>
                  <p className="text-[11px] text-text-300 mt-0.5">
                    Esta acción enviará <strong className="text-text-100">{cmd?.label}</strong> a <strong className="text-text-100">{selectedDevices.length}</strong> dispositivo(s)
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 max-h-40 overflow-auto space-y-1">
                {selectedDevices.map(d => {
                  const mode = MODE_LABELS[d.operating_mode];
                  return (
                    <div key={d.dev_eui} className="flex items-center gap-2 text-[12px] text-text-200">
                      <span className="font-medium text-text-100 truncate max-w-32">{d.name}</span>
                      <span className="font-mono text-text-300 text-[10px]">{d.dev_eui}</span>
                      <span className="ml-auto">
                        {mode ? <span className={`${mode.color} px-1.5 py-0.5 rounded text-[10px] font-medium`}>{mode.label}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-border/20 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmCmd(null)}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-text-300 hover:text-text-100 bg-bg-200/60 hover:bg-bg-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeSend}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-1.5"
                >
                  <IconSend size={13} />
                  Enviar comando
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
