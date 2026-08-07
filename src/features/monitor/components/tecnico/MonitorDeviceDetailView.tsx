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

  // Mapa gatewayId -> nombre (por eui completo y por últimos 6 caracteres),
  // construido desde TODOS los gateways (sin filtrar por posición)
  const gwNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (allDevices || [])
      .filter((d: any) => d.type_device === 'Gateway')
      .forEach((gw: any) => {
        if (gw.dev_eui) map.set(gw.dev_eui, gw.name);
        if (gw.dev_eui?.length >= 6) map.set(gw.dev_eui.slice(-6), gw.name);
      });
    return map;
  }, [allDevices]);

  // Nombres de gateways del último dato
  const lastGwNames = useMemo(() => {
    const rx = Array.isArray(lastT?.rxinfo) ? lastT.rxinfo : [];
    return rx.map((gw: any, i: number) =>
      gwNameMap.get(gw.gatewayId) || gwNameMap.get(gw.gatewayId?.slice(-6)) || gw.gatewayId?.slice(-6) || `GW${i + 1}`
    );
  }, [lastT, gwNameMap]);

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
        onLoadMore={onLoadMore}
        hasMore={hasMore}
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
