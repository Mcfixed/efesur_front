import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useMonitorDevices } from "../../hooks/useMonitor";
import { useMonitorDeviceTelemetry, useMonitorLatestTelemetry } from "../../hooks/useMonitor";
import MonitorDeviceList from "./MonitorDeviceList";
import MonitorDeviceDetailView from "./MonitorDeviceDetailView";
import { matchesSearch } from "@/utils/text";
import type { MonitorDevice } from "../../types/monitor.types";

// Presets de rango. Sin opción "Todo": el rango por defecto es 24H.
const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 Días", hours: 168 },
  { key: "30d", label: "30 Días", hours: 720 },
];

export default function MonitorTelemetryView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [range, setRange] = useState("24h");
  const [deviceTab, setDeviceTab] = useState("Gateway");
  const [telemetryOffset, setTelemetryOffset] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const PAGE_SIZE = 200;

  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(30);

  // El dispositivo seleccionado se guarda como copia del objeto del clic, así que sus campos
  // (last_seen, is_active, posiciones…) quedaban congelados: el header mostraba el gateway como
  // OFFLINE a los 5 minutos y el esquema del lector se ponía en rojo, aunque siguiera reportando
  // (la tabla de "Últimos registros" sí refrescaba porque usa su propia consulta).
  // Ahora se resuelve contra la lista viva (`useMonitorDevices` refresca cada 30 s); si el
  // dispositivo ya no está en la lista (p. ej. por el filtro de búsqueda) se conserva la copia.
  const [selectedDeviceSnapshot, setSelectedDeviceSnapshot] = useState<MonitorDevice | null>(null);
  const selectedDevice = useMemo(() => {
    if (!selectedDeviceSnapshot) return null;
    const live = (allDevices || []).find((d) => d.id === selectedDeviceSnapshot.id);
    return live ?? selectedDeviceSnapshot;
  }, [allDevices, selectedDeviceSnapshot]);

  // Lista de la tabla. El buscador vive en el header de los tabs, así que cuando hay búsqueda
  // cubre TODOS los tipos de equipo y deja de importar el tab activo (antes eran filtros
  // acumulativos: buscar un gateway estando en el tab Gps no devolvía nada). Sin búsqueda, la
  // lista es la del tab.
  const filteredDevices = useMemo(() => {
    const list = allDevices || [];
    if (searchTerm.trim()) return list.filter(d => matchesSearch(searchTerm, d.name, d.dev_eui, d.type_device));
    return list.filter(d => d.type_device === deviceTab);
  }, [allDevices, deviceTab, searchTerm]);

  const { from } = useMemo(() => {
    const r = RANGES.find(r => r.key === range);
    if (!r || r.hours === 0) return {};
    return { from: new Date(Date.now() - r.hours * 3600000).toISOString() };
  }, [range]);

  const telemetryParams = useMemo(() => ({ from, limit: PAGE_SIZE, offset: telemetryOffset }), [from, PAGE_SIZE, telemetryOffset]);
  const { data: telemetryData, isLoading } = useMonitorDeviceTelemetry(selectedDevice?.id || null, telemetryParams);
  const lastT = telemetryData?.telemetry?.[0];
  const hasMore = telemetryData?.telemetry?.length === PAGE_SIZE;

  // El gráfico tiene su propia consulta con `sample`: reparte los puntos sobre TODO el
  // rango. La tabla sigue paginada de 200 en 200, por eso antes el gráfico solo cubría
  // el tramo final del rango seleccionado.
  const CHART_POINTS = 700;
  const { data: chartSampleData } = useMonitorDeviceTelemetry(selectedDevice?.id || null, { from, sample: CHART_POINTS });
  const chartRows = useMemo(() => chartSampleData?.telemetry ?? [], [chartSampleData]);

  useEffect(() => { setTelemetryOffset(0); }, [selectedDevice?.id, range]);

  const chartData = useMemo(() => {
    if (!chartRows.length) return [];
    return chartRows.map(t => {
      const rx = Array.isArray(t.rxinfo) ? t.rxinfo : [];
      const entry: any = { time: format(new Date(t.ts), "MM/dd HH:mm"), voltage: t.object?.voltage_mV ?? null, temperature: t.object?.temperature_C ?? null };
      rx.forEach((gw: any, i: number) => {
        const id = (gw.gatewayId || `gw${i}`).slice(-6);
        entry[`snr_${id}`] = gw.snr;
        entry[`rssi_${id}`] = gw.rssi;
      });
      return entry;
    });
  }, [chartRows]);

  const gatewayNames = useMemo(() => {
    const names = new Set<string>();
    chartRows.forEach(t => { if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) names.add(gw.gatewayId.slice(-6)); }); });
    return [...names];
  }, [chartRows]);

  const activeGatewayIds = useMemo(() => {
    const ids = new Set<string>();
    chartRows.forEach(t => { if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) ids.add(gw.gatewayId); }); });
    return [...ids];
  }, [chartRows]);

  const handleSelectDevice = (device: MonitorDevice) => {
    setSelectedDeviceSnapshot(device);
    setSearchTerm("");
    // Si abriste un equipo que no era del tab activo (búsqueda sobre todos los tipos), al volver
    // la tabla queda en el tab de ese equipo en vez del anterior.
    setDeviceTab(device.type_device);
  };

  if (selectedDevice) {
    return (
      <MonitorDeviceDetailView
        device={selectedDevice}
        onBack={() => setSelectedDeviceSnapshot(null)}
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

  return (
    <MonitorDeviceList
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
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
