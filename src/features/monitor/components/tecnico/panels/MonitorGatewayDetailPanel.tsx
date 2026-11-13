import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMonitorDevices, useMonitorLatestTelemetry, useMonitorDeviceAlerts, useMonitorGatewayPositions } from "../../../hooks/useMonitor";
import MonitorTelemetryMap from "../MonitorTelemetryMap";
import MonitorLectorDashboard, { relTime } from "./MonitorLectorDashboard";
import DeviceSwitcher from "../DeviceSwitcher";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { intervalosCaida, segmentosUptime, statsUptime, fmtDuracion, uptimeTextClass, uptimeDotClass } from "../../../utils/uptime";
import type { MonitorDevice } from "../../../types/monitor.types";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui?: string;
  lastSeen?: string | null;
  lastTs?: string | null;
  range?: string;
  onRangeChange?: (range: string) => void;
  onBack?: () => void;
  /** Cambiar a otro gateway sin salir del panel */
  onSelectDevice?: (device: MonitorDevice) => void;
}

// Tooltip del gráfico de estado: 1 = conectado, 0 = desconectado (+ duración del tramo)
interface EstadoTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { t: number; v: number; dur?: number; fin?: number } }>;
}

const EstadoTooltip = ({ active, payload }: EstadoTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const up = d.v === 1;
  const dur = d.dur ?? 0;
  return (
    <div className="bg-[#1a1d23]/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-2xl text-[11px] min-w-44">
      <p className="text-white/60 text-[10px] mb-1.5 border-b border-white/5 pb-1 font-medium tracking-wide">
        {format(new Date(d.t), "dd/MM/yyyy HH:mm:ss")}
      </p>
      <p className="flex items-center gap-2 leading-5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${up ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className={up ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
          {up ? 'Conectado' : 'Desconectado'}
        </span>
      </p>
      {dur > 0 && (
        <p className="flex items-center gap-2 leading-5 mt-1 pt-1 border-t border-white/5">
          <span className="text-white/50 font-medium">Duración:</span>
          <span className={`font-bold ml-auto ${up ? 'text-green-400' : 'text-red-400'}`}>{fmtDuracion(dur)}</span>
        </p>
      )}
      {!up && d.fin != null && d.fin > d.t && (
        <p className="flex items-center gap-2 leading-5">
          <span className="text-white/50 font-medium">Reconectó:</span>
          <span className="text-white/80 font-bold ml-auto">{format(new Date(d.fin), "dd/MM HH:mm:ss")}</span>
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export default function MonitorGatewayDetailPanel({ deviceId, deviceName, deviceEui, lastSeen, range = '7d', onRangeChange, onBack, onSelectDevice }: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: allDevices } = useMonitorDevices();
  const { data: gatewayPositions } = useMonitorGatewayPositions();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);

  // Lector device ID asociado al gateway
  const lectorDeviceId = useMemo(() => {
    if (!allDevices) return null;
    const gw = allDevices.find((d: any) => d.id === deviceId);
    return gw?.id_device_father || null;
  }, [allDevices, deviceId]);

  const { data: lectorAlerts } = useMonitorDeviceAlerts(lectorDeviceId);

  const connectedDeviceEuis = useMemo(() => {
    const devEuiSet = new Set<string>();
    const gwIdShort = deviceName?.slice(-6)?.toLowerCase();
    const euiShort = deviceEui?.slice(-6)?.toLowerCase();
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    (telemetry as any[]).forEach((t: any) => {
      if (Array.isArray(t.rxinfo)) {
        t.rxinfo.forEach((gw: any) => {
          const rxGwId = (gw.gatewayId || '').toLowerCase();
          if (rxGwId === deviceName?.toLowerCase() ||
              rxGwId === deviceEui?.toLowerCase() ||
              rxGwId.endsWith(gwIdShort) ||
              rxGwId.endsWith(euiShort) ||
              (gwIdShort && rxGwId.includes(gwIdShort))) {
            devEuiSet.add(t.device_id || t.dev_eui);
          }
        });
      }
    });
    return [...devEuiSet];
  }, [latestTelemetry, deviceName, deviceEui]);

  const connectedDevicesData = useMemo(() => {
    if (!allDevices || !connectedDeviceEuis.length) return [];
    const euiSet = new Set(connectedDeviceEuis.map(id => String(id).toLowerCase()));
    return allDevices.filter((d: any) =>
      euiSet.has(d.dev_eui?.toLowerCase()) || euiSet.has(String(d.id))
    );
  }, [allDevices, connectedDeviceEuis]);

  const connectedDevicesCount = connectedDevicesData.length;

  const sensorsData = useMemo(() => {
    const telemetry = Array.isArray(latestTelemetry) ? latestTelemetry : (latestTelemetry as any)?.telemetry || [];
    if (!telemetry.length || !allDevices || !connectedDevicesData.length) return [];
    const euiLower = deviceEui?.toLowerCase() || '';
    const nameLower = deviceName?.toLowerCase() || '';
    const short6 = euiLower.slice(-6);

    const deviceMap = new Map(allDevices.map((d: any) => [d.id, d]));
    const seen = new Set();
    const result: any[] = [];

    (telemetry as any[]).forEach((t: any) => {
      if (!Array.isArray(t.rxinfo)) return;
      const gwEntry = t.rxinfo.find((gw: any) => {
        const id = (gw.gatewayId || '').toLowerCase();
        return id === euiLower || id === nameLower || id.endsWith(short6) || (short6 && id.includes(short6));
      });
      if (!gwEntry) return;
      const device = deviceMap.get(t.device_id);
      if (!device || seen.has(device.id)) return;
      seen.add(device.id);
      result.push({
        id: device.id,
        name: device.name,
        dev_eui: device.dev_eui,
        lat: device.latitude_current ? Number(device.latitude_current) : null,
        lng: device.longitude_current ? Number(device.longitude_current) : null,
        snr: gwEntry.snr ?? null,
        rssi: gwEntry.rssi ?? null,
        ts: t.ts,
      });
    });

    return result;
  }, [latestTelemetry, allDevices, connectedDevicesData, connectedDeviceEuis, deviceEui, deviceName]);

  const gatewayPosition = useMemo(() => {
    if (!gatewayPositions) return null;
    const gw = gatewayPositions.find((g: any) =>
      g.dev_eui === deviceEui ||
      g.dev_eui === deviceName ||
      g.name === deviceName ||
      g.dev_eui?.slice(-6) === deviceEui?.slice(-6)
    );
    if (!gw || !gw.latitude_current || !gw.longitude_current) return null;
    return { lat: Number(gw.latitude_current), lng: Number(gw.longitude_current) };
  }, [gatewayPositions, deviceName, deviceEui]);

  const RANGES = [
    { key: '24h', label: '24H', hours: 24 },
    { key: '7d', label: '7 Días', hours: 168 },
    { key: '30d', label: '30 Días', hours: 720 },
    { key: 'total', label: 'Todo', hours: 0 },
  ];

  const rangeHours = RANGES.find(r => r.key === range)?.hours ?? 168;

  // Línea de tiempo activo/inactivo del gateway (funciones compartidas con la tabla del panel)
  const timelineData = useMemo(() => {
    const now = Date.now();
    const firstAlertTs = (deviceAlerts || [])
      .map((a) => new Date(a.created_at).getTime())
      .filter((t: number) => Number.isFinite(t))
      .sort((a: number, b: number) => a - b)[0];
    // El rango "Todo" arranca en la alerta más antigua (no en 1970)
    const rangeStart = rangeHours > 0 ? now - rangeHours * 3600000 : (firstAlertTs ?? now - 30 * 86400000);
    const alertas = (deviceAlerts || []).filter((a) =>
      a.type === 'desconexionGW' || a.type === 'desconexion220' || a.type === 'desconexionbatGW');
    const currentlyOnline = !!lastSeen && (now - new Date(lastSeen).getTime() < 300000);
    return segmentosUptime(intervalosCaida(alertas, rangeStart, now), rangeStart, now, currentlyOnline);
  }, [deviceAlerts, lastSeen, rangeHours]);

  // Totales del período (activo / inactivo / nº de caídas) para la leyenda y el uptime
  const conectividadStats = useMemo(() => statsUptime(timelineData), [timelineData]);

  const uptimePct = conectividadStats.uptime;
  const uptimeText = uptimeTextClass(uptimePct);
  const uptimeDot = uptimeDotClass(uptimePct);

  // Serie binaria del gráfico: 1 = conectado, 0 = desconectado.
  // Un punto por el inicio de cada segmento + el cierre del último; con type="stepAfter"
  // el trazo se mantiene plano y baja en vertical justo al empezar la caída.
  const conectividadEstado = useMemo(() => {
    const pts = timelineData.map(s => ({
      t: s.start, v: s.online ? 1 : 0, dur: s.end - s.start, fin: s.end,
    }));
    const last = timelineData[timelineData.length - 1];
    if (last) pts.push({ t: last.end, v: last.online ? 1 : 0, dur: 0, fin: last.end });
    return pts;
  }, [timelineData]);

  // Merge gateway alerts + lector alerts
  const mergedAlerts = useMemo(() => {
    const gw = Array.isArray(deviceAlerts) ? deviceAlerts : [];
    const lec = Array.isArray(lectorAlerts) ? lectorAlerts : [];
    const all = [...gw, ...lec];
    all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }, [deviceAlerts, lectorAlerts]);

  // Alertas dentro del rango seleccionado (una sola vez) y severidad máxima para dar color al contador
  const alertsEnRango = useMemo(
    () => mergedAlerts.filter((a: any) => rangeHours === 0 || new Date(a.created_at).getTime() >= (Date.now() - rangeHours * 3600000)),
    [mergedAlerts, rangeHours],
  );
  const alertsCriticas = alertsEnRango.filter((a: any) => a.type === 'critica' || a.type === 'apertura').length;
  const alertCountColor = alertsEnRango.length === 0
    ? '#94a3b8'
    : alertsCriticas > 0 ? '#ef4444' : '#eab308';

  const [panTab, setPanTab] = useState<"mapa" | "alertas" | "sensores">("mapa");
  const [mapOpen, setMapOpen] = useState(false);

  // Lista de gateways para el selector del título
  const gatewaysLista = useMemo(
    () => (allDevices || [])
      .filter((d: any) => d.type_device === 'Gateway')
      .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''))),
    [allDevices],
  );

  const headerTitle = (
    <DeviceSwitcher devices={gatewaysLista} currentId={deviceId} onSelect={onSelectDevice} fallbackName={deviceName} />
  );

  return (
    <MonitorLectorDashboard
      lectorDeviceId={lectorDeviceId}
      gatewayLastSeen={lastSeen}
      gatewayName={deviceName}
      headerTitle={headerTitle}
      onBack={onBack}
    >
      {/* B · CONECTIVIDAD */}
      <div className="flex-[0.85] min-w-0 min-h-0 flex flex-col bg-bg-200/25 rounded-lg overflow-hidden">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5">
              <p className="text-[11px] font-bold text-text-100 uppercase tracking-wider flex items-center gap-2 shrink-0">
                <span className={`w-2 h-2 rounded-full ${uptimeDot}`} /> Conectividad
              </p>
              <div className="flex items-center gap-2 ml-auto min-w-0">
                <span className={`text-[13px] font-bold ${uptimeText}`}>{uptimePct}%</span>
                <div className="flex gap-1">
                  {RANGES.filter(r => r.key !== 'total').map(r => (
                    <button key={r.key} onClick={() => onRangeChange?.(r.key)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${range === r.key ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "bg-bg-200/50 text-text-300 hover:text-text-200"}`}>{r.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
              <div className="flex-1 p-2.5 flex flex-col min-h-0">
                {/* Estado de conexión en el tiempo: 1 conectado · 0 desconectado */}
                <div className="flex-1 min-h-17.5">
                  {conectividadEstado.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={conectividadEstado} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} minTickGap={40}
                          tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
                          tickFormatter={(ts: number) => format(new Date(ts), rangeHours > 0 && rangeHours <= 24 ? "HH:mm" : rangeHours > 0 && rangeHours <= 168 ? "dd/MM HH'h'" : "dd/MM")} />
                        <YAxis hide domain={[-0.12, 1.12]} />
                        <Tooltip content={<EstadoTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.4)' }} />
                        <Line type="stepAfter" dataKey="v" stroke="#4ade80" strokeWidth={1.8} isAnimationActive={false} activeDot={{ r: 3, fill: '#4ade80' }}
                          dot={(p: any) => (p?.payload?.v === 0
                            ? <circle key={`caida-${p.index}`} cx={p.cx} cy={p.cy} r={2.6} fill="#ef4444" stroke="none" />
                            : <g key={`ok-${p.index}`} />)} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full"><p className="text-[10px] text-text-300">Sin datos en el período</p></div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-3 mt-1 text-[10px] text-text-300">
                  <span><span className="w-2 h-2 rounded-full inline-block mr-1" style={{ background: '#4ade80' }} />conectado</span>
                  <span><span className="w-2 h-2 rounded-full inline-block mr-1" style={{ background: '#ef4444' }} />caído</span>
                  <span className="ml-auto tabular-nums">
                    {fmtDuracion(conectividadStats.onlineMs)} / {fmtDuracion(conectividadStats.offlineMs)}
                  </span>
                </div>
              </div>
      </div>

      {/* C · MAPA / ALERTAS / SENSORES */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-bg-200/25 rounded-lg overflow-hidden">
        <div className="border-b border-border/30 shrink-0 flex items-center gap-1 px-2 py-1">
          <div className="flex gap-1 min-w-0">
            {([["mapa", "Mapa"], ["alertas", "Alertas"], ["sensores", "Sensores"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setPanTab(k)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${panTab === k ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "bg-bg-200/50 text-text-300 hover:text-text-200"}`}>
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px] font-bold pr-1 tabular-nums truncate" style={{ color: panTab === "alertas" ? alertCountColor : '#9ca3af' }}>
            {panTab === "alertas"
              ? (alertsEnRango.length === 0
                  ? 'sin alertas'
                  : alertsCriticas > 0
                    ? `${alertsEnRango.length} · ${alertsCriticas} crítica${alertsCriticas === 1 ? '' : 's'}`
                    : `${alertsEnRango.length} alerta${alertsEnRango.length === 1 ? '' : 's'}`)
              : panTab === "sensores"
                ? `${connectedDevicesCount} conectados`
                : ''}
          </span>
        </div>

        {panTab === "mapa" && (
          <div className="relative flex-1 min-h-0">
            {gatewayPosition ? (
              <>
                {/* Con el mapa ampliado abierto no se monta el inline: dos instancias de Leaflet con
                    cientos de marcadores a la vez es lo que hacía que se sintiera lento. */}
                {!mapOpen && <MonitorTelemetryMap devicePosition={gatewayPosition} deviceName={deviceName} sensors={sensorsData} zoom={13} />}
                <button onClick={() => setMapOpen(true)} title="Ampliar mapa" aria-label="Ampliar mapa"
                  className="absolute top-1.5 left-1.5 z-500 inline-flex items-center justify-center w-6 h-6 rounded bg-bg-100/90 border border-border/50 text-text-200 hover:text-text-100 hover:bg-bg-100 shadow-sm transition-colors">
                  <IconArrowsMaximize size={13} stroke={2} />
                </button>
                <div className="absolute bottom-1.5 left-1.5 z-500 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-semibold pointer-events-none">
                  {sensorsData.length} sensores
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full"><p className="text-[12px] text-text-300">Sin ubicación del gateway</p></div>
            )}
          </div>
        )}
        {panTab === "alertas" && (
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
                {alertsEnRango.length > 0 ? (
                  alertsEnRango.map((alert: any) => {
                      const alertTypeMap: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
                        critica: { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                        atencion: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                        apertura: { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Apertura' },
                        presencia: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Presencia' },
                        desconexionGW: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión' },
                        desconexionGPS: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión GPS' },
                        desconexion220: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión CA 220' },
                        desconexionbatGW: { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Desconexión Batería GW' },
                      };
                      const c = alertTypeMap[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-300', label: alert.type };
                      const isResolved = alert.status === 'resolved' || alert.status_system === 'resolved';
                      return <div key={alert.id} className={`flex items-start gap-1.5 text-[11px] leading-tight rounded px-1.5 py-1 border-s-2 ${c.border} ${c.bg} ${isResolved ? 'opacity-50' : ''}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot} ${isResolved ? '' : 'animate-pulse'} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-semibold uppercase ${c.text}`}>{c.label}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-medium text-text-100 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                            {alert.type === 'desconexionGW' && <><span className="text-[9px] text-text-300">→</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${alert.resolved_at ? 'text-green-300 bg-green-500/10' : 'text-red-300 bg-red-500/10'}`}>{alert.resolved_at ? format(new Date(alert.resolved_at), "dd/MM HH:mm") : 'Activo'}</span></>}
                          </div>
                          {alert.metadata?.reason && <p className="text-[10px] leading-tight mt-0.5 text-text-300">{alert.metadata.reason}</p>}
                          {alert.device_name && alert.type !== 'desconexionGW' && <p className="text-[10px] text-text-300 mt-0.5">{alert.device_name}</p>}
                        </div>
                      </div>;
                    })
                ) : (
                  <div className="flex items-center justify-center h-full flex-col">
                    <p className="text-[13px] text-text-300">Sin alertas</p>
                    <p className="text-[10px] mt-1 text-text-300">No hay eventos registrados</p>
                  </div>
                )}
              </div>
        )}

        {panTab === "sensores" && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {sensorsData.length > 0 ? sensorsData.map((s: any) => {
              const rssi = s.rssi, snr = s.snr;
              const color = rssi != null
                ? (rssi < -120 ? '#f87171' : rssi < -118 ? '#facc15' : '#4ade80')
                : snr != null ? (snr >= 10 ? '#4ade80' : snr >= 5 ? '#facc15' : '#f87171') : '#9ca3af';
              return (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1 border-b border-border/15">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px] text-text-200 truncate flex-1">{s.name}</span>
                  <span className="text-[10px] text-text-300 shrink-0 tabular-nums">
                    {rssi != null ? `${rssi.toFixed(0)} dBm` : snr != null ? `${snr.toFixed(0)} dB` : '—'}
                  </span>
                  <span className="text-[10px] text-text-300 shrink-0 w-16 text-right tabular-nums">
                    {s.ts ? relTime(Date.now() - new Date(s.ts).getTime()) ?? '—' : '—'}
                  </span>
                </div>
              );
            }) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11px] text-text-300">Sin sensores reportando</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mapa ampliado */}
      {mapOpen && createPortal(
        <div className="fixed inset-0 z-9999 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMapOpen(false)}>
          <div className="w-full h-full max-w-6xl rounded-xl overflow-hidden bg-bg-100 border border-border flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/30">
              <p className="text-xs font-bold uppercase tracking-wider text-text-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Mapa · {sensorsData.length} sensores
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-300">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1" />GW
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block ml-3 mr-1" />Sensores
                </span>
                <button onClick={() => setMapOpen(false)} title="Cerrar" aria-label="Cerrar"
                  className="w-6 h-6 rounded flex items-center justify-center text-text-200 hover:text-text-100 hover:bg-bg-300/60 transition-colors">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {gatewayPosition ? (
                <MonitorTelemetryMap devicePosition={gatewayPosition} deviceName={deviceName} sensors={sensorsData} zoom={13} />
              ) : (
                <div className="flex items-center justify-center h-full"><p className="text-[13px] text-text-300">Sin ubicación del gateway</p></div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </MonitorLectorDashboard>
  );
}
