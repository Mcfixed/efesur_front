import { useState } from "react";
import { format } from "date-fns";
import { useAuditLogs } from "../hooks/useAudit";
import { IconSearch, IconHistory, IconX } from "@tabler/icons-react";

const ACTION_LABELS: Record<string, string> = {
  chirpstack_send_command: "Envió comando ChirpStack",
  create_company: "Creó empresa",
  update_company: "Actualizó empresa",
  delete_company: "Eliminó empresa",
  create_user: "Creó usuario",
  update_user: "Actualizó usuario",
  delete_user: "Eliminó usuario",
  create_device: "Creó dispositivo",
  update_device: "Actualizó dispositivo",
  delete_device: "Eliminó dispositivo",
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
};

export default function AuditPage() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [detailLog, setDetailLog] = useState<any>(null);
  const limit = 50;

  const { data, isLoading } = useAuditLogs({
    limit,
    offset: page * limit,
    action: actionFilter || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="relative rounded-xl bg-linear-to-r from-bg-300/40 via-bg-100/60 to-bg-200/40 border border-border/20 px-5 py-4 mb-6">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
          style={{ background: "linear-gradient(to left, transparent, #6b7280, transparent)" }}
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-100">Auditoría del Sistema</h1>
            <p className="text-sm text-text-200 mt-1">Registro detallado de todas las acciones del sistema.</p>
          </div>
          <IconHistory size={24} className="text-text-300" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300" />
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
            className="w-full bg-bg-100 border border-border/30 rounded-lg pl-8 pr-3 py-2 text-[12px] text-text-100 outline-none focus:border-brand-100/50"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <span className="text-[12px] text-text-300 ml-auto">
          {data ? `${data.total} registros` : ""}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-bg-100 rounded-lg border border-border overflow-hidden flex-1">
        <div className="overflow-x-auto max-h-full overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                <th className="text-left py-2 px-2 font-medium">Fecha</th>
                <th className="text-left py-2 px-2 font-medium">Usuario</th>
                <th className="text-left py-2 px-2 font-medium">Acción</th>
                <th className="text-left py-2 px-2 font-medium">Detalle</th>
                <th className="text-left py-2 px-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-300 text-xs">Cargando...</td></tr>
              ) : !data?.logs.length ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-300 text-xs">Sin registros</td></tr>
              ) : (
                data.logs.map((log, i) => (
                  <tr key={log.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                    <td className="py-1.5 px-2 whitespace-nowrap text-text-300 font-mono text-[10px]">
                      {(() => {
                        try {
                          if (!log.created_at) return "—";
                          const ts = String(log.created_at);
                          if (!ts) return "—";
                          const d = new Date(ts.includes('T') && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts);
                          if (isNaN(d.getTime())) return "—";
                          return format(d, "dd/MM HH:mm");
                        } catch { return "—"; }
                      })()}
                    </td>
                    <td className="py-1.5 px-2 font-medium text-text-100">{log.user_name || "—"}</td>
                    <td className="py-1.5 px-2">
                      <span className="bg-bg-200/60 px-1.5 py-0.5 rounded text-[10px] font-medium text-text-200">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-text-300 text-[10px] max-w-xs truncate cursor-pointer hover:text-text-100" onClick={() => setDetailLog(log)}>
                      {log.details ? JSON.stringify(log.details).slice(0, 80) + "..." : "—"}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-text-300">{log.ip || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded text-[12px] bg-bg-100 border border-border/30 text-text-300 disabled:opacity-30 hover:text-text-100 transition-colors"
          >
            Anterior
          </button>
          <span className="text-[12px] text-text-300">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded text-[12px] bg-bg-100 border border-border/30 text-text-300 disabled:opacity-30 hover:text-text-100 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {detailLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDetailLog(null)}>
          <div className="bg-bg-100 border border-border/30 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/20">
              <div>
                <h3 className="text-sm font-bold text-text-100">Detalle de auditoría</h3>
                <p className="text-[11px] text-text-300 mt-0.5">
                  {detailLog.user_name} — {ACTION_LABELS[detailLog.action] || detailLog.action}
                </p>
              </div>
              <button onClick={() => setDetailLog(null)} className="p-1 rounded hover:bg-bg-200/60 text-text-300 hover:text-text-100">
                <IconX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-[12px] text-text-200 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(detailLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
