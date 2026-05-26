import { useState } from "react";
import { useSearchDevices, useDeviceTypes, useDeviceTelemetry, useDeviceTelemetryStats } from "../hooks/useTelemetry";
import { WidgetGrid, DataTableWidget, LineChartWidget, StatCardWidget, AreaChartWidget } from "@/components/widgets";
import { DeviceSearchResult } from "../types/telemetry.types";
import { format } from "date-fns";

export default function Telemetry() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);

  const { data: types } = useDeviceTypes();
  const { data: searchData, isLoading: isSearchLoading } = useSearchDevices({
    q: searchTerm,
    type: selectedType || undefined,
    limit: 10,
  });

  const { data: telemetryData, isLoading: isTelemetryLoading } = useDeviceTelemetry(
    selectedDevice?.id || null, 
    { limit: 50 }
  );

  const { data: statsData } = useDeviceTelemetryStats(
    selectedDevice?.id || null,
    24
  );

  const handleDeviceSelect = (device: DeviceSearchResult) => {
    setSelectedDevice(device);
  };

  // Preparar datos para los gráficos
  const chartData = telemetryData?.telemetry?.map(t => ({
    ts: format(new Date(t.ts), "HH:mm:ss"),
    temperature: t.object.temperature,
    speed: t.object.speed,
    fuel: t.object.fuel,
  })).reverse() || [];

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-100">Telemetría de Dispositivos</h1>
          <p className="text-sm text-text-200 mt-1">Busca y analiza datos en tiempo real de los sensores.</p>
        </div>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Buscar dispositivo..." 
            className="px-4 py-2 bg-bg-200 border border-border-100 rounded-lg text-text-100 focus:outline-none focus:border-brand-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="px-4 py-2 bg-bg-200 border border-border-100 rounded-lg text-text-100 focus:outline-none focus:border-brand-100"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {types?.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <WidgetGrid columns={12} gap={16}>
        <div className="col-span-12 lg:col-span-4 h-[400px]">
          <DataTableWidget
            title="Dispositivos"
            data={Array.isArray(searchData?.data) ? searchData.data : (Array.isArray(searchData) ? searchData : [])}
            columns={[
              { key: "name", header: "Nombre" },
              { key: "type_device", header: "Tipo" },
              { 
                key: "is_active", 
                header: "Estado",
                render: (val) => val ? <span className="text-green-400">Activo</span> : <span className="text-text-300">Inactivo</span>
              }
            ]}
            onRowClick={(row) => handleDeviceSelect(row as DeviceSearchResult)}
            isLoading={isSearchLoading}
            pageSize={10}
            hoverable
          />
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {!selectedDevice ? (
            <div className="h-[400px] flex items-center justify-center bg-bg-200 rounded-xl border border-border-100">
              <p className="text-text-300 text-lg">Selecciona un dispositivo para ver su telemetría</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                 <StatCardWidget
                    label="Última Temperatura"
                    value={chartData[chartData.length - 1]?.temperature || "--"}
                    unit="°C"
                    isLoading={isTelemetryLoading}
                 />
                 <StatCardWidget
                    label="Velocidad Actual"
                    value={chartData[chartData.length - 1]?.speed || "--"}
                    unit="km/h"
                    isLoading={isTelemetryLoading}
                 />
                 <StatCardWidget
                    label="Nivel Combustible"
                    value={chartData[chartData.length - 1]?.fuel || "--"}
                    unit="%"
                    isLoading={isTelemetryLoading}
                 />
              </div>

              <LineChartWidget
                title={`Telemetría Tiempo Real: ${selectedDevice.name}`}
                data={chartData}
                xAxisKey="ts"
                dataKey={["temperature", "speed", "fuel"]}
                colors={["#f87171", "#8ecae0", "#82ca9d"]}
                chartHeight={280}
              />

              {statsData && statsData.stats.length > 0 && (
                <AreaChartWidget
                  title="Promedio Temperatura por Hora (24h)"
                  data={statsData.stats.map(s => ({ hour: format(new Date(s.hour), "HH:mm"), avg: s.avg_temperature })).reverse()}
                  xAxisKey="hour"
                  dataKey="avg"
                  colors={["#f87171"]}
                  chartHeight={220}
                />
              )}
            </>
          )}
        </div>
      </WidgetGrid>
    </div>
  );
}
