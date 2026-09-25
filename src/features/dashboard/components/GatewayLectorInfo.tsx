import { useMemo } from "react";
import { useMonitorDevices, useMonitorDeviceTelemetry } from "@/features/monitor/hooks/useMonitor";
import { cleanVoltage } from "@/features/monitor/utils/mppt";
import { lit5512SocPct, isLectorValueStale } from "../utils/batteryLit5512";

interface Props {
  gatewayId: number;
}

// Bloque del popup del gateway: lector asignado y su último valor de batería.
export default function GatewayLectorInfo({ gatewayId }: Props) {
  const { data: allDevices, isLoading: devicesLoading } = useMonitorDevices();

  // El vínculo lo lleva el gateway: devices[Gateway].id_device_father = id del Lector.
  // Se prueba también la relación inversa por si quedó cargada al revés.
  const lector = useMemo(() => {
    if (!allDevices) return null;
    const gw = allDevices.find(d => d.id === gatewayId);
    const fatherId = gw?.id_device_father ?? null;
    if (fatherId != null) {
      const byFather = allDevices.find(d => d.type_device === "Lector" && d.id === fatherId);
      if (byFather) return byFather;
    }
    return allDevices.find(d => d.type_device === "Lector" && d.id_device_father === gatewayId) ?? null;
  }, [allDevices, gatewayId]);

  const { data: telData } = useMonitorDeviceTelemetry(lector?.id ?? null, { limit: 1 });
  const last = telData?.telemetry?.[0] ?? null;

  const volts = cleanVoltage(last?.object?.Mppt?.batteryVoltage_V)
    ?? cleanVoltage(last?.object?.BlueSmartIP67?.voltaje_V)
    ?? null;
  const pct = lit5512SocPct(volts);
  const stale = isLectorValueStale(last?.ts);

  return (
    <div className="mt-2 pt-2 border-t border-border/30">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-text-300 mb-1">Lector</p>

      {devicesLoading ? (
        <p className="text-[11px] text-text-300">Cargando…</p>
      ) : !lector ? (
        <p className="text-[11px] text-text-500 italic">Sin lector asignado</p>
      ) : (
        <div className="space-y-1 text-[11px]">
          <p className="text-[13px] font-bold text-text-100 truncate">{lector.name}</p>
          <div className="flex justify-between gap-2">
            <span className="text-text-300 shrink-0">Batería:</span>
            <span className={`font-mono font-medium ${stale ? "text-text-500" : "text-text-100"}`}>
              {volts != null ? `${volts.toFixed(2)} V` : "—"}{pct != null ? ` · ${pct} %` : ""}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-text-300 shrink-0">Último dato:</span>
            <span className={stale ? "text-text-500" : "text-text-100 font-medium"}>
              {last?.ts ? new Date(last.ts).toLocaleString("es-CL") : "Sin datos"}
            </span>
          </div>
          {stale && last?.ts && (
            <p className="text-[9px] text-text-500">Dato con más de 5 minutos</p>
          )}
        </div>
      )}
    </div>
  );
}
