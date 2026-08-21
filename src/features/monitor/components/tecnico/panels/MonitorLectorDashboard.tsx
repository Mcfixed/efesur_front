import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDeviceTelemetry } from "../../../hooks/useMonitor";
import { cleanVoltage, cleanCurrent, cleanPower, cleanState, cleanTemp } from "../../../utils/mppt";

// ═══════════════════════════════════════════
// DOWN-SAMPLING LTTB (Largest-Triangle-Three-Buckets)
// Reduce miles de puntos a ~threshold preservando la forma de la serie.
// ═══════════════════════════════════════════
function downsampleLTTB(points: { x: number; y: number }[], threshold: number): { x: number; y: number }[] {
  const n = points.length;
  if (threshold >= n || threshold <= 2) return points;
  const sampled: { x: number; y: number }[] = [];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  let rangeStart = 0, rangeEnd = 0;
  sampled.push(points[0]); // siempre el primero
  for (let i = 0; i < threshold - 2; i++) {
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    if (avgRangeEnd > n) avgRangeEnd = n;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    let avgX = 0, avgY = 0;
    for (let k = avgRangeStart; k < avgRangeEnd; k++) { avgX += points[k].x; avgY += points[k].y; }
    avgX /= avgRangeLength; avgY /= avgRangeLength;
    rangeStart = rangeEnd;
    rangeEnd = Math.floor((i + 1) * every) + 1;
    const ax = points[a].x, ay = points[a].y;
    let maxArea = -1;
    for (let k = rangeStart; k < rangeEnd; k++) {
      const area = Math.abs((ax - avgX) * (points[k].y - ay) - (ax - points[k].x) * (avgY - ay));
      if (area > maxArea) { maxArea = area; a = k; }
    }
    sampled.push(points[a]);
  }
  sampled.push(points[n - 1]); // siempre el último
  return sampled;
}

// Variables numéricas del histórico disponibles para graficar
const CHART_VARS = [
  { key: "vBat", label: "Batería", unit: "V", color: "#22c55e" },
  { key: "iBat", label: "Corriente", unit: "A", color: "#f97316" },
  { key: "pPan", label: "Panel", unit: "W", color: "#eab308" },
  { key: "pvVolt", label: "Panel V", unit: "V", color: "#facc15" },
  { key: "loadA", label: "Carga A", unit: "A", color: "#ef4444" },
  { key: "temp", label: "Temp MPPT", unit: "°C", color: "#a855f7" },
  { key: "yieldToday", label: "Yield hoy", unit: "kWh", color: "#14b8a6" },
  { key: "chargerVolt", label: "Chg 220 V", unit: "V", color: "#3b82f6" },
  { key: "chargerAmp", label: "Chg 220 A", unit: "A", color: "#ec4899" },
  { key: "ambTemp", label: "T° ambiente", unit: "°C", color: "#0ea5e9" },
  { key: "humidity", label: "Humedad", unit: "%", color: "#06b6d4" },
  { key: "pressure", label: "Presión", unit: "Pa", color: "#8b5cf6" },
  { key: "ramFree", label: "RAM libre", unit: "bytes", color: "#64748b" },
];

// ═══════════════════════════════════════════
// Sin mock data — todo desde telemetría real
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// SPARKLINE CHART
// ═══════════════════════════════════════════
function SparklineChart({ data, dataKey, color, title, unit }: { data: any[], dataKey: string, color: string, title: string, unit: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const values = data.map(d => d[dataKey]).filter(v => v != null);
  const min = Math.min(...values, 0) * 0.9;
  const max = Math.max(...values, 10) * 1.1;
  const CHART_W = 260, CHART_H = 68, PAD = { top: 6, right: 6, bottom: 14, left: 32 };
  const PLOT_W = CHART_W - PAD.left - PAD.right;
  const PLOT_H = CHART_H - PAD.top - PAD.bottom;
  const points = values.length > 1 ? values.map((v, i) =>
    `${(PAD.left + (i / Math.max(values.length - 1, 1)) * PLOT_W).toFixed(1)},${(PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H).toFixed(1)}`
  ).join(' ') : '';
  const area = points ? `0,${CHART_H} ${points} ${CHART_W},${CHART_H}` : '';
  const ticks = [min, (min + max) / 2, max].map(v => ({
    v, y: (PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H).toFixed(1)
  }));
  const xLabels = data.length > 1
    ? [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(3 * data.length / 4), data.length - 1]
    : [0];
  const gradId = `grad-${dataKey}`;
  return (
    <div className="rounded-lg p-2.5 flex-1 flex flex-col justify-center bg-bg-100 border border-border/30 relative">
      <div className="flex justify-between items-center mb-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-text-300">{title}</p>
        <p className="text-[10px] font-mono font-bold" style={{ color }}>{values[values.length - 1]?.toFixed(2)} {unit}</p>
      </div>
      <div className="flex-1 flex items-center relative">
        <svg width="100%" height="80" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full">
          <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient></defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={t.y} x2={CHART_W - PAD.right} y2={t.y} stroke="#2a2a2a" strokeWidth="0.5" strokeDasharray="2 2" />
              <text x={PAD.left - 4} y={t.y} textAnchor="end" dominantBaseline="middle" fill="#666" fontSize="7">{t.v.toFixed(1)}</text>
            </g>
          ))}
          {xLabels.map((idx, i) => (
            <text key={i} x={PAD.left + (idx / Math.max(data.length - 1, 1)) * PLOT_W} y={CHART_H - 2} textAnchor="middle" fill="#666" fontSize="6">
              {data[idx]?.time || ''}
            </text>
          ))}
          {area && <polygon points={area} fill={`url(#${gradId})`} />}
          {points && <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />}
          {/* Hover targets */}
          {values.length > 1 && values.map((v, i) => {
            const cx = PAD.left + (i / Math.max(values.length - 1, 1)) * PLOT_W;
            const cy = PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H;
            return (
              <g key={i}>
                <rect x={cx - 6} y={0} width={12} height={CHART_H} fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)} />
                {hoverIdx === i && (
                  <g>
                    <line x1={cx} y1={0} x2={cx} y2={CHART_H} stroke={color} strokeWidth="0.8" opacity="0.4" />
                    <circle cx={cx} cy={cy} r="4" fill="#1e1e1e" stroke={color} strokeWidth="2" />
                    <rect x={cx - 30} y={cy > 30 ? cy - 22 : cy + 6} width="60" height="18" rx="3" fill="#1e1e1e" stroke="#444" strokeWidth="0.5" />
                    <text x={cx} y={cy > 30 ? cy - 10 : cy + 18} textAnchor="middle" fill="#e0e0e0" fontSize="7" fontFamily="monospace">
                      {data[i]?.time || ''} · {v.toFixed(2)} {unit}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// LECTOR DASHBOARD — Victron-style
// ═══════════════════════════════════════════
export default function MonitorLectorDashboard({ lectorDeviceId, showHeader = true, gatewayLastSeen, gatewayName: gatewayNameProp }: { lectorDeviceId?: number | null; showHeader?: boolean; gatewayLastSeen?: string | null; gatewayName?: string | null }) {
  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);

  const lectores = useMemo(() => {
    if (!allDevices) return [];
    // Sin lector asignado (id null) → no mostrar ningún lector por defecto
    if (lectorDeviceId === null) return [];
    let list = allDevices.filter((d: any) => d.type_device === 'Lector');
    if (lectorDeviceId) {
      const specific = list.find((d: any) => d.id === lectorDeviceId);
      if (specific) return [specific];
      return [];
    }
    return list;
  }, [allDevices, lectorDeviceId]);

  // ID del lector activo para el histórico
  const lectorId = useMemo(() => {
    return lectores[0]?.id ?? lectorDeviceId ?? null;
  }, [lectores, lectorDeviceId]);

  // Gateway asociado al lector: prioridad a la prop pasada (vista desde el panel del gateway);
  // si no, se busca por convención (el Gateway tiene id_device_father apuntando a su Lector)
  const gatewayName = useMemo(() => {
    if (gatewayNameProp) return gatewayNameProp;
    if (!allDevices || !lectorId) return null;
    const gw = allDevices.find((d: any) => d.type_device === 'Gateway' && d.id_device_father === lectorId);
    return gw?.name || null;
  }, [allDevices, lectorId, gatewayNameProp]);

  // Histórico del lector (paginado — "Cargar más" carga más registros)
  const PAGE_SIZE = 10000;
  const [historyOffset, setHistoryOffset] = useState(0);
  const { data: historyData } = useMonitorDeviceTelemetry(lectorId, { limit: PAGE_SIZE, offset: historyOffset });
  const historyHasMore = (historyData?.telemetry?.length ?? 0) === PAGE_SIZE;
  useEffect(() => { setHistoryOffset(0); }, [lectorId]);

  const historyRows = useMemo(() => {
    const telemetry = historyData?.telemetry || [];
    return telemetry.map((t: any) => {
      const obj = t.object || {};
      const mppt = obj.Mppt || {};
      const sec = obj.Security || {};
      const blue = obj.BlueSmartIP67 || {};
      const env = obj.Environment || {};
      const health = obj.Esp32Health || {};
      return {
        ts: t.ts,
        vBat: cleanVoltage(mppt.batteryVoltage_V) ?? cleanVoltage(blue.voltaje_V) ?? null,
        iBat: cleanCurrent(mppt.batteryCurrent_A) ?? null,
        pPan: cleanPower(mppt.panelPower_W) ?? null,
        pvVolt: cleanVoltage(mppt.panelVoltage_V) ?? null,
        loadA: cleanCurrent(mppt.loadCurrent_A) ?? null,
        loadState: cleanState(mppt.loadState) ?? null,
        temp: cleanTemp(mppt.internalTemp_C) ?? null,
        chargeState: cleanState(mppt.chargeState) ?? null,
        yieldToday: cleanVoltage(mppt.yieldToday_kWh) ?? null,
        maxPowerToday: cleanPower(mppt.maxPowerToday_W) ?? null,
        door: sec.doorState ?? null,
        doorCounter: sec.doorCounter ?? null,
        pir: sec.pirState ?? null,
        chargerState: blue.estado ?? null,
        chargerVolt: cleanVoltage(blue.voltaje_V) ?? null,
        chargerAmp: cleanCurrent(blue.corriente_A) ?? null,
        ambTemp: cleanTemp(env.temperatura_C) ?? null,
        humidity: env.humedad_pct ?? null,
        pressure: env.presion_Pa ?? null,
        ramFree: health.ramLibre_bytes ?? null,
        resetReason: health.resetReasonText ?? null,
      };
    });
  }, [historyData]);

  // ── Gráfico del histórico: variable seleccionada + downsampling LTTB ──
  const [histTab, setHistTab] = useState<"datos" | "grafico">("datos");
  const [chartVar, setChartVar] = useState("vBat");
  const chartVarDef = CHART_VARS.find(v => v.key === chartVar) ?? CHART_VARS[0];
  const chartPoints = useMemo(() => {
    const pts = historyRows
      .map((r: any) => ({ x: new Date(r.ts).getTime(), y: r[chartVar] }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    const sampled = pts.length > 600 ? downsampleLTTB(pts, 500) : pts;
    return sampled.map((p) => ({ time: format(new Date(p.x), "dd/MM HH:mm"), value: p.y }));
  }, [historyRows, chartVar]);

  // Extraer datos de telemetría del primer lector
  const dashboardData = useMemo(() => {
    if (!lectores.length) {
      return { tel: [], mpttTel: [], chartData: [], lector: { name: 'Sin lector asignado', dev_eui: '—' }, lastT: null, sensores: {}, charger220: {}, vBat: null, pPan: null, iBat: null, iOut: null, loadState: null, chargeState: null, pvVolt: null, charging: false, charger220State: null, charger220Volt: null, temp: null };
    }
    if (!latestTelemetry) return null;
    const lector = lectores[0];
    const tel = (latestTelemetry || []).filter((t: any) =>
      t.dev_eui?.toLowerCase() === lector.dev_eui.toLowerCase() || t.device_id === lector.id
    );
    console.log('[LectorDash] lectores:', lectores.length, 'tel:', tel.length, 'lector:', lector.name, lector.dev_eui, lector.id, 'sampleTel:', latestTelemetry?.[0]?.device_id, latestTelemetry?.[0]?.dev_eui);
    if (!tel.length) return { tel: [], mpttTel: [], chartData: [], lector, lastT: null, sensores: {}, charger220: {}, vBat: null, pPan: null, iBat: null, iOut: null, loadState: null, chargeState: null, charging: false, charger220State: null, charger220Volt: null, temp: null };
    const lastT = tel.find((t: any) => t.object?.Mppt) || tel[0] || null;
    const obj = lastT?.object || {};
    const mppt = obj.Mppt || {};
    const security = obj.Security || {};
    const blueSmart = obj.BlueSmartIP67 || {};
    const mpttTel = tel.filter((t: any) => t.object?.Mppt).sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const cd = mpttTel.slice(-120).map((t: any) => ({
      time: format(new Date(t.ts), "HH:mm"),
      volt: cleanVoltage(t.object?.Mppt?.batteryVoltage_V) ?? null,
      power: cleanPower(t.object?.Mppt?.panelPower_W) ?? null,
      current: cleanCurrent(t.object?.Mppt?.batteryCurrent_A) ?? null,
    }));
    return {
      tel, mpttTel, chartData: cd, lector, lastT,
      sensores: security,
      charger220: blueSmart,
      vBat: cleanVoltage(mppt.batteryVoltage_V) ?? cleanVoltage(blueSmart.voltaje_V) ?? null,
      pPan: cleanPower(mppt.panelPower_W) ?? null,
      iBat: cleanCurrent(mppt.batteryCurrent_A) ?? null,
      iOut: cleanCurrent(mppt.loadCurrent_A) ?? null,
      loadState: cleanState(mppt.loadState) ?? null,
      chargeState: cleanState(mppt.chargeState) ?? null,
      pvVolt: cleanVoltage(mppt.panelVoltage_V) ?? null,
      charging: cleanState(mppt.loadState) === 1,
      charger220State: blueSmart.estado || null,
      charger220Volt: cleanVoltage(blueSmart.voltaje_V) ?? null,
      temp: cleanTemp(mppt.internalTemp_C) ?? cleanTemp(obj.Environment?.temperatura_C) ?? null,
    };
  }, [lectores, latestTelemetry]);

  if (!allDevices || !latestTelemetry) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-300 text-[13px] min-h-50">
        <div className="w-5 h-5 border-2 border-text-300 border-t-transparent rounded-full animate-spin mr-2" />
        Cargando datos del lector...
      </div>
    );
  }

  if (!dashboardData) return null;

  const hasLector = lectores.length > 0;
  const { chartData, lector, lastT, sensores, charger220, vBat, pPan, iBat, iOut, loadState, chargeState, pvVolt, charging, charger220State, charger220Volt, temp } = dashboardData;

  // ── Export a Excel del histórico ──
  const exportExcel = () => {
    if (!historyRows.length) return;
    const rows = historyRows.map((r: any) => ({
      "Fecha": r.ts ? format(new Date(r.ts), "dd/MM/yyyy HH:mm:ss") : "",
      "Batería (V)": r.vBat, "Corriente (A)": r.iBat, "Panel (W)": r.pPan, "Panel V (V)": r.pvVolt,
      "Carga (A)": r.loadA, "Load": r.loadState, "Temp MPPT (°C)": r.temp, "Carga": r.chargeState,
      "Yield hoy (kWh)": r.yieldToday, "Puerta": r.door, "Aperturas": r.doorCounter, "Prox": r.pir,
      "Chg 220": r.chargerState, "Chg V (V)": r.chargerVolt, "Chg A (A)": r.chargerAmp,
      "T° amb (°C)": r.ambTemp, "Humedad (%)": r.humidity, "Presión (Pa)": r.pressure,
      "RAM libre (bytes)": r.ramFree,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, ...Array(19).fill({ wch: 13 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico lector");
    const name = (lector?.name || "lector").replace(/[^\w\-]+/g, "_");
    XLSX.writeFile(wb, `historial_lector_${name}.xlsx`);
  };

  // Estado online del lector: diferencia absoluta <= 5 min (tolera reloj adelantado/atrasado y NaN)
  const lastTsMs = lastT?.ts ? new Date(lastT.ts).getTime() : NaN;
  const isLectorOnline = Number.isFinite(lastTsMs) && Math.abs(Date.now() - lastTsMs) < 300000;

  // Estado real del gateway asociado (si se pasa): usa gatewayLastSeen; si no, cae al lector
  const gwTsMs = gatewayLastSeen ? new Date(gatewayLastSeen).getTime() : NaN;
  const isGatewayOnline = gatewayLastSeen
    ? (Number.isFinite(gwTsMs) && Math.abs(Date.now() - gwTsMs) < 300000)
    : isLectorOnline;

  const batPct = vBat != null ? Math.max(0, Math.min(100, ((vBat - 11) / (15 - 11)) * 100)) : null;
  const batColor = vBat != null ? (vBat >= 12.5 ? '#22c55e' : vBat >= 11.8 ? '#f97316' : '#ef4444') : '#6b7280';

  // chargeState: 0=Inicio, 64=Absorción, 128=Flotación, 255=Completo/Inactivo
  const CHARGE_STATE_MAP: Record<number, { label: string; color: string }> = {
    0: { label: 'Carga inicial', color: '#f97316' },
    64: { label: 'Absorción', color: '#22c55e' },
    128: { label: 'Flotación', color: '#3b82f6' },
    255: { label: 'Completo', color: '#6b7280' },
  };
  const chargeMeta = chargeState != null
    ? (CHARGE_STATE_MAP[chargeState] || { label: `Estado ${chargeState}`, color: '#6b7280' })
    : { label: '—', color: '#6b7280' };

  return (
    <div className={`flex-1 min-h-0 flex flex-col gap-2 p-2 bg-bg-200 rounded-md transition-all ${hasLector ? '' : 'opacity-40 grayscale'}`}>
      <style>{`@keyframes flowLine{to{stroke-dashoffset:-24}}@keyframes flowBack{to{stroke-dashoffset:24}}@keyframes pulseLive{0%{transform:scale(1)}50%{transform:scale(2)}100%{transform:scale(1)}}`}</style>

      {/* HEADER (opcional — en la vista directa el MonitorDeviceDetailHeader ya lo muestra) */}
      {showHeader && (
      <div className="rounded-lg px-4 py-2.5 flex items-center justify-between bg-bg-100 border border-border/30">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${hasLector ? 'bg-[#00a3e8]/10 border-[#00a3e8]/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className={`w-2 h-2 rounded-full ${hasLector ? 'bg-[#00a3e8] shadow-[0_0_8px_#00a3e8]' : 'bg-red-400'}`} />
          </div>
          <div>
            <p className={`${hasLector ? 'text-[13px] font-medium text-text-100' : 'text-2xl font-bold text-red-400'} tracking-wide`}>{lector.name}</p>
            {hasLector && <p className="text-[10px] text-text-300 font-mono">{lector.dev_eui} · {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}</p>}
          </div>
        </div>
        {hasLector ? (
          isLectorOnline ? (
            <div className="flex items-center gap-2">
              {charging && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />}
              <span className="text-[10px] font-bold tracking-wider" style={{ color: charging ? '#22c55e' : '#6b7280' }}>
                {charging ? `CHARGING (${chargeMeta.label.toUpperCase()})` : 'SYSTEM IDLE'}
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Lector offline
            </span>
          )
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-1 rounded">Sin lector asignado</span>
        )}
      </div>
      )}

      {/* MAIN GRID (gris si el lector está offline) */}
      <div className={`grid grid-cols-12 gap-2 flex-1 min-h-0 transition-all ${isLectorOnline ? '' : 'opacity-40 grayscale'}`}>
        {/* LEFT COLUMN */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          <div className="rounded-lg p-4 flex-1 flex flex-col justify-center bg-bg-100 border border-border/30">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-300 mb-4">Batería Principal</p>
            <div className="flex flex-col items-center gap-4 justify-center">
              <svg width="80" height="80" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="32" fill="none" stroke="#333" strokeWidth="4" />
                <circle cx="36" cy="36" r="32" fill="none" stroke={batColor} strokeWidth="4"
                  strokeDasharray={`${((batPct ?? 0) / 100) * 201} 201`} strokeLinecap="round" transform="rotate(-90 36 36)" 
                  style={{ filter: `drop-shadow(0 0 4px ${batColor}80)` }} />
                <text x="36" y="32" textAnchor="middle" fill="#e0e0e0" fontSize="16" fontFamily="monospace" fontWeight="bold">{batPct != null ? `${Math.round(batPct)}%` : '—'}</text>
                <text x="36" y="46" textAnchor="middle" fill="#888" fontSize="9">SOC</text>
              </svg>
              <div className="w-full bg-bg-200/50 rounded-lg p-2 border border-border/20 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[8px] text-text-300 mb-0.5">ESTADO</p>
                  <p className="text-[11px] font-bold" style={{ color: chargeMeta.color }}>{chargeMeta.label}</p>
                </div>
                <div>
                  <p className="text-[8px] text-text-300 mb-0.5">VOLTAJE</p>
                  <p className="text-[11px] font-bold text-text-100 font-mono">{vBat != null ? `${vBat.toFixed(2)} V` : '—'}</p>
                </div>
              </div>
            </div>
          </div>
          <SparklineChart data={chartData} dataKey="volt" color="#00a3e8" title="Historial Voltaje" unit="V" />
        </div>

        {/* CENTER COLUMN: ENERGY FLOW */}
        <div className="col-span-6 flex flex-col min-h-0">
          <div className="rounded-lg p-1 flex-1 flex flex-col relative overflow-hidden bg-bg-100 border border-border/30">
            <p className="absolute top-3 right-4 text-[9px] font-bold uppercase tracking-widest text-text-500 z-10">Esquema</p>
            {/* Live indicator HTML — sobre el SVG */}
            <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5">
              <span className="relative flex items-center justify-center w-4 h-4">
                <span className="absolute inset-0 rounded-full" style={{
                  background: isLectorOnline ? '#22c55e' : '#ef4444',
                  opacity: 0.25, animation: 'pulseLive 2s infinite'
                }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{
                  background: isLectorOnline ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 8px ${isLectorOnline ? '#22c55e' : '#ef4444'}`
                }} />
              </span>
              <span className="text-[10px] font-bold tracking-wider" style={{
                color: isLectorOnline ? '#22c55e' : '#ef4444'
              }}>LIVE</span>
              <span className="text-[8px] font-mono text-text-200 ml-1">
                {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}
              </span>
            </div>
            <div className="flex-1 w-full h-full flex items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* FLOW LINES */}
                <path d="M 100 120 L 170 120" stroke="#333" strokeWidth="4" fill="none" />
                {pPan != null && pPan > 0 && (
                  <path d="M 100 120 L 170 120" stroke="#eab308" strokeWidth="2.5" fill="none" strokeDasharray="8 6"
                    style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />
                )}
                <path d="M 250 120 L 330 120" stroke="#333" strokeWidth="4" fill="none" />
                {charging && (
                  <path d="M 250 120 L 330 120" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeDasharray="8 6"
                    style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />
                )}
                <path d="M 330 128 L 250 128" stroke="#22c55e" strokeWidth="1.2" fill="none" strokeDasharray="5 5" opacity="0.4"
                  style={{ animation: 'flowLine 2s linear infinite', strokeDashoffset: 0 }} />
                <path d="M 210 90 L 210 42" stroke="#333" strokeWidth="4" fill="none" />
                <path d="M 210 90 L 210 42" stroke="#00a3e8" strokeWidth="2.5" fill="none" strokeDasharray="8 6"
                  style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />
                <path d="M 490 120 L 410 120" stroke="#3b82f6" strokeWidth="3" fill="none" opacity="0.4" />
                <path d="M 490 122 L 410 122" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="8 6" opacity="0.8"
                  style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />

                {/* Temperature — top-right corner */}
                <g transform="translate(475, 6)">
                  <rect x="0" y="0" width="52" height="22" rx="5" fill="#1e1e1e" fillOpacity="0.85" stroke="#555" strokeWidth="0.8" />
                  <rect x="8" y="5" width="3" height="10" rx="1" fill="#ef4444" opacity="0.6" />
                  <rect x="9" y="4" width="3" height="11" rx="1.5" fill="none" stroke="#ef4444" strokeWidth="0.6" />
                  <circle cx="9.5" cy="15" r="2" fill="#ef4444" opacity="0.6" />
                  <text x="20" y="13" fill="#e0e0e0" fontSize="9" fontFamily="monospace" fontWeight="bold">{temp !== null ? `${temp.toFixed(1)}°` : '—'}</text>
                </g>

                {/* Nodes */}
                <g transform="translate(20, 95)">
                  <rect width="80" height="50" rx="6" fill="none" stroke={(pPan ?? 0) > 0 ? '#eab308' : '#555'} strokeWidth={(pPan ?? 0) > 0 ? 1.5 : 1} />
                  <rect x="4" y="4" width="72" height="42" rx="4" fill={(pPan ?? 0) > 0 ? '#eab308' : '#00a3e8'} opacity={(pPan ?? 0) > 0 ? 0.12 : 0.06} />
                  {(pPan ?? 0) > 0 && <circle cx="12" cy="11" r="3" fill="#eab308" filter="url(#glowYellow)" />}
                  <text x="40" y="22" textAnchor="middle" fill={(pPan ?? 0) > 0 ? '#eab308' : '#888'} fontSize="8" fontWeight="bold">SOLAR</text>
                  <text x="40" y="38" textAnchor="middle" fill="#e0e0e0" fontSize="12" fontFamily="monospace">{pPan != null ? `${pPan}W` : '—'}</text>
                </g>
                <g transform="translate(170, 90)">
                  <rect width="80" height="60" rx="8" fill="none" stroke={charging ? '#22c55e' : '#555'} strokeWidth={charging ? 1.5 : 1} />
                  <circle cx="12" cy="12" r="3" fill="#00a3e8" filter="url(#glowBlue)" />
                  <text x="40" y="32" textAnchor="middle" fill="#e0e0e0" fontSize="10" fontWeight="bold">MPPT</text>
                  <text x="40" y="46" textAnchor="middle" fill="#888" fontSize="7">CONTROL</text>
                </g>
                <g transform="translate(330, 90)">
                  <rect width="80" height="60" rx="8" fill="none" stroke={batColor} strokeWidth="1" />
                  <rect x="74" y="20" width="4" height="20" rx="1" fill={batColor} />
                  <circle cx="40" cy="15" r="3" fill={batColor} filter="url(#glowGreen)" />
                  <text x="40" y="27" textAnchor="middle" fill="#e0e0e0" fontSize="10" fontWeight="bold">BATERÍA</text>
                  <text x="40" y="41" textAnchor="middle" fill={batColor} fontSize="9" fontFamily="monospace">{vBat != null ? `${vBat.toFixed(2)}V` : '—'}</text>
                  <text x="40" y="53" textAnchor="middle" fill={iBat != null ? (iBat > 0 ? '#22c55e' : '#f97316') : '#888'} fontSize="8" fontFamily="monospace">
                    {iBat != null ? `${iBat > 0 ? '+' : ''}${iBat.toFixed(2)}A` : '—'}
                  </text>
                </g>
                <g transform="translate(170, 15)">
                  <rect width="80" height="30" rx="6" fill="none" stroke={isGatewayOnline ? '#22c55e' : '#ef4444'} strokeWidth={isGatewayOnline ? 1.2 : 1} />
                  <line x1="30" y1="0" x2="30" y2="-10" stroke="#666" strokeWidth="2" />
                  <line x1="50" y1="0" x2="50" y2="-10" stroke="#666" strokeWidth="2" />
                  <circle cx="12" cy="15" r="3" fill={isGatewayOnline ? '#22c55e' : '#ef4444'} filter={isGatewayOnline ? 'url(#glowGreen)' : undefined} />
                  <text x="40" y="20" textAnchor="middle" fill="#aaa" fontSize="8" fontWeight="bold">
                    {gatewayName || 'GATEWAY'}
                  </text>
                </g>
                <g transform="translate(490, 90)">
                  <rect width="80" height="60" rx="8" fill="none" stroke="#3b82f6" strokeWidth="1" />
                  <circle cx="12" cy="15" r="3" fill="#3b82f6" filter="url(#glowBlue)" />
                  <text x="40" y="28" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">AC IN</text>
                  <text x="40" y="44" textAnchor="middle" fill="#aaa" fontSize="8">CHARGER</text>
                </g>

                {/* Status labels */}
                <circle cx="60" cy="178" r="3" fill={charging ? '#22c55e' : '#6b7280'} />
                <text x="67" y="181" fill={charging ? '#22c55e' : '#6b7280'} fontSize="7" fontWeight="bold">
                  {charging ? 'CARGANDO' : (pPan ?? 0) > 0 ? 'ACTIVO' : 'INACTIVO'}
                </text>
                <circle cx="210" cy="178" r="3" fill={isGatewayOnline ? '#22c55e' : '#ef4444'} />
                <text x="217" y="181" fill={isGatewayOnline ? '#22c55e' : '#ef4444'} fontSize="7" fontWeight="bold">
                  {isGatewayOnline ? 'GW ONLINE' : 'GW OFFLINE'}
                </text>
                <circle cx="530" cy="178" r="3" fill="#3b82f6" />
                <text x="537" y="181" fill="#3b82f6" fontSize="7" fontWeight="bold">
                  CA {charger220Volt != null ? `${charger220Volt.toFixed(0)}V` : '—'} · {charger220State || '—'}
                </text>
              </svg>
            </div>
            {/* Timeline */}
            <div className="shrink-0 px-3 pb-2 pt-0.5">
              <div className="flex items-center gap-0.5 h-4 rounded overflow-hidden">
                <div className="h-full bg-gray-500/20" style={{ width: '15%' }} title="Madrugada - Inactivo" />
                <div className="h-full bg-orange-500/25" style={{ width: '25%' }} title="Mañana - Carga inicial (Bulk)" />
                <div className="h-full bg-green-500/25" style={{ width: '40%' }} title="Mediodía - Absorción" />
                <div className="h-full bg-blue-500/20" style={{ width: '20%' }} title="Tarde/Noche - Flotación" />
              </div>
              <div className="flex justify-between text-[6px] text-text-500 mt-0.5">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
              </div>
              <div className="flex justify-between text-[7px] text-text-400 mt-0.5">
                <span style={{ color: '#6b7280' }}>Inactivo</span>
                <span style={{ color: '#f97316' }}>Carga inicial</span>
                <span style={{ color: '#22c55e' }}>Absorción</span>
                <span style={{ color: '#3b82f6' }}>Flotación</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          <div className="rounded-lg p-4 flex-1 flex flex-col justify-center bg-bg-100 border border-border/30">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-300 mb-3">SENSORES GABINETE</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded bg-bg-200/50 border border-border/20">
                <span className="text-[10px] text-text-200">Sensor Puerta gabinete</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sensores.doorState === 1 ? '#ef4444' : '#22c55e' }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: sensores.doorState === 1 ? '#ef4444' : '#22c55e' }}>{sensores.doorState === 1 ? 'OPEN' : 'CLOSED'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-bg-200/50 border border-border/20">
                <span className="text-[10px] text-text-200">Proximidad</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sensores.pirState === 1 ? '#eab308' : '#6b7280' }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: sensores.pirState === 1 ? '#eab308' : '#6b7280' }}>{sensores.pirState === 1 ? 'DETECTED' : 'CLEAR'}</span>
                </div>
              </div>
            </div>
          </div>
          <SparklineChart data={chartData} dataKey="power" color="#eab308" title="Potencia Solar" unit="W" />
        </div>
      </div>

      {/* ─── Tabla de histórico ─── */}
      {hasLector && (
        <div className="rounded-lg bg-bg-100 border border-border/30 overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a3e8]" />
            <h3 className="text-[10px] font-semibold text-text-200 uppercase tracking-wider">Histórico del lector</h3>
            <span className="ml-auto text-[10px] text-text-300 font-mono">{historyRows.length} registros</span>
            <button onClick={exportExcel} title="Descargar histórico en Excel"
              className="px-2 py-0.5 rounded text-[9px] font-semibold text-green-400 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors">
              ⬇ Excel
            </button>
          </div>
          {/* Tabs: Datos | Gráfico */}
          <div className="shrink-0 flex border-b border-border/20">
            <button onClick={() => setHistTab("datos")}
              className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${histTab === "datos" ? "text-[#00a3e8] border-b-2 border-[#00a3e8]" : "text-text-300 hover:text-text-200"}`}>
              Datos
            </button>
            <button onClick={() => setHistTab("grafico")}
              className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${histTab === "grafico" ? "text-[#00a3e8] border-b-2 border-[#00a3e8]" : "text-text-300 hover:text-text-200"}`}>
              Gráfico
            </button>
          </div>
          {histTab === "grafico" ? (
          <div className="shrink-0 px-3 pt-2.5 pb-2">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] font-semibold text-text-200 uppercase tracking-wider">Variable:</span>
              {CHART_VARS.map(v => (
                <button key={v.key} onClick={() => setChartVar(v.key)}
                  className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${chartVar === v.key ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "bg-bg-200/50 text-text-300 hover:text-text-200"}`}>
                  {v.label}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-text-300 font-mono">{historyRows.length} pts → {chartPoints.length} mostrados</span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints}>
                  <defs>
                    <linearGradient id="grado-lector" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartVarDef.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartVarDef.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#ffffff20" }} minTickGap={50} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={46} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#ccc" }} />
                  <Area type="monotone" dataKey="value" stroke={chartVarDef.color} strokeWidth={1.8} fill="url(#grado-lector)" dot={false} name={`${chartVarDef.label} (${chartVarDef.unit})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          ) : (
          <>
          <div className="overflow-auto max-h-56">
            <table className="w-full text-[11px]" style={{ minWidth: 1100 }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-1.5 px-2 font-medium">Fecha</th>
                  <th className="text-right py-1.5 px-2 font-medium">Batería</th>
                  <th className="text-right py-1.5 px-2 font-medium">Corriente</th>
                  <th className="text-right py-1.5 px-2 font-medium">Panel</th>
                  <th className="text-right py-1.5 px-2 font-medium">Panel V</th>
                  <th className="text-right py-1.5 px-2 font-medium">Carga A</th>
                  <th className="text-center py-1.5 px-2 font-medium">Load</th>
                  <th className="text-right py-1.5 px-2 font-medium">Temp</th>
                  <th className="text-center py-1.5 px-2 font-medium">Carga</th>
                  <th className="text-right py-1.5 px-2 font-medium">Yield hoy</th>
                  <th className="text-center py-1.5 px-2 font-medium">Puerta</th>
                  <th className="text-center py-1.5 px-2 font-medium">Aperturas</th>
                  <th className="text-center py-1.5 px-2 font-medium">Prox</th>
                  <th className="text-center py-1.5 px-2 font-medium">Chg 220</th>
                  <th className="text-right py-1.5 px-2 font-medium">Chg V</th>
                  <th className="text-right py-1.5 px-2 font-medium">Chg A</th>
                  <th className="text-right py-1.5 px-2 font-medium">T° amb</th>
                  <th className="text-right py-1.5 px-2 font-medium">Humedad</th>
                  <th className="text-right py-1.5 px-2 font-medium">Presión</th>
                  <th className="text-right py-1.5 px-2 font-medium">RAM libre</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-6 text-center text-text-300">Sin datos históricos</td>
                  </tr>
                ) : (
                  historyRows.map((r: any, i: number) => (
                    <tr key={r.ts || i} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} border-b border-border/20 hover:bg-bg-200/60 transition-colors`}>
                      <td className="py-1.5 px-2 text-text-300 font-mono text-[10px] whitespace-nowrap">
                        {r.ts ? format(new Date(r.ts), "dd/MM HH:mm:ss") : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.vBat != null ? `${r.vBat.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right font-mono" style={{ color: r.iBat != null ? (r.iBat > 0 ? '#22c55e' : '#f97316') : undefined }}>
                        {r.iBat != null ? `${r.iBat.toFixed(2)}A` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.pPan != null ? `${r.pPan.toFixed(0)}W` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.pvVolt != null ? `${r.pvVolt.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.loadA != null ? `${r.loadA.toFixed(2)}A` : "—"}</td>
                      <td className="py-1.5 px-2 text-center text-[10px]">
                        {r.loadState === 1
                          ? <span className="text-green-400 font-semibold">ON</span>
                          : r.loadState === 0
                            ? <span className="text-red-400 font-semibold">OFF</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.temp != null ? `${r.temp.toFixed(1)}°C` : "—"}</td>
                      <td className="py-1.5 px-2 text-center text-[10px]">
                        {r.chargeState != null
                          ? <span className="px-1.5 py-0.5 rounded bg-bg-300/40 text-text-200">{r.chargeState}</span>
                          : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.yieldToday != null ? `${r.yieldToday.toFixed(3)}kWh` : "—"}</td>
                      <td className="py-1.5 px-2 text-center">
                        {r.door === 1
                          ? <span className="text-red-400 font-semibold">OPEN</span>
                          : r.door === 0
                            ? <span className="text-green-400 font-semibold">CLOSED</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center text-text-100 font-mono">{r.doorCounter ?? "—"}</td>
                      <td className="py-1.5 px-2 text-center">
                        {r.pir === 1
                          ? <span className="text-yellow-400 font-semibold">DETECT</span>
                          : r.pir === 0
                            ? <span className="text-text-300 font-semibold">CLEAR</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center text-[10px] text-text-200">
                        {r.chargerState || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.chargerVolt != null ? `${r.chargerVolt.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.chargerAmp != null ? `${r.chargerAmp.toFixed(2)}A` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.ambTemp != null ? `${r.ambTemp.toFixed(1)}°C` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.humidity != null ? `${r.humidity.toFixed(0)}%` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 font-mono">{r.pressure != null ? `${(r.pressure / 1000).toFixed(1)}kPa` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-300 font-mono text-[10px]">
                        {r.ramFree != null ? `${(r.ramFree / 1024).toFixed(0)}KB` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {historyHasMore && (
            <div className="px-3 py-2 border-t border-border/20">
              <button
                onClick={() => setHistoryOffset(p => p + PAGE_SIZE)}
                className="w-full py-1.5 text-[11px] font-medium text-brand-100 bg-bg-200/50 rounded-md hover:bg-bg-200 border border-border/20 transition-colors"
              >
                + Cargar más
              </button>
            </div>
          )}
          </>)}
        </div>
      )}
    </div>
  );
}
