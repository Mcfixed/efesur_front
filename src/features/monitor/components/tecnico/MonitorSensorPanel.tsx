import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IconX,
  IconBattery,
  IconTemperature,
  IconRadar,
  IconRss,
  IconAlertTriangle,
  IconClock,
  IconAntenna,
} from "@tabler/icons-react";
import { useMonitorDeviceTelemetryHistory, useMonitorDeviceAlerts } from "../../hooks/useMonitor";
import { voltageToPercent, batteryColor } from "../../utils/battery";

// ─── Rangos de tiempo ───
const RANGES = [
  { key: "1h", label: "1h", ms: 3_600_000 },
  { key: "6h", label: "6h", ms: 6 * 3_600_000 },
  { key: "24h", label: "24h", ms: 24 * 3_600_000 },
  { key: "7d", label: "7d", ms: 7 * 24 * 3_600_000 },
  { key: "30d", label: "30d", ms: 30 * 24 * 3_600_000 },
  { key: "custom", label: "Personalizado", ms: 0 },
];

const ALERT_LABELS: Record<string, string> = {
  critica: "Crítica",
  atencion: "Atención",
  apertura: "Apertura",
  presencia: "Presencia",
  movimientos_anomalos: "Mov. anómalo",
  desconexionGW: "Desconexión GW",
  desconexionGPS: "Desconexión GPS",
  desconexion220: "Desconexión CA 220",
  desconexionbatGW: "Desconexión Batería GW",
};

// Colores por tipo de alerta, alineados con la página:
// atención=amarillo, crítica/apertura=rojo, movimientos=morado, desconexiones=naranja
const ALERT_COLORS: Record<string, { text: string; border: string; bg: string; dot: string }> = {
  critica:              { text: "#fca5a5", border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.08)", dot: "#ef4444" },
  atencion:             { text: "#fde047", border: "rgba(234,179,8,0.35)", bg: "rgba(234,179,8,0.08)", dot: "#eab308" },
  apertura:             { text: "#fca5a5", border: "rgba(239,68,68,0.30)", bg: "rgba(239,68,68,0.06)", dot: "#ef4444" },
  presencia:            { text: "#fde047", border: "rgba(234,179,8,0.30)", bg: "rgba(234,179,8,0.06)", dot: "#eab308" },
  movimientos_anomalos: { text: "#d8b4fe", border: "rgba(168,85,247,0.35)", bg: "rgba(168,85,247,0.08)", dot: "#a855f7" },
  desconexionGW:        { text: "#fdba74", border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.08)", dot: "#f97316" },
  desconexionGPS:       { text: "#fdba74", border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.08)", dot: "#f97316" },
  desconexion220:       { text: "#fdba74", border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.08)", dot: "#f97316" },
  desconexionbatGW:     { text: "#fdba74", border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.08)", dot: "#f97316" },
};

// Modo de operación del sensor (mismos valores/colores que ChirpstackConfig y MonitorDeviceList)
const MODE_LABELS: Record<string, { label: string; className: string }> = {
  PRODUCCION:     { label: "Producción",    className: "text-teal-400 bg-teal-500/10 border-teal-500/30" },
  TRANSPORTE:     { label: "Transporte",    className: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  MANTENIMIENTO:  { label: "Mantenimiento", className: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
  VALIDACION:     { label: "Validación",    className: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  EMERGENCIA:     { label: "Emergencia",    className: "text-red-400 bg-red-500/10 border-red-500/30" },
  normal:         { label: "Normal",        className: "text-gray-400 bg-gray-500/10 border-gray-500/30" },
};

function parseRx(t: any): any[] {
  if (Array.isArray(t?.rxinfo)) return t.rxinfo;
  if (typeof t?.rxinfo === "string") {
    try { return JSON.parse(t.rxinfo); } catch { return []; }
  }
  if (t?.rxinfo && typeof t.rxinfo === "object") return [t.rxinfo];
  return [];
}

export default function MonitorSensorPanel({ device, onClose }: { device: any; onClose: () => void }) {
  const [range, setRange] = useState("24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const params = useMemo(() => {
    if (range === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? new Date(customTo).toISOString() : undefined,
        limit: 3000,
      };
    }
    const r = RANGES.find(x => x.key === range)!;
    return {
      from: new Date(Date.now() - r.ms).toISOString(),
      to: undefined,
      limit: range === "1h" ? 400 : range === "6h" ? 800 : range === "24h" ? 1500 : range === "7d" ? 2500 : 3000,
    };
  }, [range, customFrom, customTo]);

  const { data: telData, isLoading } = useMonitorDeviceTelemetryHistory(device?.id ?? null, params);
  const { data: alerts } = useMonitorDeviceAlerts(device?.id ?? null);
  const telemetry = telData?.telemetry || [];

  // Último registro (el backend devuelve DESC, [0] es el más reciente)
  const latest = telemetry[0] || null;
  const obj = latest?.object || {};
  const rx = parseRx(latest);
  const bestGw = rx?.[0] || null;

  const current = {
    battery: voltageToPercent(obj.voltage_mV),
    batteryVolt: obj.voltage_mV != null ? (Number(obj.voltage_mV) / 1000).toFixed(2) : null,
    temp: obj.temperature_C != null ? Number(obj.temperature_C) : null,
    rssi: bestGw?.rssi != null ? Number(bestGw.rssi) : null,
    snr: bestGw?.snr != null ? Number(bestGw.snr) : null,
    gateways: rx.length,
  };

  // Modo de operación del sensor (producción, transporte, mantenimiento, etc.)
  // viene calculado por el backend (última telemetría + gps_device)
  const opMode = device?.operating_mode;
  const modeMeta = opMode && opMode !== "sin datos" ? MODE_LABELS[opMode] : null;

  // Datos del gráfico (orden cronológico)
  const chartData = useMemo(() => {
    const sorted = [...telemetry].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return sorted.map(t => {
      const o = t.object || {};
      const row: Record<string, any> = {
        time: new Date(t.ts).getTime(),
        battery: voltageToPercent(o.voltage_mV),
        temp: o.temperature_C != null ? Number(o.temperature_C) : null,
      };
      parseRx(t).forEach((gw: any) => {
        const name = String(gw.name || gw.gateway_id || "GW");
        if (gw.rssi != null) row[`rssi_${name}`] = Number(gw.rssi);
        if (gw.snr != null) row[`snr_${name}`] = Number(gw.snr);
      });
      return row;
    });
  }, [telemetry]);

  // Series presentes en los datos
  const seriesKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    chartData.forEach(r => Object.keys(r).forEach(k => {
      if (k !== "time" && !seen.has(k)) { seen.add(k); keys.push(k); }
    }));
    return keys;
  }, [chartData]);

  // Color por gateway + colores fijos (paleta alineada con la página:
  // amarillo atención, rojo crítica, morado movimientos, naranja desconexión, etc.)
  const gatewayColors = useMemo(() => {
    const map: Record<string, string> = {};
    const palette = ["#fde047", "#ef4444", "#a855f7", "#f97316", "#2dd4bf", "#34d399", "#60a5fa", "#f472b6"];
    let i = 0;
    seriesKeys.forEach(k => {
      const m = k.match(/^(?:rssi|snr)_(.+)$/);
      if (m && !map[m[1]]) { map[m[1]] = palette[i % palette.length]; i++; }
    });
    return map;
  }, [seriesKeys]);

  const seriesColor = (key: string) => {
    if (key === "battery") return "#4ade80";
    if (key === "temp") return "#fb923c";
    const m = key.match(/^(?:rssi|snr)_(.+)$/);
    return m ? (gatewayColors[m[1]] || "#94a3b8") : "#94a3b8";
  };
  const seriesLabel = (key: string) => {
    if (key === "battery") return "Batería";
    if (key === "temp") return "Temp";
    const m = key.match(/^(rssi|snr)_(.+)$/);
    return m ? `${m[1].toUpperCase()} ${m[2]}` : key;
  };
  const seriesAxis = (key: string) => (key === "battery" || key === "temp" ? "left" : "right");

  const toggleSeries = (key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const formatValue = (key: string, v: any) => {
    if (v == null) return "—";
    if (key === "battery") return `${v}%`;
    if (key === "temp") return `${v}°C`;
    if (key.startsWith("rssi_")) return `${v} dBm`;
    if (key.startsWith("snr_")) return `${v} dB`;
    return String(v);
  };

  const tickFormat = (v: number) => format(new Date(v), range === "1h" || range === "6h" || range === "24h" ? "HH:mm" : "dd/MM HH:mm");

  return (
    <div className="absolute bottom-0 left-0 right-0 z-600 h-1/3 min-h-55 bg-bg-100 backdrop-blur-md border-t border-gray-800/30 flex flex-col shadow-[0_-12px_32px_rgba(0,0,0,0.7)]">
      {/* ── Cabecera: nombre + selectores de tiempo ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${device?.is_active ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-sm font-bold text-white truncate">{device?.name}</span>
          <span className="text-[10px] text-gray-400 font-mono truncate">{device?.dev_eui}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 uppercase">{device?.type_device}</span>
          {modeMeta ? (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${modeMeta.className}`}>
              {modeMeta.label}
            </span>
          ) : opMode && opMode !== "sin datos" ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 uppercase">{opMode}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                range === r.key ? "bg-red-500/20 text-text-100 border border-red-500/40" : "text-gray-400 hover:text-gray-200 bg-gray-800/60 border border-transparent"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-gray-800 text-[10px] text-gray-200 rounded px-2 py-1 border border-gray-700 outline-none" />
            <span className="text-[10px] text-gray-500">→</span>
            <input type="datetime-local" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-gray-800 text-[10px] text-gray-200 rounded px-2 py-1 border border-gray-700 outline-none" />
          </div>
        )}
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <IconX size={16} />
        </button>
      </div>

      {/* ── Info actual del sensor (parte superior) ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-4 py-2 border-b border-gray-800/60">
        <Stat icon={<IconBattery size={13} />} label="Batería" value={current.battery != null ? `${current.batteryVolt}V · ${current.battery}%` : "—"} color={batteryColor(obj.voltage_mV)} />
        <Stat icon={<IconTemperature size={13} />} label="Temp" value={current.temp != null ? `${current.temp.toFixed(1)}°C` : "—"} />
        <Stat icon={<IconRss size={13} />} label="RSSI" value={current.rssi != null ? `${current.rssi.toFixed(0)} dBm` : "—"} color={rssiTextColor(current.rssi)} />
        <Stat icon={<IconRadar size={13} />} label="SNR" value={current.snr != null ? `${current.snr.toFixed(0)} dB` : "—"} color={snrTextColor(current.snr)} />
        <Stat icon={<IconAntenna size={13} />} label="Gateways" value={String(current.gateways)} />
        <Stat icon={<IconClock size={13} />} label="Últ. Tx" value={device?.last_seen ? format(new Date(device.last_seen), "dd/MM HH:mm") : "—"} />
      </div>

      {/* ── Cuerpo: 5/6 gráfico + 1/6 alertas ── */}
      <div className="flex-1 min-h-0 flex">
        {/* Gráfico histórico */}
        <div className="w-5/6 min-h-0 flex flex-col p-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {seriesKeys.map(k => (
              <button key={k} onClick={() => toggleSeries(k)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors shrink-0"
                style={{
                  color: hidden.has(k) ? "#475569" : seriesColor(k),
                  background: hidden.has(k) ? "transparent" : "rgba(255,255,255,0.04)",
                  textDecoration: hidden.has(k) ? "line-through" : "none",
                }}>
                <span className="w-2 h-2 rounded-full" style={{ background: seriesColor(k), opacity: hidden.has(k) ? 0.3 : 1 }} />
                {seriesLabel(k)}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-xs">Cargando telemetría…</div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-xs">Sin datos en el período seleccionado</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]}
                    tickFormatter={tickFormat} stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} minTickGap={40} />
                  <YAxis yAxisId="left" stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} width={34} domain={[0, 110]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} width={34} domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(v: any) => format(new Date(Number(v)), "dd/MM/yyyy HH:mm")}
                    formatter={(value: any, name: any) => [formatValue(String(name), value), seriesLabel(String(name))]}
                  />
                  {seriesKeys.filter(k => !hidden.has(k)).map(k => (
                    <Line key={k} yAxisId={seriesAxis(k)} type="monotone" dataKey={k}
                      stroke={seriesColor(k)} strokeWidth={1.5} dot={false} isAnimationActive={false}
                      strokeDasharray={k.startsWith("snr_") ? "4 3" : undefined} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Alertas del sensor (1/6) */}
        <div className="w-1/6 min-w-35 min-h-0 border-l border-gray-800 flex flex-col">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-800/60 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            <IconAlertTriangle size={12} />
            Alertas ({alerts?.length || 0})
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {(alerts || []).length === 0 && (
              <p className="text-[10px] text-gray-600 text-center mt-4">Sin alertas</p>
            )}
            {(alerts || []).slice(0, 60).map((a: any) => {
              const c = ALERT_COLORS[a.type] || { text: "#9ca3af", border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.02)", dot: "#6b7280" };
              const active = a.status === "active";
              return (
                <div key={a.id} className={`rounded px-2 py-1.5 text-[10px] border ${active ? "" : "border-gray-800 bg-gray-900/40"}`}
                  style={active ? { borderColor: c.border, background: c.bg } : undefined}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold flex items-center gap-1" style={{ color: active ? c.text : "#6b7280" }}>
                      {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />}
                      {ALERT_LABELS[a.type] || a.type}
                    </span>
                    <span className="text-[8px] text-gray-500">{format(new Date(a.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <span className="text-[8px] text-gray-500 uppercase">{active ? "Activa" : "Resuelta"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color = "text-gray-200" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-gray-500 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-[11px] font-semibold font-mono truncate ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function rssiTextColor(rssi: number | null): string {
  if (rssi == null) return "text-gray-200";
  if (rssi >= -100) return "text-green-400";
  if (rssi >= -118) return "text-yellow-400";
  return "text-red-400";
}
function snrTextColor(snr: number | null): string {
  if (snr == null) return "text-gray-200";
  if (snr >= 10) return "text-green-400";
  if (snr >= 5) return "text-yellow-400";
  return "text-red-400";
}
