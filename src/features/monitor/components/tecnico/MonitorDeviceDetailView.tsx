import { useMemo } from "react";
import MonitorDeviceDetailHeader from "../shared/MonitorDeviceDetailHeader";
import MonitorGpsDetailPanel from "./panels/MonitorGpsDetailPanel";
import MonitorGatewayDetailPanel from "./panels/MonitorGatewayDetailPanel";
import MonitorLectorDetailPanel from "./panels/MonitorLectorDetailPanel";
import MonitorSubEstacionDetailPanel from "./panels/MonitorSubEstacionDetailPanel";
import { useMonitorDevices } from "../../hooks/useMonitor";
import type { MonitorDevice } from "../../types/monitor.types";

interface Props {
  device: MonitorDevice;
  onBack: () => void;
  range: string;
  onRangeChange: (range: string) => void;
  telemetryData: any;
  isLoading: boolean;
  chartData: any[];
  gatewayNames: string[];
  activeGatewayIds: string[];
  hasMore: boolean;
  onLoadMore: () => void;
  lastT: any;
}

export default function MonitorDeviceDetailView({
  device, onBack, range, onRangeChange,
  telemetryData, isLoading, chartData, gatewayNames, activeGatewayIds,
  hasMore, onLoadMore, lastT,
}: Props) {
  const { data: allDevices } = useMonitorDevices();

  // Mapa gatewayId -> nombre (por eui completo y por últimos 6 caracteres, case-insensitive),
  // construido desde TODOS los gateways (sin filtrar por posición)
  const gwNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (allDevices || [])
      .filter((d: any) => d.type_device === 'Gateway')
      .forEach((gw: any) => {
        const eui = gw.dev_eui?.toLowerCase();
        if (eui) map.set(eui, gw.name);
        if (eui && eui.length >= 6) map.set(eui.slice(-6), gw.name);
      });
    return map;
  }, [allDevices]);

  // Nombres de gateways del último dato.
  // Para un Lector se usa la asociación directa Gateway -> id_device_father -> Lector,
  // que siempre da el nombre real aunque el rxinfo traiga gatewayIds no registrados.
  // Si hay gateways en el rxinfo pero ninguno se resuelve a nombre, se muestra "—"
  // para que el card nunca desaparezca y nunca se muestren ids crudos.
  const lastGwNames = useMemo(() => {
    if (device.type_device === 'Lector') {
      const names = (allDevices || [])
        .filter((d: any) => d.type_device === 'Gateway' && d.id_device_father === device.id)
        .map((gw: any) => gw.name)
        .filter(Boolean);
      if (names.length > 0) return names;
    }
    const rx = Array.isArray(lastT?.rxinfo) ? lastT.rxinfo : [];
    const names = rx
      .map((gw: any) =>
        gwNameMap.get(String(gw?.gatewayId || '').toLowerCase()) ||
        gwNameMap.get(String(gw?.gatewayId || '').slice(-6)) ||
        null
      )
      .filter(Boolean) as string[];
    if (names.length > 0) return names;
    return rx.length > 0 ? ['—'] : [];
  }, [device, lastT, gwNameMap, allDevices]);

  return (
    <div className="p-2 h-full flex flex-col min-h-0 overflow-hidden">
      <MonitorDeviceDetailHeader
        device={device}
        onBack={onBack}
        lastTs={lastT?.ts}
        recordCount={telemetryData?.telemetry?.length}
        lastVoltage={lastT?.object?.voltage_mV ?? null}
        lastTemp={lastT?.object?.temperature_C ?? null}
        lastMotion={lastT?.object?.systemStatus?.freeFallFlag ? 'Caída' : lastT?.object?.systemStatus?.motionFlag ? 'Sí' : lastT?.object?.voltage_mV != null && lastT?.object?.temperature_C != null ? 'KeepAlive' : null}
        lastGwNames={lastGwNames}
        range={range}
        onRangeChange={onRangeChange}
        // El lector no usa paginación del header (su historial es fijo); ocultar "+ Cargar más"
        onLoadMore={device.type_device === 'Lector' ? undefined : onLoadMore}
        hasMore={device.type_device === 'Lector' ? false : hasMore}
      />
      {device.type_device === 'Gps' && (
        <MonitorGpsDetailPanel deviceId={device.id} deviceName={device.name} deviceEui={device.dev_eui}
          latitude_current={device.latitude_current} longitude_current={device.longitude_current}
          range={range} telemetryData={telemetryData} isLoading={isLoading}
          activeGatewayIds={activeGatewayIds} chartData={chartData} gatewayNames={gatewayNames}
          onExportCSV={() => {}} onExportPDF={() => {}} />
      )}
      {device.type_device === 'Gateway' && (
        <MonitorGatewayDetailPanel deviceId={device.id} deviceName={device.name} deviceEui={device.dev_eui}
          lastSeen={device.last_seen} lastTs={lastT?.ts} range={range} onRangeChange={onRangeChange} />
      )}
      {device.type_device === 'Lector' && (
        <MonitorLectorDetailPanel deviceId={device.id} deviceName={device.name} deviceEui={device.dev_eui} lastTs={lastT?.ts} />
      )}
      {device.type_device === 'SubEstacion' && (
        <MonitorSubEstacionDetailPanel deviceId={device.id} deviceName={device.name} lastTs={lastT?.ts} />
      )}
    </div>
  );
}
