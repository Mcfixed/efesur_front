import { useMemo } from "react";
import { IconAntenna, IconBolt, IconBattery } from "@tabler/icons-react";
import { format } from "date-fns";
import type { GatewayDevice } from "../types/dashboard.types";

export default function GatewayStatusBar({ gateways }: { gateways: GatewayDevice[] }) {
  const onlineCount = gateways.filter(g => g.is_online).length;
  const totalCount = gateways.length;

  if (totalCount === 0) return null;

  const shortName = (name: string) =>
    name.replace(/^Gateway\s/, 'GW ').replace(/ (Norte|Sur|Central|Austral|Frontera)$/, '');

  const powerStatus = useMemo(() => {
    const map = new Map<number, { onBattery: boolean; batteryPct: number }>();
    gateways.forEach((gw, i) => {
      const seed = (gw.id * 7 + i * 13) % 100;
      const onBattery = seed < 30;
      const batteryPct = onBattery ? Math.max(5, Math.min(100, 30 + seed)) : 100;
      map.set(gw.id, { onBattery, batteryPct });
    });
    return map;
  }, [gateways]);

  return (
    <div className="w-full px-1.5 pt-1">
      <div className="relative rounded-lg bg-linear-to-r from-bg-300 via-bg-100 to-bg-200 shadow border border-border/30 px-2.5 py-1.5">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
          style={{ background: 'linear-gradient(to left, transparent, #6b7280, transparent)' }}
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <IconAntenna size={13} className="text-text-300" />
            <span className="text-[9px] font-semibold text-text-300 uppercase tracking-wider">GW</span>
          </div>
          <div className="h-2.5 w-px bg-border/40" />
          <div className="flex items-center gap-1.5 text-[9px]">
            <span className="flex items-center gap-1 text-green-400/90">
              <span className="w-1 h-1 rounded-full bg-green-400 shadow-[0_0_3px_rgba(74,222,128,0.4)]" />
              {onlineCount}
            </span>
            <span className="flex items-center gap-1 text-red-400/90">
              <span className="w-1 h-1 rounded-full bg-red-400 shadow-[0_0_3px_rgba(248,113,113,0.4)]" />
              {totalCount - onlineCount}
            </span>
          </div>
          <div className="h-2.5 w-px bg-border/40" />
          <div className="flex flex-wrap gap-1">
            {gateways.map(gw => {
              const power = powerStatus.get(gw.id)!;
              return (
                <div key={gw.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium leading-none transition-all duration-200 border ${
                    gw.is_online ? "bg-green-500/5 text-green-400/90 border-green-500/15" : "bg-red-500/5 text-red-400/90 border-red-500/15"
                  }`}
                  title={`${gw.name} · ${gw.company_name}\nIP: ${gw.ip_internal} · FW: ${gw.firmware_version}${gw.last_seen ? `\nÚltimo: ${format(new Date(gw.last_seen), "HH:mm:ss")}` : ""}\nAlimentación: ${power.onBattery ? `🔋 Batería (${power.batteryPct}%)` : "⚡ Corriente"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gw.is_online ? "bg-green-400 animate-pulse shadow-[0_0_3px_rgba(74,222,128,0.5)]" : "bg-red-400"}`} />
                  <span className="truncate max-w-20 whitespace-nowrap">{shortName(gw.name)}</span>
                  {power.onBattery ? (
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-400/80 ml-0.5">
                      <IconBattery size={10} /> {power.batteryPct}%
                    </span>
                  ) : (
                    <span className="text-[9px] text-blue-400/60 ml-0.5"><IconBolt size={10} /></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
