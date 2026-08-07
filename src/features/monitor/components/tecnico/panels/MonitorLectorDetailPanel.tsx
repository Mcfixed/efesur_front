import MonitorLectorDashboard from "./MonitorLectorDashboard";

interface Props {
  deviceId: number;
  deviceName?: string;
  deviceEui?: string;
  lastTs?: string | null;
}

export default function MonitorLectorDetailPanel({ deviceId }: Props) {
  return <MonitorLectorDashboard lectorDeviceId={deviceId} showHeader={false} />;
}
