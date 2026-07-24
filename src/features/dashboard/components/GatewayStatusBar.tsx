import { useEffect, useRef, useState } from "react";
import type { GatewayDevice } from "../types/dashboard.types";

export default function GatewayStatusBar({ gateways }: { gateways: GatewayDevice[] }) {
  if (gateways.length === 0) return null;

  const online = gateways.filter(g => g.is_online);
  const offline = gateways.filter(g => !g.is_online);
  const [showOnlinePopup, setShowOnlinePopup] = useState(false);
  const popupRef = useRef(null);
  useEffect(() => {
  const handleClickOutside = (e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) {
      setShowOnlinePopup(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

return (
  <div className="flex flex-col gap-1.5 w-full max-w-50 relative">
    {/* Header */}
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-200 border-b border-border/20 pb-1.5">
      <span>Gateways</span>
      <div className="flex items-center gap-2 relative">
        {/* Número de inactivos */}
        <span className="text-red-500 font-bold text-[11px]">{offline.length}</span>
        {/* Botón con número de activos */}
        {online.length > 0 && (
          <button
  onClick={() => setShowOnlinePopup(!showOnlinePopup)}
  aria-expanded={showOnlinePopup}
  aria-label={`Usuarios en línea (${online.length})`}
  className="
    relative flex items-center gap-1 px-2 py-1
    rounded-full bg-emerald-500/10 hover:bg-emerald-500/20
    border border-emerald-500/30 hover:border-emerald-500/50
    text-emerald-400 text-xs font-medium
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-gray-900
    active:scale-95
  "
>
  <span className="tabular-nums">{online.length}</span>
  <span className={`transition-transform duration-200 ${showOnlinePopup ? 'rotate-270' : ''}`}>
    ▼
  </span>
</button>
        )}
        {/* Popup de activos - posicionado a la DERECHA del botón */}
        {showOnlinePopup && online.length > 0 && (
          <div
            ref={popupRef}
            className="absolute top-1/2 left-full -translate-y-1/2 ml-1 w-36 max-h-28 overflow-y-auto bg-bg-200/95 backdrop-blur-sm border border-border/30 rounded-lg shadow-xl p-1.5 z-50"
          >
            <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/80 border-b border-border/10 pb-0.5 mb-0.5 px-1">
              Online ({online.length})
            </div>
            {online.map(gw => (
              <div
                key={gw.id}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-bg-300/30 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399] shrink-0" />
                <span className="text-[10px] text-emerald-300/90 truncate">
                  {gw.name.replace(/^Gateway\s/, '')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Lista de inactivos */}
    {offline.map(gw => (
      <div
        key={gw.id}
        className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-500/30 hover:bg-black/55 transition cursor-default shadow-lg"
      >
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
        <span className="text-[12px] text-red-500  truncate flex-1">
          {gw.name.replace(/^Gateway\s/, '')}
        </span>
        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Off</span>
        {/* Tooltip */}
        <div className="absolute left-43 top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-bg-300/95 backdrop-blur-md border border-border/40 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 text-[10px] text-text-200">
          {gw.ip_internal || '—'} · sin respuesta
        </div>
      </div>
    ))}
  </div>
);
}
