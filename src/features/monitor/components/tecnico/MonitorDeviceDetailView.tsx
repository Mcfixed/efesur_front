import MonitorDeviceDetailHeader from "../shared/MonitorDeviceDetailHeader";
import MonitorGpsDetailPanel from "./panels/MonitorGpsDetailPanel";
import MonitorGatewayDetailPanel from "./panels/MonitorGatewayDetailPanel";
import MonitorLectorDetailPanel from "./panels/MonitorLectorDetailPanel";
import MonitorSubEstacionDetailPanel from "./panels/MonitorSubEstacionDetailPanel";
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
        lastGwCount={lastT && Array.isArray(lastT.rxinfo) ? lastT.rxinfo.length : null}
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
