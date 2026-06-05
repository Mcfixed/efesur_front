import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useSensorSummary, useSearchDevices, useDeviceTelemetry } from "../hooks/useTelemetry";
import type { DeviceSearchResult } from "../types/telemetry.types";

const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 Días", hours: 168 },
  { key: "30d", label: "30 Días", hours: 720 },
  { key: "total", label: "Todo", hours: 0 },
];

const TYPE_COLORS: Record<string, string> = {
  Gps:         "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  Gateway:     "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  SubEstacion: "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
  Lector:      "from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-400",
};

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-300/60 shrink-0">{label}</span>
      <div className="h-px flex-1 bg-linear-to-r from-border/30 to-transparent" />
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2.5 shadow-2xl text-[11px] min-w-35">
      <p className="text-text-400 font-mono text-[9px] mb-1.5 border-b border-white/5 pb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold leading-5 text-[12px]">
          {p.name}: <span className="text-white font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-200/40 border border-border/10 rounded-lg p-2 shadow-sm">
      <p className="text-[9px] font-semibold text-text-200 mb-1">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center gap-2 border-b border-border/5 last:border-0">
      <span className="text-[10px] text-text-300 shrink-0">{label}</span>
      <span className={`text-[10px] text-right truncate max-w-[60%] ${color || 'text-text-200'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function Telemetry() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [range, setRange] = useState("24h");

  const { data: summary } = useSensorSummary();
  const { data: searchData } = useSearchDevices({ q: searchTerm, type: selectedType || undefined, limit: 10 });
  const devices = searchData?.data || [];

  const { from } = useMemo(() => {
    const r = RANGES.find(r => r.key === range);
    if (!r || r.hours === 0) return {};
    return { from: new Date(Date.now() - r.hours * 3600000).toISOString() };
  }, [range]);

  const { data: telemetryData, isLoading } = useDeviceTelemetry(selectedDevice?.id || null, { from, limit: 500 });
  const lastT = telemetryData?.telemetry?.[0];

  const chartData = useMemo(() => {
    if (!telemetryData?.telemetry?.length) return [];
    return telemetryData.telemetry.map(t => {
      const rx = Array.isArray(t.rxinfo) ? t.rxinfo : [];
      const entry: any = {
        time: format(new Date(t.ts), "MM/dd HH:mm"),
        voltage: t.object?.voltage_mV ?? null,
        temperature: t.object?.temperature_C ?? null,
      };
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
    telemetryData?.telemetry?.forEach(t => {
      if (Array.isArray(t.rxinfo)) t.rxinfo.forEach((gw: any) => { if (gw.gatewayId) names.add(gw.gatewayId.slice(-6)); });
    });
    return [...names];
  }, [telemetryData]);

  const types = summary?.types || [];
  const gpsModes = summary?.gpsModes || [];

  const axisStyle = { fontSize: 10, fill: '#9ca3af' };

  return (
    <div className="p-3 h-full flex flex-col gap-2 overflow-hidden">
      {/* ─── SUMMARY CARDS ─── */}
      <SectionDivider label="Resumen de sensores" />
      <div className="grid grid-cols-4 gap-2">
        {types.map(s => {
          const connected = s.total - s.disconnected;
          const colors = TYPE_COLORS[s.type_device] || "from-gray-500/15 to-gray-500/5 border-gray-500/20 text-gray-400";
          return (
            <div key={s.type_device} className={`rounded border bg-linear-to-br ${colors} py-2 px-3`}>
              <div className="flex items-center justify-between">
                <span className="text-md font-semibold uppercase tracking-wider opacity-60">{s.type_device}</span>
                <span className="text-base font-bold">{s.total}</span>
              </div>
              <div className="flex gap-2 mt-0.5 text-[8px]">
                <span className="text-green-400/80">{connected} ok</span>
                {s.disconnected > 0 && <span className="text-red-400/80">{s.disconnected} off</span>}
              </div>
              {s.type_device === 'Gps' && gpsModes.length > 0 && (
                <div className="flex flex-wrap gap-x-2 mt-1.5 pt-1.5 border-t border-white/5">
                  {gpsModes.map(m => (
                    <span key={m.mode} className="text-[7px] text-text-300/70 whitespace-nowrap">
                      {m.mode === 'sin datos' ? '—' : m.mode.slice(0, 8)} <strong className="text-text-300">{m.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── SEARCH ─── */}
      <SectionDivider label="Buscar sensor" />
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setSelectedDevice(null); }}
            placeholder="Nombre o EUI del dispositivo..."
            className="w-full bg-bg-200 border border-gray-400/20 rounded-lg pl-8 pr-3 py-2 text-[13px] text-text-100 placeholder:text-text-300 outline-none focus:border-brand-100/50 transition-colors"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
          className="bg-bg-200 border border-gray-400/20 rounded-lg px-3 py-2 text-[12px] text-text-100 outline-none focus:border-brand-100/50"
        >
          <option value="">Todos</option>
          <option value="Gps">GPS</option>
          <option value="Gateway">Gateway</option>
          <option value="SubEstacion">SubEstación</option>
          <option value="Lector">Lector</option>
        </select>
        {selectedDevice && (
          <button onClick={() => setSelectedDevice(null)}
            className="text-[11px] text-text-300 hover:text-text-100 px-2.5 py-1.5 rounded-lg hover:bg-bg-200 transition-colors shrink-0"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ─── SEARCH RESULTS ─── */}
      {!selectedDevice && searchTerm && devices.length > 0 && (
        <div className="bg-bg-200/40 border border-border/20 rounded-xl overflow-hidden shadow-sm">
          {devices.map(d => (
            <button key={d.id} onClick={() => { setSelectedDevice(d); setSearchTerm(''); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-200/60 transition-colors border-b border-border/5 last:border-0 group"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.is_active ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.4)]' : 'bg-red-400'}`} />
              <span className="text-[13px] font-semibold text-text-100 truncate group-hover:text-brand-200 transition-colors">{d.name}</span>
              <span className="text-[9px] text-text-300 font-mono truncate">{d.dev_eui}</span>
              <span className="text-[10px] text-text-400 ml-auto shrink-0">{d.type_device}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── DEVICE PANEL ─── */}
      {selectedDevice ? (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Header device + range */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedDevice.is_active ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
              <div className="min-w-0">
                <h2 className="text-base text-text-100 truncate">{selectedDevice.name}</h2>
                <p className="text-xs text-gray-400 font-mono truncate">{selectedDevice.dev_eui} · {selectedDevice.type_device} · {selectedDevice.company_name}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${range === r.key ? 'bg-brand-100/15 text-brand-200 shadow-sm' : 'bg-bg-300/50 text-text-300 hover:text-text-200 hover:bg-bg-300'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── INFO DEL SENSOR + ÚLTIMA TRANSMISIÓN ─── */}
          <div className="grid grid-cols-4 gap-2">
            {/* Dispositivo */}
            <div className="col-span-1 bg-bg-200/30 border border-gray-700 rounded p-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 mb-1">Dispositivo</p>
              <InfoRow label="EUI" value={selectedDevice.dev_eui} mono />
              <InfoRow label="Tipo" value={selectedDevice.type_device} />
              <InfoRow label="Empresa" value={selectedDevice.company_name} />
              <InfoRow label="Estado" value={selectedDevice.is_active ? 'Activo' : 'Inactivo'} color={selectedDevice.is_active ? 'text-green-400' : 'text-red-400'} />
              <InfoRow label="Último reporte" value={selectedDevice.last_seen ? format(new Date(selectedDevice.last_seen), "dd MMM yyyy HH:mm") : 'Nunca'} />
            </div>
            {/* Sistema (basado en último dato) */}
            <div className="col-span-1 bg-bg-200/30 border border-gray-700 rounded p-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 mb-1">
                Sistema {lastT ? <span className="text-blue-300 font-normal normal-case">· {format(new Date(lastT.ts), "dd MMM HH:mm")}</span> : ''}
              </p>
              <InfoRow label="Modo operación" value={lastT?.object?.systemStatus?.operatingMode || '—'} />
              <InfoRow
                label="Movimiento"
                value={lastT?.object?.systemStatus?.motionFlag ? 'Detectado' : 'Sin movimiento'}
                color={lastT?.object?.systemStatus?.motionFlag ? 'text-yellow-400' : 'text-text-300'}
              />
              <InfoRow
                label="Free Fall"
                value={lastT?.object?.systemStatus?.freeFallFlag ? 'Sí' : 'No'}
                color={lastT?.object?.systemStatus?.freeFallFlag ? 'text-red-400' : 'text-text-300'}
              />
              <InfoRow
                label="Persecución"
                value={lastT?.object?.systemStatus?.pursuitMode ? 'Activo' : 'Inactivo'}
                color={lastT?.object?.systemStatus?.pursuitMode ? 'text-red-400' : 'text-text-300'}
              />
              <InfoRow label="Acelerómetro" value={lastT?.object?.systemStatus?.accelerometerHealth || '—'} />
            </div>
            {/* Último paquete */}
            <div className="col-span-1 bg-bg-200/30 border border-gray-700 rounded p-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 mb-1">Último paquete</p>
              <InfoRow label="Tipo" value={lastT?.object?.packetType || '—'} />
              <InfoRow label="Batería" value={lastT?.object?.voltage_mV ? `${(lastT.object.voltage_mV / 1000).toFixed(2)}V` : '—'} color="text-green-400" />
              <InfoRow label="Temp" value={lastT?.object?.temperature_C != null ? `${lastT.object.temperature_C}°C` : '—'} color="text-orange-400" />
              <InfoRow label="Satélites" value={lastT?.object?.satellites ?? '—'} />
              <InfoRow label="Timestamp" value={lastT ? format(new Date(lastT.ts), "dd MMM HH:mm:ss") : '—'} mono />
              <InfoRow label="Registros totales" value={telemetryData?.stats?.total_records ?? '—'} />
            </div>
            {/* Gateways último dato */}
            <div className="col-span-1 bg-bg-200/30 border border-gray-700 rounded p-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 mb-1">Gateways último dato</p>
              {lastT && Array.isArray(lastT.rxinfo) && lastT.rxinfo.length > 0 ? (
                lastT.rxinfo.map((gw: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-border/5 last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-200/50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-200 font-mono text-[8px] truncate">{gw.gatewayId || `GW#${i + 1}`}</p>
                      <div className="flex gap-2 text-[9px]">
                        <span className="text-blue-400">SNR {gw.snr ?? '—'}</span>
                        <span className="text-pink-400">RSSI {gw.rssi ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] text-text-400 italic">Sin datos de gateway</p>
              )}
            </div>
            {/* Divider entre info y transmisión */}
            <div className="col-span-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-linear-to-r from-red-500/20 via-red-400/60 to-transparent" />
              <span className="text-[7px] font-semibold uppercase tracking-widest text-text-400/50">Última transmisión</span>
              <div className="h-px flex-1 bg-linear-to-l from-red-500/20 via-red-400/60 to-transparent" />
            </div>
          </div>

          {/* ─── STATS BAR ─── */}
          {telemetryData?.stats && (
            <div className="flex gap-4 text-[9px] text-text-300 bg-bg-200/20 rounded px-2 py-1 border border-border/5">
              <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-brand-200" /> Registros: <strong className="text-text-200">{telemetryData.stats.total_records}</strong></span>
              <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-text-400" /> Desde: <strong className="text-text-200">{telemetryData.stats.first_record ? format(new Date(telemetryData.stats.first_record), "dd MMM yyyy") : '-'}</strong></span>
              <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-text-400" /> Último: <strong className="text-text-200">{telemetryData.stats.last_record ? format(new Date(telemetryData.stats.last_record), "dd MMM HH:mm") : '-'}</strong></span>
            </div>
          )}

          {/* ─── CHARTS + TABLE ─── */}
          <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
            {/* Left: charts */}
            <div className="col-span-2 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 border border-gray-200/20 rounded">
              {chartData.length > 1 && (
                <ChartCard title="Batería y Temperatura">
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval="preserveStartEnd" />
                      <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} verticalAlign="top" />
                      <Line type="monotone" dataKey="voltage" stroke="#22c55e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 1, stroke: '#000', fill: '#22c55e' }} name="Batería (mV)" />
                      <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 1, stroke: '#000', fill: '#fb923c' }} name="Temperatura (°C)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {chartData.length > 1 && gatewayNames.map(gwId => (
                <ChartCard key={gwId} title={`Gateway ${gwId}`}>
                  <ResponsiveContainer width="100%" height={70}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval="preserveStartEnd" />
                      <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} verticalAlign="top" />
                      <Line type="monotone" dataKey={`snr_${gwId}`} stroke="#60a5fa" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 1, stroke: '#000', fill: '#60a5fa' }} name="SNR" />
                      <Line type="monotone" dataKey={`rssi_${gwId}`} stroke="#fbbf24" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 1, stroke: '#000', fill: '#fbbf24' }} name="RSSI" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              ))}
            </div>

            {/* Right: table */}
            <div className="col-span-1 bg-bg-200/40 border border-gray-300/20 rounded overflow-hidden flex flex-col min-h-0 shadow-sm">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300/20 shrink-0">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-300">
                  Registros
                </p>
                <span className="text-[11px] font-bold text-text-200">{telemetryData?.telemetry?.length || 0}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-text-300 text-[8px] uppercase tracking-wider sticky top-0 bg-bg-200/95 border-b border-gray-300/20">
                      <th className="text-left px-2.5 py-1.5 font-medium">Fecha</th>
                      <th className="text-left px-2.5 py-1.5 font-medium">Bat</th>
                      <th className="text-left px-2.5 py-1.5 font-medium">°C</th>
                      <th className="text-left px-2.5 py-1.5 font-medium">Mov</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetryData?.telemetry?.map(t => (
                      <tr key={t.id} className="border-t border-gray-500/5 hover:bg-bg-200/50 transition-colors">
                        <td className="px-2.5 py-1.5 text-text-200 font-mono whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                        <td className="px-2.5 py-1.5 font-mono">{t.object?.voltage_mV ? <span className="text-green-400/80">{(t.object.voltage_mV / 1000).toFixed(1)}V</span> : <span className="text-text-400">—</span>}</td>
                        <td className="px-2.5 py-1.5 font-mono">{t.object?.temperature_C != null ? <span className="text-orange-400/80">{t.object.temperature_C}°</span> : <span className="text-text-400">—</span>}</td>
                        <td className="px-2.5 py-1.5">{t.object?.systemStatus?.motionFlag ? <span className="text-yellow-400">●</span> : <span className="text-text-500">○</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isLoading && (!telemetryData?.telemetry || telemetryData.telemetry.length === 0) && (
                  <p className="text-center text-text-300 text-xs py-10">Sin registros en este período</p>
                )}
                {isLoading && (
                  <div className="flex justify-center py-6">
                    <span className="text-[10px] text-brand-200 animate-pulse">Cargando datos...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="mx-auto mb-3 text-text-400" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <p className="text-text-300 text-sm">Busca y selecciona un sensor para ver su telemetría</p>
          </div>
        </div>
      )}
    </div>
  );
}
