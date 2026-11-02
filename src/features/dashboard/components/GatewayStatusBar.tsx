import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import type { GatewayDevice } from "../types/dashboard.types";

// Formatea la fecha del último dato del gateway en formato local legible
const formatLastSeen = (lastSeen?: string | null): string => {
  if (!lastSeen) return 'Sin último dato';
  const d = new Date(lastSeen);
  if (isNaN(d.getTime())) return 'Sin último dato';
  return d.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

export default function GatewayStatusBar({ gateways }: { gateways: GatewayDevice[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  if (gateways.length === 0) return null;

  const online = gateways.filter(g => g.is_online);
  const offline = gateways.filter(g => !g.is_online);
  const [showOnlinePopup, setShowOnlinePopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
      setShowOnlinePopup(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-50 relative">
      <div className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-wider border-b pb-1.5 ${isDark ? "text-text-200 border-border/20" : "text-slate-700 border-slate-200/80"}`}>
        <span>Gateways</span>
        <div className="flex items-center gap-2 relative">
          <span className="text-red-500 font-bold text-[11px]">{offline.length}</span>
          {online.length > 0 && (
            <button
              onClick={() => setShowOnlinePopup(!showOnlinePopup)}
              aria-expanded={showOnlinePopup}
              aria-label={`Usuarios en línea (${online.length})`}
              className={`relative flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium transition-all duration-200 active:scale-95 ${
                isDark
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 focus:ring-offset-gray-900"
                  : "bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-700 focus:ring-offset-white"
              } focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2`}
            >
              <span className="tabular-nums">{online.length}</span>
              <span className={`transition-transform duration-200 ${showOnlinePopup ? "rotate-270" : ""}`}>
                ▼
              </span>
            </button>
          )}
          {showOnlinePopup && online.length > 0 && (
            <div
              ref={popupRef}
              className={`absolute top-1/2 left-full -translate-y-1/2 ml-1 w-36 max-h-28 overflow-y-auto border rounded-lg shadow-xl p-1.5 z-50 ${
                isDark ? "bg-bg-200 border-border/30" : "surface-card-3"
              }`}
            >
              <div className={`text-[9px] font-bold uppercase tracking-wider border-b pb-0.5 mb-0.5 px-1 ${isDark ? "text-emerald-400/80 border-border/10" : "text-emerald-700 border-slate-200"}`}>
                Online ({online.length})
              </div>
              {online.map(gw => (
                <div
                  key={gw.id}
                  className={`flex items-center gap-2 px-1.5 py-1 rounded transition ${isDark ? "hover:bg-bg-300/30" : "hover:bg-slate-100"}`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399] shrink-0" />
                  <span className={`text-[10px] truncate ${isDark ? "text-emerald-300/90" : "text-emerald-700"}`}>
                    {gw.name.replace(/^Gateway\s/, "")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {offline.map(gw => (
        <div
          key={gw.id}
          className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition cursor-default shadow-lg ${
            isDark ? "bg-red-500/10 border-red-500/30 hover:bg-black/55" : "surface-card-2 border-red-200/80 hover:bg-red-50"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
          <span className={`text-[12px] truncate flex-1 ${isDark ? "text-red-500" : "text-red-700"}`}>
            {gw.name.replace(/^Gateway\s/, "")}
          </span>
          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Off</span>
          <div className={`absolute left-43 top-1/2 -translate-y-1/2 ml-2 px-2 py-1 border rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 text-[10px] ${
            isDark ? "bg-bg-300 border-border/40 text-text-200" : "bg-white border-slate-200 text-slate-700"
          }`}>
            Último dato: {formatLastSeen(gw.last_seen)}
          </div>
        </div>
      ))}
    </div>
  );
}
