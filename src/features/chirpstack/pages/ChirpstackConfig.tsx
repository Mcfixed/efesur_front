import { useState, useMemo } from "react";
import { useGpsDevices, useChirpstackCommands, useSendCommand } from "../hooks/useChirpstack";
import { chirpstackService } from "../services/chirpstack.service";
import { IconCheck, IconX, IconDeviceSdCard, IconAlertTriangle, IconSend, IconLock, IconSearch } from "@tabler/icons-react";
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
  const [modeFilter, setModeFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  // ─── Modos disponibles y dispositivos filtrados (tab + búsqueda) ───
  const modeTabs = useMemo(() => {
    if (!devices) return [];
    const modes = Array.from(new Set(devices.map(d => d.operating_mode).filter(Boolean)));
    return modes.sort((a, b) => {
      const ha = MODE_LABELS[a] ? 0 : 1;
      const hb = MODE_LABELS[b] ? 0 : 1;
      return ha - hb || (MODE_LABELS[a]?.label || a).localeCompare(MODE_LABELS[b]?.label || b);
    });
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    const q = search.trim().toLowerCase();
    return devices.filter(d => {
      const okMode = modeFilter === "todos" || d.operating_mode === modeFilter;
      const okSearch = !q || d.name.toLowerCase().includes(q) || d.dev_eui.toLowerCase().includes(q);
      return okMode && okSearch;
    });
  }, [devices, modeFilter, search]);

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
    if (!filteredDevices) return;
    if (selMode === "all") setSelected(new Set());
    else setSelected(new Set(filteredDevices.map(d => d.dev_eui)));
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

  // Calcular selectionMode sobre la vista filtrada actual
  const selMode: SelectionMode = !filteredDevices || filteredDevices.length === 0 ? "none"
    : filteredDevices.every(d => selected.has(d.dev_eui)) ? "all"
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

      {/* ─── Comandos (fila compacta) ─── */}
      {commandsLoading ? (
        <div className="text-[12px] text-text-300 animate-pulse">Cargando comandos...</div>
      ) : !commands || commands.length === 0 ? (
        <div className="text-[12px] text-text-300">No hay comandos disponibles</div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 bg-bg-100 border border-border/30 rounded-lg px-2.5 py-2">
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mr-0.5">Modos</span>
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-[11px] font-semibold bg-linear-to-br ${
                  colors[cmd.key] || "from-gray-600 to-gray-800"
                } transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {cmd.label}
                <span className="text-[8px] opacity-60">F{cmd.fPort}</span>
              </button>
            );
          })}
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mr-0.5 ml-2">Utilidades</span>
          {commands.filter(c => c.group === "util").map(cmd => (
            <button
              key={cmd.key}
              onClick={() => handleSend(cmd.key)}
              disabled={selected.size === 0 || sendMutation.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-[11px] font-semibold bg-linear-to-br from-gray-600 to-gray-800 hover:to-gray-700 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {cmd.label}
              <span className="text-[8px] opacity-60">F{cmd.fPort}</span>
            </button>
          ))}
          <span className="text-[10px] font-semibold text-text-300 uppercase tracking-wider mr-0.5 ml-2">Emerg / Mant</span>
          {commands.filter(c => c.group === "emergencia" || c.group === "mantenimiento").map(cmd => (
            <button
              key={cmd.key}
              onClick={() => handleSend(cmd.key)}
              disabled={selected.size === 0 || sendMutation.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-[11px] font-semibold bg-linear-to-br from-red-700 to-red-900 hover:to-red-800 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {cmd.label}
              <span className="text-[8px] opacity-60">F{cmd.fPort}</span>
            </button>
          ))}
        </div>
      )}

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
        {/* Tabs por modo + buscador */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-bg-200/40 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setModeFilter("todos")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${modeFilter === "todos" ? "bg-brand-200/15 text-brand-200" : "text-text-300 hover:text-text-200 hover:bg-bg-100/50"}`}
            >
              Todos
            </button>
            {modeTabs.map(mode => {
              const meta = MODE_LABELS[mode];
              const active = modeFilter === mode;
              const dotColor = meta?.color?.split(" ")[0] || "bg-text-300";
              return (
                <button
                  key={mode}
                  onClick={() => setModeFilter(mode)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${active ? "bg-brand-200/15 text-brand-200" : "text-text-300 hover:text-text-200 hover:bg-bg-100/50"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  {meta?.label || mode}
                </button>
              );
            })}
          </div>
          <div className="ml-auto relative min-w-56 flex-1 sm:flex-none">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o DevEUI..."
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-bg-200/60 border border-border/30 text-text-100 placeholder:text-text-300 focus:outline-none focus:border-brand-200/50 focus:ring-1 focus:ring-brand-200/30 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-300 hover:text-text-200 transition-colors"
                title="Limpiar búsqueda"
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Header de columnas */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 bg-bg-200/40 text-[10px] font-semibold text-text-300 uppercase tracking-wider">
          <button
            onClick={toggleAll}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
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
          <span className="flex-1">Dispositivo</span>
          <span className="w-40 text-left">DevEUI</span>
          <span className="w-28 text-center">Modo actual</span>
          <span className="w-32 text-right">Último dato</span>
        </div>

        {/* Body */}
        <div className="max-h-96 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-text-300">Cargando dispositivos...</div>
          ) : !filteredDevices || filteredDevices.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text-300">
              {search || modeFilter !== "todos" ? "Sin resultados para el filtro actual" : "No hay dispositivos GPS activos"}
            </div>
          ) : (
            filteredDevices.map(d => (
              <div
                key={d.dev_eui}
                onClick={() => toggleDevice(d.dev_eui)}
                className={`flex items-center gap-2 px-3 py-1.5 border-b border-border/10 cursor-pointer transition-colors text-[13px] hover:bg-bg-200/40 ${
                  selected.has(d.dev_eui) ? "bg-brand-100/5" : ""
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                  selected.has(d.dev_eui)
                    ? "bg-brand-100 border-brand-100"
                    : "border-text-400"
                }`}>
                  {selected.has(d.dev_eui) && <IconCheck size={10} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <IconDeviceSdCard size={14} className="text-text-300 shrink-0" />
                  <span className="font-medium text-text-100 truncate">{d.name}</span>
                </div>
                <span className="w-40 font-mono text-[12px] text-text-200 truncate">{d.dev_eui}</span>
                <span className="w-28 text-center text-[11px]">
                  {(() => {
                    const mode = MODE_LABELS[d.operating_mode];
                    return mode
                      ? <span className={`${mode.color} px-1.5 py-0.5 rounded font-medium`}>{mode.label}</span>
                      : <span className="text-text-300">{d.operating_mode}</span>;
                  })()}
                </span>
                <span className="w-32 text-right text-[13px] font-mono text-text-200 truncate">
                  {d.last_seen ? new Date(d.last_seen).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer con contadores */}
        <div className="px-3 py-1.5 border-t border-border/20 bg-bg-200/30 flex items-center justify-between text-[10px] text-text-300">
          <span>{filteredDevices?.length || 0} de {devices?.length || 0} dispositivos</span>
          <span className="font-semibold text-brand-200">{selected.size} seleccionados</span>
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
