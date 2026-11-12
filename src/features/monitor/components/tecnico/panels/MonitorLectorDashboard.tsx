import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDeviceTelemetryHistory } from "../../../hooks/useMonitor";
import { monitorService } from "../../../services/monitor.service";
import { cleanVoltage, cleanCurrent, cleanPower, cleanState, cleanTemp } from "../../../utils/mppt";
import { IconX, IconLoader2, IconArrowLeft, IconHash, IconCheck } from "@tabler/icons-react";

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

// Presets de rango del histórico (ms = ventana hacia atrás desde ahora).
const HISTORY_RANGES = [
  { key: "24h", label: "24h", ms: 24 * 3600000, title: "Últimas 24 horas (por defecto)" },
  { key: "7d", label: "7d", ms: 7 * 24 * 3600000, title: "Últimos 7 días" },
  { key: "15d", label: "15d", ms: 15 * 24 * 3600000, title: "Últimos 15 días" },
  { key: "30d", label: "30d", ms: 30 * 24 * 3600000, title: "Últimos 30 días" },
];

// Puntos del gráfico: el backend los reparte sobre TODO el rango seleccionado.
const CHART_POINTS = 800;
// Puntos que se dibujan: LTTB reduce cualquier volumen a este máximo.
const CHART_DRAW_POINTS = 500;

const DEFAULT_HISTORY_PRESET = "24h";
const presetMs = (key: string) => HISTORY_RANGES.find(r => r.key === key)?.ms ?? 0;

// Fuera del componente: Date.now() no debe llamarse durante el render.
function presetWindowStart(ms: number): string | null {
  return ms > 0 ? new Date(Date.now() - ms).toISOString() : null;
}

// Copia de respaldo cuando navigator.clipboard no está disponible (contexto no seguro)
function fallbackCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* sin soporte */ }
  document.body.removeChild(ta);
}

// "hace 2 min" / "hace 3 h" a partir de una diferencia en ms
export function relTime(diffMs: number | null | undefined): string | null {  if (diffMs == null || !Number.isFinite(diffMs)) return null;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

// ═══════════════════════════════════════════
// LECTOR DASHBOARD — Victron-style
// ═══════════════════════════════════════════
export default function MonitorLectorDashboard({ lectorDeviceId, gatewayLastSeen, gatewayName: gatewayNameProp, onBack, children }: { lectorDeviceId?: number | null; gatewayLastSeen?: string | null; gatewayName?: string | null; onBack?: () => void; children?: ReactNode }) {
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

  // Gateway del lector: prop (panel del gateway) o por convención (id_device_father).
  const assignedGateway = useMemo(() => {
    if (!allDevices || !lectorId) return null;
    return allDevices.find((d: any) => d.type_device === 'Gateway' && d.id_device_father === lectorId) ?? null;
  }, [allDevices, lectorId]);

  const gatewayName = gatewayNameProp || assignedGateway?.name || null;

  // ═══════════════════════════════════════════════════════════════════
  // Histórico paginado server-side: solo la página actual y sin auto-refresco;
  // el dato "live" va por latestTelemetry.
  // ═══════════════════════════════════════════════════════════════════
  const HISTORY_PAGE_SIZE = 200;
  const [historyPage, setHistoryPage] = useState(0);
  // Antes de los returns condicionales (reglas de hooks).
  const [exporting, setExporting] = useState(false);

  // Filtro temporal compartido por tabla, gráfico y Excel.
  const [historyPreset, setHistoryPreset] = useState(DEFAULT_HISTORY_PRESET);
  const [presetFrom, setPresetFrom] = useState<string | null>(() => presetWindowStart(presetMs(DEFAULT_HISTORY_PRESET)));
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  const historyRange = useMemo(() => {
    if (historyPreset === "custom") {
      // Los <input type="date"> son hora local del operador; se envían como ISO.
      return {
        from: historyFrom ? new Date(`${historyFrom}T00:00:00`).toISOString() : undefined,
        to: historyTo ? new Date(`${historyTo}T23:59:59.999`).toISOString() : undefined,
      };
    }
    return presetFrom ? { from: presetFrom } : {};
  }, [historyPreset, presetFrom, historyFrom, historyTo]);

  const applyHistoryPreset = (key: string) => {
    setHistoryPreset(key);
    setHistoryFrom("");
    setHistoryTo("");
    setPresetFrom(presetWindowStart(presetMs(key)));
  };
  const setCustomFrom = (v: string) => { setHistoryPreset("custom"); setPresetFrom(null); setHistoryFrom(v); };
  const setCustomTo = (v: string) => { setHistoryPreset("custom"); setPresetFrom(null); setHistoryTo(v); };
  const clearHistoryRange = () => applyHistoryPreset(DEFAULT_HISTORY_PRESET);
  const hasHistoryFilter = historyPreset !== DEFAULT_HISTORY_PRESET;
  const customActive = historyPreset === "custom";

  const historyOffset = historyPage * HISTORY_PAGE_SIZE;
  const { data: historyData, isFetching: historyFetching } = useMonitorDeviceTelemetryHistory(
    lectorId,
    { limit: HISTORY_PAGE_SIZE, offset: historyOffset, ...historyRange },
  );
  const historyTotal = historyData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));
  useEffect(() => { setHistoryPage(0); }, [lectorId, historyRange]);

  // Fila de telemetría → fila plana (tabla, gráfico y Excel).
  const mapHistoryRow = (t: any) => {
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
  };

  const historyRows = useMemo(
    () => (historyData?.telemetry || []).map(mapHistoryRow),
    [historyData],
  );

  // Columnas de ambiente / diagnóstico: solo se pintan si la página trae datos
  const hasAmbient = useMemo(
    () => historyRows.some((r: any) => r.ambTemp != null || r.humidity != null || r.pressure != null || r.ramFree != null),
    [historyRows],
  );

  // ── Gráfico del histórico: variable seleccionada + downsampling LTTB ──
  const [chartVar, setChartVar] = useState("vBat");
  const [copiedEui, setCopiedEui] = useState(false);
  const chartVarDef = CHART_VARS.find(v => v.key === chartVar) ?? CHART_VARS[0];

  // El gráfico ahora vive siempre visible bajo la tabla; se reduce con LTTB (~500 pts).
  const chartEnabled = !!lectorId;
  const { data: chartRawData, isFetching: chartFetching } = useQuery({
    queryKey: ["monitor", "telemetry-chart-sample", lectorId, historyRange, CHART_POINTS],
    queryFn: () => monitorService.getDeviceTelemetry(lectorId!, { sample: CHART_POINTS, ...historyRange }),
    enabled: chartEnabled,
    staleTime: 30000,
  });
  const chartRangeTotal = chartRawData?.total ?? 0;
  const chartPoints = useMemo(() => {
    const pts = (chartRawData?.telemetry || [])
      .map(mapHistoryRow)
      .map((r: any) => ({ x: new Date(r.ts).getTime(), y: r[chartVar] }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    const sampled = downsampleLTTB(pts, CHART_DRAW_POINTS);
    return sampled.map((p) => ({ time: format(new Date(p.x), "dd/MM HH:mm"), value: p.y }));
  }, [chartRawData, chartVar]);

  const chartSpan = chartPoints.length
    ? `${chartPoints[0].time} → ${chartPoints[chartPoints.length - 1].time}`
    : "";

  // Si todo el rango cae en el mismo día, el eje X basta con HH:mm
  const chartMultiDay = chartPoints.length > 1
    ? chartPoints[0].time.slice(0, 5) !== chartPoints[chartPoints.length - 1].time.slice(0, 5)
    : true;

  // Extraer datos de telemetría del primer lector
  const dashboardData = useMemo(() => {
    if (!lectores.length) {
      return { tel: [], mpttTel: [], lector: { name: 'Sin lector asignado', dev_eui: '—' }, lastT: null, sensores: {}, charger220: {}, vBat: null, pPan: null, iBat: null, iOut: null, loadState: null, chargeState: null, pvVolt: null, charging: false, charger220State: null, charger220Volt: null, temp: null };
    }
    if (!latestTelemetry) return null;
    const lector = lectores[0];
    const tel = (latestTelemetry || []).filter((t: any) =>
      t.dev_eui?.toLowerCase() === lector.dev_eui.toLowerCase() || t.device_id === lector.id
    );

    if (!tel.length) return { tel: [], mpttTel: [], lector, lastT: null, sensores: {}, charger220: {}, vBat: null, pPan: null, iBat: null, iOut: null, loadState: null, chargeState: null, charging: false, charger220State: null, charger220Volt: null, temp: null };
    const lastT = tel.find((t: any) => t.object?.Mppt) || tel[0] || null;
    const obj = lastT?.object || {};
    const mppt = obj.Mppt || {};
    const security = obj.Security || {};
    const blueSmart = obj.BlueSmartIP67 || {};
    const mpttTel = tel.filter((t: any) => t.object?.Mppt).sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return {
      tel, mpttTel, lector, lastT,
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
  const { lector, lastT, sensores, vBat, pPan, iBat, chargeState, charging, charger220, charger220State, charger220Volt, temp } = dashboardData;

  // ── CA 220 (BlueSmartIP67): estado + voltaje + corriente ──
  // Activo cuando el voltaje es distinto de 0; si no, se pinta en plomo (no activo).
  const caVolt = charger220Volt != null ? charger220Volt : null;
  const caAmp = cleanCurrent(charger220?.corriente_A) ?? null;
  const caEstado = charger220State || null;
  const caActiva = caVolt != null && caVolt > 0;
  const caColor = caActiva ? '#3b82f6' : '#6b7280';

  // El Excel se genera al pulsar, con tope de filas.
  const EXPORT_MAX = 20000;
  const exportExcel = async () => {
    if (exporting || !lectorId) return;
    setExporting(true);
    try {
      let rows = historyRows;
      if (historyTotal > rows.length) {
        const full = await monitorService.getDeviceTelemetry(lectorId, {
          limit: Math.min(historyTotal, EXPORT_MAX),
          offset: 0,
          ...historyRange,
        });
        rows = (full?.telemetry || []).map(mapHistoryRow);
      }
      if (!rows.length) return;
      const out = rows.map((r: any) => ({
        "Fecha": r.ts ? format(new Date(r.ts), "dd/MM/yyyy HH:mm:ss") : "",
        "Batería (V)": r.vBat, "Corriente (A)": r.iBat, "Panel (W)": r.pPan, "Panel V (V)": r.pvVolt,
        "Carga (A)": r.loadA, "Load": r.loadState, "Temp MPPT (°C)": r.temp, "Carga": r.chargeState,
        "Yield hoy (kWh)": r.yieldToday, "Puerta": r.door, "Aperturas": r.doorCounter, "Prox": r.pir,
        "Chg 220": r.chargerState, "Chg V (V)": r.chargerVolt, "Chg A (A)": r.chargerAmp,
        "T° amb (°C)": r.ambTemp, "Humedad (%)": r.humidity, "Presión (Pa)": r.pressure,
        "RAM libre (bytes)": r.ramFree,
      }));
      const ws = XLSX.utils.json_to_sheet(out);
      ws["!cols"] = [{ wch: 20 }, ...Array(19).fill({ wch: 13 })];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico lector");
      const name = (lector?.name || "lector").replace(/[^\w\-]+/g, "_");
      XLSX.writeFile(wb, `historial_lector_${name}.xlsx`);
    } catch (err) {
      console.error("[LectorDash] Error exportando Excel:", err);
    } finally {
      setExporting(false);
    }
  };

  // Estado online del lector: diferencia absoluta <= 5 min (tolera reloj adelantado/atrasado y NaN)
  const lastTsMs = lastT?.ts ? new Date(lastT.ts).getTime() : NaN;
  const isLectorOnline = Number.isFinite(lastTsMs) && Math.abs(Date.now() - lastTsMs) < 300000;

  // El estado del gateway usa su propio last_seen: heredar el del lector daría falsos "online".
  const gwLastSeen = gatewayLastSeen ?? assignedGateway?.last_seen ?? null;
  const gwTsMs = gwLastSeen ? new Date(gwLastSeen).getTime() : NaN;
  const hasGateway = !!(gatewayNameProp || assignedGateway);
  const gwState: 'online' | 'offline' | 'unassigned' = !hasGateway
    ? 'unassigned'
    : (Number.isFinite(gwTsMs) && Math.abs(Date.now() - gwTsMs) < 300000 ? 'online' : 'offline');
  const gwColor = gwState === 'online' ? '#22c55e' : gwState === 'offline' ? '#ef4444' : '#94a3b8';

  const batPct = vBat != null ? Math.max(0, Math.min(100, ((vBat - 11) / (15 - 11)) * 100)) : null;
  const batColor = vBat != null ? (vBat >= 12.5 ? '#22c55e' : vBat >= 11.8 ? '#f97316' : '#ef4444') : '#94a3b8';

  // chargeState: valores BLE del MPPT (0/64/128/255) + los del estándar Victron (0-7)
  const CHARGE_STATE_MAP: Record<number, { label: string; color: string }> = {
    0: { label: 'Carga inicial', color: '#f97316' },
    1: { label: 'Fallo', color: '#ef4444' },
    2: { label: 'Bulk', color: '#f97316' },
    3: { label: 'Absorción', color: '#22c55e' },
    4: { label: 'Flotación', color: '#3b82f6' },
    5: { label: 'Almacenamiento', color: '#14b8a6' },
    6: { label: 'Ecualización', color: '#a855f7' },
    7: { label: 'Control externo', color: '#94a3b8' },
    64: { label: 'Absorción', color: '#22c55e' },
    128: { label: 'Flotación', color: '#3b82f6' },
    252: { label: 'Control externo', color: '#94a3b8' },
    255: { label: 'Completo', color: '#22c55e' },
  };
  const chargeMeta = chargeState != null
    ? (CHARGE_STATE_MAP[chargeState] || { label: `Estado ${chargeState}`, color: '#94a3b8' })
    : { label: '—', color: '#94a3b8' };

  // Métricas secundarias en dos bloques: eléctrico y estado físico del gabinete.
  // Etiqueta pequeña y mate, valor más grande; la unidad se pinta aparte y atenuada.
  const statusRowsEnergia: { label: string; value: string; unit?: string; color: string; wide?: boolean }[] = [
    { label: 'Corriente', value: iBat != null ? `${iBat > 0 ? '+' : ''}${iBat.toFixed(2)}` : '—', unit: iBat != null ? 'A' : undefined, color: iBat != null && iBat < 0 ? '#f97316' : '#e5e7eb' },
    { label: 'Carga', value: chargeMeta.label, color: chargeMeta.color },
    { label: 'CA 220', value: caActiva ? `${caEstado || 'ACTIVA'} · ${caVolt!.toFixed(0)} V` : (caEstado || 'Sin CA'), color: caColor, wide: true },
  ];
  const statusRowsGabinete: { label: string; value: string; unit?: string; color: string; wide?: boolean }[] = [
    { label: 'Temperatura', value: temp != null ? temp.toFixed(1) : '—', unit: temp != null ? '°C' : undefined, color: '#e5e7eb' },
    { label: 'Puerta', value: sensores?.doorState === 1 ? 'ABIERTA' : sensores?.doorState === 0 ? 'CERRADA' : '—', color: sensores?.doorState === 1 ? '#ef4444' : '#e5e7eb' },
  ];

  // Tiempo relativo del último dato ("hace 2 min"), más legible que la fecha absoluta.
  const lastRel = relTime(lastT?.ts ? Date.now() - new Date(lastT.ts).getTime() : null);

  // Copiar el EUI del lector al portapapeles con confirmación temporal
  const copyEui = () => {
    const val = lector?.dev_eui;
    if (!val || val === '—') return;
    const done = () => {
      setCopiedEui(true);
      window.setTimeout(() => setCopiedEui(false), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val).then(done).catch(() => { fallbackCopy(val); done(); });
    } else {
      fallbackCopy(val);
      done();
    }
  };

  return (
    <div className={`flex-1 min-h-0 flex flex-col gap-2 p-2 bg-bg-200 rounded-md transition-all ${hasLector ? '' : 'opacity-40 grayscale'}`}>
      <style>{`@keyframes flowLine{to{stroke-dashoffset:-24}}@keyframes flowBack{to{stroke-dashoffset:24}}@keyframes pulseLive{0%{transform:scale(1)}50%{transform:scale(2)}100%{transform:scale(1)}}`}</style>

      {/* ─── FILA 1 · INFORMACIÓN DEL GATEWAY (un solo card) ─── */}
      <div className={`${children ? 'rounded-lg bg-bg-100 border border-border/30 shadow-sm overflow-hidden' : ''} flex-[0_0_264px] min-h-0 flex flex-col`}>

        {/* Cabecera del card: identifica que todo el bloque es del gateway */}
        {children && (
          <div className="shrink-0 px-2 py-1 border-b border-border/30 flex items-center gap-1.5">
            {onBack && (
              <button onClick={onBack} title="Volver" aria-label="Volver"
                className="shrink-0 inline-flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-md text-[11px] font-semibold text-text-200 bg-bg-300/60 border border-border/40 hover:bg-bg-300 hover:text-text-100 hover:border-border/70 active:scale-[0.97] transition-all">
                <IconArrowLeft size={14} stroke={2.2} />
                Volver
              </button>
            )}
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-[#00a3e8] bg-[#00a3e8]/10 border border-[#00a3e8]/30 px-1.5 py-0.5 rounded">Gateway</span>
            <p className="text-[16px] font-bold tracking-tight text-text-100 truncate leading-tight">{gatewayName || 'Sin gateway'}</p>
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${gwState === 'online' ? 'bg-emerald-400' : gwState === 'offline' ? 'bg-red-400' : 'bg-gray-500'}`} />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: gwColor }}>
              {gwState === 'online' ? 'Online' : gwState === 'offline' ? 'Offline' : 'Sin asignar'}
            </span>
            {gwState === 'offline' && gwLastSeen && (
              <span className="shrink-0 text-[10px] truncate" style={{ color: '#fca5a5' }}>
                desde {format(new Date(gwLastSeen), "dd/MM HH:mm")} · {relTime(Date.now() - new Date(gwLastSeen).getTime()) ?? '—'}
              </span>
            )}
            <div className="flex-1" />
            {hasLector && (
              <span className="text-[10px] text-text-300 truncate">último dato {lastRel ?? '—'}</span>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 flex p-2 gap-2">

        {/* A · ESTADO DEL LECTOR + FIGURA DE LA CAJA */}
        <div className={`${children ? 'flex-[1.5]' : 'flex-1'} min-h-0 flex gap-2 transition-all ${isLectorOnline ? '' : 'opacity-40 grayscale'}`}>

          {/* A1 · identidad + cifras principales + medidas secundarias */}
          <div className={`${children ? 'w-[46%] bg-bg-200/25' : 'w-[34%] bg-bg-100 border border-border/30'} min-w-0 rounded-lg flex flex-col min-h-0`}>
            <div className="shrink-0 px-2 py-1.5 border-b border-border/30 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasLector && isLectorOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <p className={`${hasLector ? 'text-[11px] font-medium text-text-200' : 'text-[11px] font-bold text-red-400'} truncate leading-tight min-w-0 flex-1`}>{lector.name}</p>
              {hasLector && lector.dev_eui && (
                <button onClick={copyEui}
                  title={copiedEui ? 'Copiado' : lector.dev_eui}
                  aria-label={`EUI ${lector.dev_eui}`}
                  className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-text-300/80 hover:text-text-100 hover:bg-bg-300/60 active:scale-95 transition-all">
                  {copiedEui
                    ? <IconCheck size={13} stroke={2.6} className="text-emerald-400" />
                    : <IconHash size={12} stroke={2} />}
                </button>
              )}
              {hasLector && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: !isLectorOnline ? '#ef4444' : charging ? '#22c55e' : '#94a3b8' }}>
                  {!isLectorOnline ? 'OFFLINE' : charging ? 'CHG' : 'IDLE'}
                </span>
              )}
            </div>

            {!hasLector && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-3">
                <p className="text-[11px] font-semibold text-text-200">Sin lector asignado</p>
                <p className="text-[10px] text-text-300 mt-1 leading-snug">Asigna un lector a este gateway desde Configuración para ver su estado.</p>
              </div>
            )}

            {hasLector && (<>
              {/* Cifras principales: lo primero que se mira */}
              <div className="shrink-0 grid grid-cols-2 gap-2 px-2 py-2 border-b border-border/20">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-text-300">Batería</p>
                  <p className="text-[20px] font-bold tabular-nums leading-none mt-1 truncate" style={{ color: batColor }}>
                    {batPct != null ? Math.round(batPct) : '—'}<span className="text-[11px] font-medium text-text-300/70 ml-0.5">%</span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-text-300">Voltaje</p>
                  <p className="text-[20px] font-bold tabular-nums leading-none mt-1 truncate text-text-100">
                    {vBat != null ? vBat.toFixed(2) : '—'}<span className="text-[11px] font-medium text-text-300/70 ml-0.5">V</span>
                  </p>
                </div>
              </div>

              {/* Medidas secundarias en dos bloques (eléctrico / gabinete) */}
              <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-1 pb-1.5">
                <div className="grid grid-cols-2 gap-x-3">
                  {statusRowsEnergia.map(row => (
                    <div key={row.label} className={`min-w-0 py-0.5 border-b border-border/15 ${row.wide ? 'col-span-2' : ''}`}>
                      <p className="text-[9px] uppercase tracking-wider text-text-300/90 leading-tight truncate">{row.label}</p>
                      <p className="text-[11px] font-semibold tabular-nums leading-tight mt-px truncate" style={{ color: row.color }} title={row.value}>
                        {row.value}{row.unit && <span className="text-[9px] font-medium text-text-300/70 ml-0.5">{row.unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-0.5 pt-0.5 border-t border-border/25 grid grid-cols-2 gap-x-3">
                  {statusRowsGabinete.map(row => (
                    <div key={row.label} className={`min-w-0 py-0.5 border-b border-border/15 ${row.wide ? 'col-span-2' : ''}`}>
                      <p className="text-[9px] uppercase tracking-wider text-text-300/90 leading-tight truncate">{row.label}</p>
                      <p className="text-[11px] font-semibold tabular-nums leading-tight mt-px truncate" style={{ color: row.color }} title={row.value}>
                        {row.value}{row.unit && <span className="text-[9px] font-medium text-text-300/70 ml-0.5">{row.unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>)}
          </div>

          {/* A2 · figura de la caja eléctrica (esquema de energía) */}
          <div className={`flex-1 min-w-0 rounded-lg p-1 flex flex-col relative overflow-hidden ${children ? 'bg-bg-200/25' : 'bg-bg-100 border border-border/30'} min-h-0`}>
            <p className="absolute top-1.5 right-2 text-[9px] font-bold uppercase tracking-widest text-text-300 z-10">Caja</p>
            {/* Live indicator HTML — sobre el SVG */}
            <div className="absolute top-1.5 left-2 z-10 flex items-center gap-1">
              <span className="relative flex items-center justify-center w-3.5 h-3.5">
                <span className="absolute inset-0 rounded-full" style={{
                  background: isLectorOnline ? '#22c55e' : '#ef4444',
                  opacity: 0.25, animation: 'pulseLive 2s infinite'
                }} />
                <span className="w-2 h-2 rounded-full" style={{
                  background: isLectorOnline ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 8px ${isLectorOnline ? '#22c55e' : '#ef4444'}`
                }} />
              </span>
              <span className="text-[9px] font-bold tracking-wider" style={{
                color: isLectorOnline ? '#22c55e' : '#ef4444'
              }}>LIVE</span>
              <span className="text-[9px] text-text-200 ml-0.5">
                {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}
              </span>
            </div>
            <div className="flex-1 w-full h-full flex items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 340 152" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glowBlue" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glowYellow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* ── CONEXIONES ── */}
                {/* SOLAR → MPPT */}
                <path d="M 96 35 H 122" stroke="#3f3f46" strokeWidth="2" fill="none" />
                {(pPan ?? 0) > 0 && (
                  <path d="M 96 35 H 122" stroke="#eab308" strokeWidth="2" fill="none" strokeDasharray="7 5"
                    style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />
                )}
                {/* MPPT → BATERÍA */}
                <path d="M 218 35 H 244" stroke="#3f3f46" strokeWidth="2" fill="none" />
                {charging && (
                  <path d="M 218 35 H 244" stroke="#22c55e" strokeWidth="2" fill="none" strokeDasharray="7 5"
                    style={{ animation: 'flowLine 1.5s linear infinite', strokeDashoffset: 0 }} />
                )}
                {/* MPPT → GATEWAY */}
                <path d="M 170 58 V 92" stroke="#00a3e8" strokeWidth="2" fill="none" strokeDasharray="6 5" opacity="0.75"
                  style={{ animation: 'flowLine 1.6s linear infinite', strokeDashoffset: 0 }} />
                {/* CA 220 → BATERÍA */}
                <path d="M 288 92 V 62" stroke={caColor} strokeWidth="2" fill="none" strokeDasharray={caActiva ? "6 5" : "0"}
                  opacity={caActiva ? 0.8 : 0.3}
                  style={caActiva ? { animation: 'flowBack 1.6s linear infinite', strokeDashoffset: 0 } : undefined} />

                {/* ── SOLAR ── */}
                <g>
                  <rect x="6" y="14" width="90" height="44" rx="8" fill={(pPan ?? 0) > 0 ? '#eab308' : '#52525b'} fillOpacity="0.14"
                    stroke={(pPan ?? 0) > 0 ? '#eab308' : '#3f3f46'} strokeWidth="1" strokeOpacity={(pPan ?? 0) > 0 ? 0.55 : 0.2} />
                  <circle cx="16" cy="24" r="3" fill={(pPan ?? 0) > 0 ? '#eab308' : '#52525b'} filter="url(#glowYellow)" />
                  <text x="26" y="28" fill="#a1a1aa" fontSize="10" fontWeight="bold">SOLAR</text>
                  {/* Panel solar */}
                  <g transform="translate(74, 18)" fill="none" stroke={(pPan ?? 0) > 0 ? '#eab308' : '#71717a'} strokeWidth="1.1" strokeLinejoin="round" opacity={(pPan ?? 0) > 0 ? 0.95 : 0.6}>
                    <rect x="0" y="0" width="14" height="8" rx="1" />
                    <line x1="4.7" y1="0" x2="4.7" y2="8" />
                    <line x1="9.3" y1="0" x2="9.3" y2="8" />
                    <line x1="0" y1="4" x2="14" y2="4" />
                    <line x1="7" y1="8" x2="7" y2="11" />
                  </g>
                  <text x="16" y="49" fill="#f4f4f5" fontSize="15" fontWeight="bold">
                    {pPan != null ? pPan.toFixed(0) : '—'}<tspan fontSize="10" fill="#a1a1aa" fontWeight="normal"> W</tspan>
                  </text>
                </g>

                {/* ── MPPT ── */}
                <g>
                  <rect x="122" y="14" width="96" height="44" rx="8" fill="#00a3e8" fillOpacity="0.14"
                    stroke={charging ? '#22c55e' : '#3f3f46'} strokeWidth="1" strokeOpacity={charging ? 0.55 : 0.2} />
                  <circle cx="132" cy="24" r="3" fill="#00a3e8" filter="url(#glowBlue)" />
                  <text x="142" y="28" fill="#a1a1aa" fontSize="10" fontWeight="bold">MPPT</text>
                  {/* Chip controlador */}
                  <g transform="translate(196, 17)" fill="none" stroke={charging ? '#22c55e' : '#71717a'} strokeWidth="1.1" strokeLinecap="round" opacity={charging ? 0.95 : 0.6}>
                    <rect x="3" y="3" width="8" height="8" rx="1.5" />
                    <line x1="5.5" y1="0" x2="5.5" y2="3" />
                    <line x1="8.5" y1="0" x2="8.5" y2="3" />
                    <line x1="5.5" y1="11" x2="5.5" y2="14" />
                    <line x1="8.5" y1="11" x2="8.5" y2="14" />
                    <line x1="0" y1="5.5" x2="3" y2="5.5" />
                    <line x1="0" y1="8.5" x2="3" y2="8.5" />
                    <line x1="11" y1="5.5" x2="14" y2="5.5" />
                    <line x1="11" y1="8.5" x2="14" y2="8.5" />
                  </g>
                  <text x="132" y="49" fill={chargeMeta.color} fontSize="12" fontWeight="bold">
                    {chargeMeta.label}
                  </text>
                </g>

                {/* ── BATERÍA ── */}
                <g>
                  <rect x="244" y="14" width="90" height="44" rx="8" fill={batColor} fillOpacity="0.14" stroke={batColor} strokeWidth="1" strokeOpacity="0.5" />
                  <rect x="334" y="28" width="4" height="14" rx="1.5" fill={batColor} />
                  <circle cx="254" cy="24" r="3" fill={batColor} filter="url(#glowGreen)" />
                  <text x="264" y="28" fill="#a1a1aa" fontSize="10" fontWeight="bold">BATERÍA</text>
                  <text x="254" y="49" fill="#f4f4f5" fontSize="15" fontWeight="bold">
                    {batPct != null ? `${Math.round(batPct)}` : '—'}<tspan fontSize="10" fill="#a1a1aa" fontWeight="normal">%</tspan>
                  </text>
                  <text x="330" y="49" textAnchor="end" fill={batColor} fontSize="11" fontWeight="bold">
                    {vBat != null ? vBat.toFixed(2) : '—'}<tspan fontSize="9" fill="#a1a1aa" fontWeight="normal">V</tspan>
                  </text>
                </g>

                {/* ── GATEWAY ── */}
                <g>
                  <rect x="122" y="92" width="96" height="44" rx="8" fill={gwColor} fillOpacity="0.12" stroke={gwColor} strokeWidth="1" strokeOpacity={gwState === 'online' ? 0.55 : 0.2} />
                  <circle cx="132" cy="102" r="3" fill={gwColor} filter={gwState === 'online' ? 'url(#glowGreen)' : undefined} />
                  <text x="142" y="106" fill="#a1a1aa" fontSize="10" fontWeight="bold">GATEWAY</text>
                  {/* Antena */}
                  <g transform="translate(196, 95)" fill="none" stroke={gwColor} strokeWidth="1.1" strokeLinecap="round" opacity={gwState === 'online' ? 0.95 : 0.55}>
                    <line x1="7" y1="13" x2="7" y2="5" />
                    <path d="M 4 6.5 A 4.2 4.2 0 0 1 10 6.5" />
                    <path d="M 1.5 3.5 A 7.8 7.8 0 0 1 12.5 3.5" />
                    <circle cx="7" cy="13" r="1" fill={gwColor} />
                  </g>
                  <text x="132" y="126" fill={gwColor} fontSize="12" fontWeight="bold">
                    {gwState === 'online' ? 'Online' : gwState === 'offline' ? 'Offline' : 'Sin asignar'}
                  </text>
                </g>

                {/* ── CA 220 ── */}
                <g opacity={caActiva ? 1 : 0.75}>
                  <rect x="244" y="92" width="90" height="44" rx="8" fill={caColor} fillOpacity={caActiva ? 0.14 : 0.08} stroke={caColor} strokeWidth="1" strokeOpacity={caActiva ? 0.55 : 0.2} />
                  <circle cx="254" cy="102" r="3" fill={caColor} filter={caActiva ? 'url(#glowBlue)' : undefined} />
                  <text x="264" y="106" fill="#a1a1aa" fontSize="10" fontWeight="bold">CA 220</text>
                  {/* Icono de enchufe: azul si hay CA, plomo si no */}
                  <g transform="translate(316, 96)" fill="none" stroke={caColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="2.2" y1="0" x2="2.2" y2="3.4" />
                    <line x1="7.4" y1="0" x2="7.4" y2="3.4" />
                    <path d="M0 3.4 h9.6 v3.4 a4.8 4.8 0 0 1 -9.6 0 z" />
                    <line x1="4.8" y1="10.6" x2="4.8" y2="14.4" />
                  </g>
                  <text x="254" y="127" fill={caActiva ? '#22c55e' : '#a1a1aa'} fontSize="11" fontWeight="bold">
                    {caVolt != null ? caVolt.toFixed(0) : '—'}<tspan fontSize="8" fontWeight="normal"> V</tspan>
                  </text>
                  <text x="328" y="127" textAnchor="end" fill={caActiva && caAmp != null ? '#22c55e' : '#a1a1aa'} fontSize="11" fontWeight="bold">
                    {caAmp != null ? caAmp.toFixed(2) : '—'}<tspan fontSize="8" fontWeight="normal"> A</tspan>
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Conectividad · Alertas · Cobertura (las inyecta el panel del gateway) */}
        {children}
        </div>
      </div>

      {/* ─── Tabla de histórico ─── */}
      {hasLector && (
        <div className="rounded-lg bg-bg-100 border border-border/30 overflow-hidden flex flex-col min-h-0 flex-[1.15]">
          {/* Cabecera única: título + rango + fechas + contador + Excel */}
          <div className="shrink-0 px-3 py-1.5 border-b border-border/20 flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a3e8]" />
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">Lector</span>
            <h3 className="text-[10px] font-semibold text-text-200 uppercase tracking-wider whitespace-nowrap">Histórico · Datos</h3>
            <span className="w-px h-4 bg-border/30 mx-0.5 shrink-0" />
            <div className="flex gap-1 shrink-0">
              {HISTORY_RANGES.map(r => (
                <button key={r.key} onClick={() => applyHistoryPreset(r.key)} title={r.title}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${historyPreset === r.key ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "bg-bg-200/50 text-text-300 hover:text-text-200"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <span className="w-px h-5 bg-border/20 shrink-0" />
            <div className="flex items-center gap-1.5">
              <label htmlFor="lector-hist-from" className="text-[10px] uppercase tracking-wider text-text-300">Desde</label>
              <input id="lector-hist-from" type="date" value={historyFrom} max={historyTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className={`px-1.5 py-0.5 rounded-md bg-bg-200/60 border text-[10px] text-text-100 tabular-nums outline-none ${customActive ? 'border-[#00a3e8]/60' : 'border-border/40 focus:border-[#00a3e8]/60'}`} />
              <label htmlFor="lector-hist-to" className="text-[10px] uppercase tracking-wider text-text-300">Hasta</label>
              <input id="lector-hist-to" type="date" value={historyTo} min={historyFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className={`px-1.5 py-0.5 rounded-md bg-bg-200/60 border text-[10px] text-text-100 tabular-nums outline-none ${customActive ? 'border-[#00a3e8]/60' : 'border-border/40 focus:border-[#00a3e8]/60'}`} />
              {hasHistoryFilter && (
                <button onClick={clearHistoryRange} title="Volver al rango por defecto (24h)"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-text-300 bg-bg-200/60 border border-border/30 hover:text-text-100 hover:bg-bg-200 transition-colors">
                  <IconX size={10} />
                  Limpiar
                </button>
              )}
            </div>
            <span className="ml-auto text-[10px] text-text-300 whitespace-nowrap">{historyTotal.toLocaleString("es-CL")} registros</span>
            <button onClick={exportExcel} disabled={exporting} title="Descargar histórico en Excel"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              {exporting ? <><IconLoader2 size={11} className="animate-spin" />Generando…</> : "⬇ Excel"}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-[11px] tabular-nums [&_td]:py-2 [&_th]:py-2 [&_td]:px-2.5 [&_th]:px-2.5 [&_th]:whitespace-nowrap" style={{ minWidth: 1100 }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="sticky left-0 z-30 bg-bg-200 text-left py-1.5 px-2 font-medium">Fecha</th>
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
                  <th className="text-center py-1.5 px-2 font-medium">
                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: caActiva ? '#3b82f6' : '#6b7280' }} />Chg 220</span>
                  </th>
                  <th className="text-right py-1.5 px-2 font-medium">
                    <span className="inline-flex items-center gap-1 justify-end"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: caActiva ? '#3b82f6' : '#6b7280' }} />Chg V</span>
                  </th>
                  <th className="text-right py-1.5 px-2 font-medium">
                    <span className="inline-flex items-center gap-1 justify-end"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: caActiva ? '#3b82f6' : '#6b7280' }} />Chg A</span>
                  </th>
                  {hasAmbient && <>
                    <th className="text-right py-1.5 px-2 font-medium">T° amb</th>
                    <th className="text-right py-1.5 px-2 font-medium">Humedad</th>
                    <th className="text-right py-1.5 px-2 font-medium">Presión</th>
                    <th className="text-right py-1.5 px-2 font-medium">RAM libre</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {historyFetching && historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={hasAmbient ? 20 : 16} className="px-4 py-6 text-center text-text-300">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-text-300 border-t-transparent rounded-full animate-spin" />
                        Cargando registros…
                      </span>
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={hasAmbient ? 20 : 16} className="px-4 py-6 text-center text-text-300">Sin datos históricos</td>
                  </tr>
                ) : (
                  historyRows.map((r: any, i: number) => (
                    <tr key={r.ts || i} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} border-b border-border/20 hover:bg-bg-200/60 transition-colors`}>
                      <td className={`sticky left-0 z-10 py-1.5 px-2 text-text-300 text-[10px] whitespace-nowrap ${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200"}`}>
                        {r.ts ? format(new Date(r.ts), "dd/MM HH:mm:ss") : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.vBat != null ? `${r.vBat.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums" style={{ color: r.iBat != null && r.iBat < 0 ? '#f97316' : undefined }}>
                        {r.iBat != null ? `${r.iBat.toFixed(2)}A` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.pPan != null ? `${r.pPan.toFixed(0)}W` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.pvVolt != null ? `${r.pvVolt.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.loadA != null ? `${r.loadA.toFixed(2)}A` : "—"}</td>
                      <td className="py-1.5 px-2 text-center text-[10px]">
                        {r.loadState === 1
                          ? <span className="text-text-300">ON</span>
                          : r.loadState === 0
                            ? <span className="text-red-400 font-semibold">OFF</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.temp != null ? `${r.temp.toFixed(1)}°C` : "—"}</td>
                      <td className="py-1.5 px-2 text-center text-[10px]">
                        {r.chargeState != null
                          ? <span style={{ color: r.chargeState === 1 ? '#ef4444' : '#9ca3af' }}>{CHARGE_STATE_MAP[r.chargeState]?.label ?? r.chargeState}</span>
                          : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.yieldToday != null ? `${r.yieldToday.toFixed(3)}kWh` : "—"}</td>
                      <td className="py-1.5 px-2 text-center">
                        {r.door === 1
                          ? <span className="text-red-400 font-semibold">ABIERTA</span>
                          : r.door === 0
                            ? <span className="text-text-300">CERRADA</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center text-text-100 tabular-nums">{r.doorCounter ?? "—"}</td>
                      <td className="py-1.5 px-2 text-center">
                        {r.pir === 1
                          ? <span className="text-yellow-400 font-semibold">DETECTADO</span>
                          : r.pir === 0
                            ? <span className="text-text-300">LIBRE</span>
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center text-[10px] text-text-200">
                        {r.chargerState || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.chargerVolt != null ? `${r.chargerVolt.toFixed(2)}V` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.chargerAmp != null ? `${r.chargerAmp.toFixed(2)}A` : "—"}</td>
                      {hasAmbient && <>
                        <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.ambTemp != null ? `${r.ambTemp.toFixed(1)}°C` : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.humidity != null ? `${r.humidity.toFixed(0)}%` : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-text-100 tabular-nums">{r.pressure != null ? `${(r.pressure / 1000).toFixed(1)}kPa` : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-text-300 text-[10px] tabular-nums">
                          {r.ramFree != null ? `${(r.ramFree / 1024).toFixed(0)}KB` : "—"}
                        </td>
                      </>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {historyTotal > 0 && (
            <div className="shrink-0 px-3 py-2 border-t border-border/20 flex items-center gap-2">
              <button
                onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                disabled={historyPage === 0 || historyFetching}
                className="px-2.5 py-1 text-[10px] font-medium text-brand-100 bg-bg-200/50 rounded-md hover:bg-bg-200 border border-border/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Anterior
              </button>
              <span className="flex-1 text-center text-[10px] text-text-300 tabular-nums">
                {historyPage * HISTORY_PAGE_SIZE + 1}–{Math.min((historyPage + 1) * HISTORY_PAGE_SIZE, historyTotal)} de {historyTotal.toLocaleString("es-CL")} · Pág. {historyPage + 1}/{totalPages}
              </span>
              <button
                onClick={() => setHistoryPage(p => p + 1)}
                disabled={historyPage + 1 >= totalPages || historyFetching}
                className="px-2.5 py-1 text-[10px] font-medium text-brand-100 bg-bg-200/50 rounded-md hover:bg-bg-200 border border-border/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Histórico · Gráfico ─── */}
      {hasLector && (
        <div className="rounded-lg bg-bg-100 border border-border/30 overflow-hidden flex flex-col min-h-0 flex-1">
          <div className="shrink-0 px-3 py-1.5 border-b border-border/20 flex items-center gap-1.5 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a3e8]" />
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">Lector</span>
            <h3 className="text-[10px] font-semibold text-text-200 uppercase tracking-wider">Histórico · Gráfico</h3>
            <span className="w-px h-4 bg-border/30 mx-0.5 shrink-0" />
            {CHART_VARS.map(v => (
              <button key={v.key} onClick={() => setChartVar(v.key)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${chartVar === v.key ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "bg-bg-200/50 text-text-300 hover:text-text-200"}`}>
                {v.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-text-300 tabular-nums">
              {chartFetching ? "Cargando…" : `${chartRangeTotal} datos · ${chartPoints.length} pts${chartSpan ? ` · ${chartSpan}` : ""}`}
            </span>
          </div>
          <div className="flex-1 min-h-0 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints}>
                <defs>
                  <linearGradient id="grado-lector" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartVarDef.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chartVarDef.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.3)" }} minTickGap={90}
                  tickFormatter={(v: string) => (chartMultiDay ? v : String(v).slice(6))} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={46} domain={["auto", "auto"]} tickCount={4} />
                <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#ccc" }} />
                {chartVar === "vBat" && (
                  <ReferenceLine y={12.5} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.55}
                    label={{ value: "12.5 V", position: "insideTopRight", fill: "#22c55e", fontSize: 9 }} />
                )}
                {chartVar === "vBat" && (
                  <ReferenceLine y={11.8} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.55}
                    label={{ value: "11.8 V", position: "insideBottomRight", fill: "#ef4444", fontSize: 9 }} />
                )}
                <Area type="monotone" dataKey="value" stroke={chartVarDef.color} strokeWidth={1.8} fill="url(#grado-lector)" dot={false} name={`${chartVarDef.label} (${chartVarDef.unit})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
