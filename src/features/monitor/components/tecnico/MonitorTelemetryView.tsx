import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useMonitorSummary, useMonitorActiveSensors, useMonitorAlertsPerDay, useMonitorDevices } from "../../hooks/useMonitor";
import { useMonitorDeviceTelemetry, useMonitorDeviceAlerts, useMonitorGatewayPositions, useMonitorLatestTelemetry } from "../../hooks/useMonitor";
import MonitorDeviceList from "./MonitorDeviceList";
import MonitorDeviceDetailView from "./MonitorDeviceDetailView";
import MonitorLectorAsignadoView from "./MonitorLectorAsignadoView";
import type { MonitorDevice } from "../../types/monitor.types";

const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 Días", hours: 168 },
  { key: "30d", label: "30 Días", hours: 720 },
  { key: "total", label: "Todo", hours: 0 },
];

export default function MonitorTelemetryView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<MonitorDevice | null>(null);
  const [range, setRange] = useState("24h");
  const [deviceTab, setDeviceTab] = useState("Gps");
  const [telemetryOffset, setTelemetryOffset] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const PAGE_SIZE = 200;

  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(30);

  // Filtro por tipo + búsqueda (como Telemetría)
  const filteredDevices = useMemo(() => {
    let list = allDevices || [];
  // Filtro por pestaña de tipo
    if (deviceTab === 'lector_asignado') {
      // No filtrar — se muestra la vista especial
    } else {
      list = list.filter(d => d.type_device === deviceTab);
    }
    // Filtro por texto de búsqueda
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.dev_eui.toLowerCase().includes(q)
      );
    }
    // Filtro por tipo seleccionado en el dropdown
    if (selectedType) {
      list = list.filter(d => d.type_device === selectedType);
    }
    return list;
  }, [allDevices, deviceTab, searchTerm, selectedType]);

  const { from } = useMemo(() => {
    const r = RANGES.find(r => r.key === range);
    if (!r || r.hours === 0) return {};
    return { from: new Date(Date.now() - r.hours * 3600000).toISOString() };
  }, [range]);

  const telemetryParams = useMemo(() => ({ from, limit: PAGE_SIZE, offset: telemetryOffset }), [from, PAGE_SIZE, telemetryOffset]);
  const { data: telemetryData, isLoading } = useMonitorDeviceTelemetry(selectedDevice?.id || null, telemetryParams);
  const lastT = telemetryData?.telemetry?.[0];
  const hasMore = telemetryData?.telemetry?.length === PAGE_SIZE;

  useEffect(() => { setTelemetryOffset(0); }, [selectedDevice?.id, range]);

  const chartData = useMemo(() => {
    if (!telemetryData?.telemetry?.length) return [];
    return telemetryData.telemetry.map(t => {
      const rx = Array.isArray(t.rxinfo) ? t.rxinfo : [];
      const entry: any = { time: format(new Date(t.ts), "MM/dd HH:mm"), voltage: t.object?.voltage_mV ?? null, temperature: t.object?.temperature_C ?? null };
      rx.forEach((gw: any, i: number) => {
        const id = (gw.gatewayId || `gw${i}`).slice(-6);
        entry[`snr_${id}`] = gw.snr;
        entry[`rssi_${id}`] = gw.rssi;
      });
      return entry;
    }).reverse();
  }, [telemetryData]);

  const gatewayNames = useMemo(() => {
    const names = new Set<string>();
    telemetryData?.telemetry?.forEach(t => { if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) names.add(gw.gatewayId.slice(-6)); }); });
    return [...names];
  }, [telemetryData]);

  const activeGatewayIds = useMemo(() => {
    const ids = new Set<string>();
    telemetryData?.telemetry?.forEach(t => { if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) ids.add(gw.gatewayId); }); });
    return [...ids];
  }, [telemetryData]);

  const handleSelectDevice = (device: MonitorDevice) => {
    setSelectedDevice(device);
    setSearchTerm("");
  };

  if (selectedDevice) {
    return (
      <MonitorDeviceDetailView
        device={selectedDevice}
        onBack={() => setSelectedDevice(null)}
        range={range}
        onRangeChange={setRange}
        telemetryData={telemetryData}
        isLoading={isLoading}
        chartData={chartData}
        gatewayNames={gatewayNames}
        activeGatewayIds={activeGatewayIds}
        hasMore={hasMore}
        onLoadMore={() => setTelemetryOffset(p => p + PAGE_SIZE)}
        lastT={lastT}
      />
    );
  }

  if (deviceTab === 'lector_asignado') {
    return <MonitorLectorAsignadoView />;
  }

  return (
    <MonitorDeviceList
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      deviceTab={deviceTab}
      onDeviceTabChange={setDeviceTab}
      filteredDevices={filteredDevices}
      allDevices={allDevices || []}
      latestTelemetry={latestTelemetry || []}
      onSelectDevice={handleSelectDevice}
      expandedCard={expandedCard}
      onToggleCard={setExpandedCard}
    />
  );
}
