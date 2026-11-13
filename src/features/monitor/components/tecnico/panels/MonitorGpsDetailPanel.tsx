import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useMonitorDeviceAlerts, useMonitorDeviceTrack, useMonitorGatewayPositions } from "../../../hooks/useMonitor";
import MonitorTelemetryMap from "../MonitorTelemetryMap";
import { MonitorChartTooltip } from "../../shared/MonitorChartTooltip";
import { formatBattery } from "../../../utils/battery";
import type { MonitorGpsPacket } from "../../../types/monitor.types";
import MonitorBatteryPopup from "../../shared/MonitorBatteryPopup";
import { mejorSenal, promedioSenal } from "../../../utils/signal";

interface Props {
  deviceId: number;
  deviceName: string;
  deviceEui: string;
  latitude_current?: number | null;
  longitude_current?: number | null;
  range: string;
  telemetryData: any;
  isLoading: boolean;
  activeGatewayIds: string[];
  chartData: any[];
  gatewayNames: string[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export default function MonitorGpsDetailPanel({
  deviceId, deviceName, latitude_current, longitude_current,
  telemetryData, isLoading, activeGatewayIds,
  chartData, onExportCSV, onExportPDF
}: Props) {
  const { data: deviceAlerts } = useMonitorDeviceAlerts(deviceId);
  const { data: gatewayPositions } = useMonitorGatewayPositions();
  // Historial GPS completo del sensor: una lectura por semana (paquete GPS_TELEMETRY).
  const { data: track, isLoading: trackLoading } = useMonitorDeviceTrack(deviceId, { todo: true });
  const gpsPuntos = useMemo(() => track?.puntos ?? [], [track]);
  const ultimaGps = gpsPuntos.length > 0 ? gpsPuntos[gpsPuntos.length - 1] : null;
  const resumenTrack = track?.resumen;
  const sinFix = resumenTrack?.sin_fix ?? 0;
  const gpsTotal = resumenTrack?.gps_total ?? gpsPuntos.length;
  const ultimoDato = resumenTrack?.ultimo_dato ?? null;
  // Pestaña de la tabla inferior: todos los registros o solo los paquetes GPS (con y sin fix)
  const [regTab, setRegTab] = useState<"todos" | "gps">("todos");
  // `gps_paquetes` viene del endpoint de track (histórico completo, con y sin fix).
  // Si el backend todavía no expone ese campo, se arma la lista con la telemetría ya cargada.
  const gpsPaquetes = useMemo<MonitorGpsPacket[]>(() => {
    const delTrack = track?.gps_paquetes;
    const lista: MonitorGpsPacket[] = delTrack && delTrack.length > 0
      ? delTrack
      : ((telemetryData?.telemetry ?? []) as any[])
          .filter(t => t.object?.latitude != null || t.object?.longitude != null)
          .map(t => {
            const lat = Number(t.object?.latitude);
            const lng = Number(t.object?.longitude);
            const sinFix = !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
            const rx = Array.isArray(t.rxinfo) ? t.rxinfo : (t.rxinfo ? [t.rxinfo] : []);
            const validas = rx.filter((g: any) => !g.crcStatus || g.crcStatus === "CRC_OK");
            return {
              ts: t.ts,
              lat: Number.isFinite(lat) ? lat : null,
              lng: Number.isFinite(lng) ? lng : null,
              alt: null,
              bateria_mv: t.object?.voltage_mV ?? null,
              satelites: t.object?.satellites ?? null,
              temperatura_c: t.object?.temperature_C ?? null,
              packet_type: t.object?.packetType ?? null,
              modo: t.object?.systemStatus?.operatingMode ?? null,
              motion: t.object?.systemStatus?.motionFlag === true,
              freefall: t.object?.systemStatus?.freeFallFlag === true,
              n_gw: validas.length,
              gateways: validas.map((g: any) => ({
                eui: g.gatewayId ?? null,
                name: null,
                lat: null,
                lng: null,
                rssi: g.rssi ?? null,
                snr: g.snr ?? null,
              })),
              rssi: null,
              snr: null,
              sin_fix: sinFix,
            };
          });
    return [...lista].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [track, telemetryData]);
  const sinFixLista = gpsPaquetes.filter(p => p.sin_fix).length;
  const conCoordLista = gpsPaquetes.length - sinFixLista;
  // Punto GPS al que el mapa debe volar al hacer clic en un registro (tick fuerza el re-vuelo)
  const [focusGps, setFocusGps] = useState<{ ts: string; tick: number } | null>(null);
  // Detalle (fecha por fecha) de los paquetes GPS que llegaron con coordenada 0 / sin fix
  const tituloSinFix = useMemo(() => {
    const fechas = (resumenTrack?.sin_fix_fechas ?? []).slice(-6).reverse()
      .map(ts => `· ${format(new Date(ts), "dd/MM/yyyy HH:mm")}`);
    const resto = sinFix - fechas.length;
    return [
      `${sinFix} de ${gpsTotal} paquetes GPS llegaron sin GPS (coordenada 0).`,
      "No se dibujan en el mapa.",
      ...fechas,
      resto > 0 ? `… y ${resto} más` : "",
    ].filter(Boolean).join("\n");
  }, [resumenTrack?.sin_fix_fechas, sinFix, gpsTotal]);
  // Distancia entre la coordenada de la BD (instalación) y la última lectura GPS
  const desvioM = useMemo(() => {
    if (!ultimaGps || latitude_current == null || longitude_current == null) return null;
    const R = 6371000;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(ultimaGps.lat - latitude_current);
    const dLng = rad(ultimaGps.lng - longitude_current);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(latitude_current)) * Math.cos(rad(ultimaGps.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }, [ultimaGps, latitude_current, longitude_current]);

  // Promedio de la mejor señal en los últimos 5 registros (la API los devuelve del más reciente
  // al más antiguo). La lógica vive en utils/signal.ts y la comparte el header del dispositivo.
  const promSenal = useMemo(() => promedioSenal(telemetryData?.telemetry, 5), [telemetryData]);
  const gwNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (gatewayPositions || []).forEach(gw => {
      if (gw.dev_eui) map.set(gw.dev_eui, gw.name);
      if (gw.dev_eui?.length >= 6) map.set(gw.dev_eui.slice(-6), gw.name);
    });
    return map;
  }, [gatewayPositions]);

  const signalKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key.startsWith('snr_') || key.startsWith('rssi_')) keys.add(key);
      });
    });
    return [...keys];
  }, [chartData]);

  const signalColorFor = (key: string) => {
    const palette = ['#07b3d1', '#e64343', '#a855f7', '#3b82f6', '#34d399', '#f59e0b', '#f472b6', '#f97316'];
    const index = signalKeys.findIndex(value => value === key);
    return palette[Math.abs(index) % palette.length] || '#94a3b8';
  };

  const signalLabelFor = (key: string) => {
    const raw = key.replace(/^snr_|^rssi_/, '');
    const decoded = raw.replace(/_/g, ' ');
    return decoded || 'Gateway';
  };

  return (
    <div className="flex-1 grid grid-cols-[1.45fr_0.9fr] gap-2 min-h-0">
      <div className="grid grid-rows-[1.2fr_1fr] gap-2 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs font-bold text-text-100 uppercase tracking-wider whitespace-nowrap">Cobertura &darr; Gateways</p>
                <div className="flex items-center gap-2 text-[10px] text-text-300 border-l border-border/30 pl-2 ml-0.5 min-w-0">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Posición guardada en la tabla devices (se carga a mano, no la escribe el GPS)">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> BD
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap" title={`Lecturas del GPS del sensor con coordenada válida (1 paquete por semana, desde telemetry_data_all)${(resumenTrack?.puntos_total ?? 0) > gpsPuntos.length ? `\nSe muestran las últimas ${gpsPuntos.length} de ${resumenTrack?.puntos_total}` : ""}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> GPS {gpsPuntos.length}
                  </span>
                  {sinFix > 0 && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-400 cursor-help" title={tituloSinFix}>
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> sin GPS {sinFix}
                    </span>
                  )}
                  {desvioM != null && desvioM > 1 && (
                    <span className="text-text-300 whitespace-nowrap" title="Distancia entre la posición de la BD y la última lectura GPS">
                      Δ {desvioM < 1000 ? `${desvioM.toFixed(0)} m` : `${(desvioM / 1000).toFixed(2)} km`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px] text-text-300">
                {ultimoDato && (
                  <span
                    className="whitespace-nowrap"
                    title={`Último dato recibido: ${format(new Date(ultimoDato.ts), "dd/MM/yyyy HH:mm")}\n${ultimoDato.packet_type ?? "—"}${ultimoDato.bateria_mv != null ? ` · ${formatBattery(ultimoDato.bateria_mv)}` : ""}`}
                  >
                    últ. dato {format(new Date(ultimoDato.ts), "dd/MM HH:mm")}
                  </span>
                )}
                {ultimaGps && (
                  <span
                    className="whitespace-nowrap"
                    title={`Última lectura GPS con coordenada: ${format(new Date(ultimaGps.ts), "dd/MM/yyyy HH:mm")}\n${ultimaGps.lat.toFixed(6)}, ${ultimaGps.lng.toFixed(6)}`}
                  >
                    últ. GPS {format(new Date(ultimaGps.ts), "dd/MM HH:mm")}
                  </span>
                )}
                {activeGatewayIds.length > 0 && (
                  <span className="text-[10px] text-text-300">{activeGatewayIds.length} enlaces</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 relative min-h-0">
            <MonitorTelemetryMap
              devicePosition={latitude_current != null && longitude_current != null
                ? { lat: latitude_current, lng: longitude_current }
                : null}
              deviceName={deviceName}
              gateways={gatewayPositions}
              activeGatewayIds={activeGatewayIds.length > 0 ? activeGatewayIds : undefined}
              gpsHistorial={trackLoading ? undefined : gpsPuntos}
              focusGps={focusGps}
            />
            {!trackLoading && gpsPuntos.length === 0 && (
              <div className="absolute bottom-2 left-2 z-500 pointer-events-none rounded-md bg-bg-100/90 border border-border/40 px-2 py-1 text-[10px] text-text-300 shadow-sm">
                {sinFix > 0
                  ? `${sinFix} paquete${sinFix !== 1 ? "s" : ""} sin GPS: se muestra solo la coordenada de la BD`
                  : "Sin lecturas GPS: se muestra solo la coordenada de la BD"}
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col shadow min-h-0">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-0.5 bg-bg-200/50 rounded p-0.5 shrink-0">
                  {([["todos", "Registros"], ["gps", "Registros GPS"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setRegTab(k)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${regTab === k ? "bg-[#00a3e8]/20 text-[#00a3e8]" : "text-text-300 hover:text-text-200"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {regTab === "todos" && (
                  <>
                    <button onClick={onExportCSV} className="text-[10px] hover:text-brand-200 px-1.5 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar CSV">CSV</button>
                    <button onClick={onExportPDF} className="text-[10px] hover:text-brand-200 px-1.5 py-0.5 rounded hover:bg-bg-100 transition-colors" title="Exportar PDF">PDF</button>
                    {(promSenal.snr != null || promSenal.rssi != null) && (
                      <span className="text-[10px] text-text-300 border-l border-border/30 pl-2 ml-0.5 truncate"
                        title={`Promedio de la mejor señal en los últimos ${promSenal.n} registros`}>
                        prom. {promSenal.n}: <span className="font-mono text-text-200">SNR {promSenal.snr != null ? promSenal.snr.toFixed(1) : '—'} dB</span>
                        {' · '}
                        <span className="font-mono text-text-200">RSSI {promSenal.rssi != null ? promSenal.rssi.toFixed(0) : '—'} dBm</span>
                      </span>
                    )}
                  </>
                )}
                {regTab === "gps" && (
                  <span className="text-[10px] text-text-300 truncate" title="Cada paquete GPS del equipo (1 por semana). Incluye los que llegaron sin GPS (0,0).">
                    {conCoordLista} con coordenada · <span className={sinFixLista > 0 ? "text-amber-400" : ""}>{sinFixLista} sin GPS</span>
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-text-100 tabular-nums shrink-0">
                {regTab === "gps" ? gpsPaquetes.length : (telemetryData?.telemetry?.length || 0)}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {regTab === "gps" ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                    <th className="text-left py-2 px-2 font-medium">Fecha</th>
                    <th className="text-left py-2 px-2 font-medium">GPS</th>
                    <th className="text-right py-2 px-2 font-medium">Latitud</th>
                    <th className="text-right py-2 px-2 font-medium">Longitud</th>
                    <th className="text-right py-2 px-2 font-medium">Sats</th>
                    <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Bat<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                    <th className="text-left py-2 px-2 font-medium">Gateways</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsPaquetes.map((p, i) => (
                    <tr key={p.ts}
                      onClick={p.sin_fix ? undefined : () => setFocusGps({ ts: p.ts, tick: Date.now() })}
                      title={p.sin_fix ? "Punto sin GPS (0,0): no se puede ubicar en el mapa" : "Ver este punto en el mapa"}
                      className={`${p.sin_fix ? "bg-amber-500/5" : i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} ${p.sin_fix ? "cursor-default" : "cursor-pointer"} ${focusGps?.ts === p.ts ? "ring-1 ring-emerald-400/50" : ""} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                      <td className="py-1.5 px-2 text-text-200 font-mono text-[10px] whitespace-nowrap"
                        title={format(new Date(p.ts), "dd/MM/yyyy HH:mm:ss")}>
                        {format(new Date(p.ts), "dd/MM HH:mm")}
                      </td>
                      <td className="py-1.5 px-2 text-[10px] whitespace-nowrap">
                        {p.sin_fix
                          ? <span className="text-amber-400 font-semibold" title="Llegó sin GPS: coordenada 0, 0">sin GPS</span>
                          : <span className="text-emerald-400 font-semibold" title="Coordenada válida">OK</span>}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono text-[10px] ${p.sin_fix ? "text-amber-400/80" : "text-text-100"}`}>
                        {p.lat != null ? p.lat.toFixed(6) : "—"}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono text-[10px] ${p.sin_fix ? "text-amber-400/80" : "text-text-100"}`}>
                        {p.lng != null ? p.lng.toFixed(6) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] text-text-100">{p.satelites ?? "—"}</td>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-text-100 whitespace-nowrap">{formatBattery(p.bateria_mv)}</td>
                      <td className="py-1.5 px-2">
                        {p.gateways.length > 0 ? (
                          <span className="flex items-center gap-1 flex-wrap">
                            {p.gateways.map((gw, gi) => (
                              <span key={gi}
                                className="text-[10px] bg-bg-300/40 px-1 py-0.5 rounded font-mono text-text-200"
                                title={`${gw.name || gw.eui || "GW"}${gw.snr != null ? ` · SNR ${Number(gw.snr).toFixed(1)}` : ""}${gw.rssi != null ? ` · RSSI ${Number(gw.rssi).toFixed(0)}` : ""}`}>
                                {gw.name || (gw.eui ? gw.eui.slice(-6) : `GW${gi + 1}`)}
                              </span>
                            ))}
                          </span>
                        ) : <span className="text-text-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg-200 text-text-300 uppercase tracking-wider text-[9px]">
                  <th className="text-left py-2 px-2 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 font-medium"><MonitorBatteryPopup><span className="flex items-center gap-1 cursor-help">Bat<svg className="w-3 h-3 text-text-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span></MonitorBatteryPopup></th>
                  <th className="text-left py-2 px-2 font-medium">Mov</th>
                  <th className="text-right py-2 px-2 font-medium">SNR</th>
                  <th className="text-right py-2 px-2 font-medium">RSSI</th>
                  <th className="text-left py-2 px-2 font-medium">Gateways</th>
                </tr>
              </thead>
              <tbody>
                {telemetryData?.telemetry?.map((t: any, i: number) => (
                  <tr key={t.id} className={`${i % 2 === 0 ? "bg-bg-100" : "bg-bg-200/30"} hover:bg-bg-200/60 transition-colors border-b border-border/20`}>
                    <td className="py-1.5 px-2 text-text-200 font-mono text-[10px] whitespace-nowrap">{format(new Date(t.ts), "dd HH:mm")}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-text-100">{formatBattery(t.object?.voltage_mV)}</td>
                    <td className="py-1.5 px-2">
                      {t.object?.packetType?.startsWith?.('COMMAND')
                        ? <span className="text-cyan-400 font-semibold text-[10px]" title={t.object.systemMessage || ''}>{t.object.systemMessage || t.object.packetType}</span>
                        : t.object?.packetType === 'CONFIG_REPORT'
                          ? <span className="text-purple-400 font-semibold text-[10px]">Config Report</span>
                          : t.object?.packetType === 'QA_VALIDATION'
                            ? <span className="text-purple-400 font-semibold text-[10px]">QA Validación</span>
                            : t.object?.systemStatus?.freeFallFlag ? <span className="text-red-400" title="Caída libre">●</span>
                              : t.object?.systemStatus?.motionFlag ? <span className="text-yellow-400" title="Movimiento">●</span>
                                : (t.object?.latitude != null || t.object?.longitude != null)
                                  ? (Number(t.object?.latitude) === 0 && Number(t.object?.longitude) === 0
                                      ? <span className="text-amber-400" title="Paquete GPS sin GPS: llegó con coordenada 0, 0">◎</span>
                                      : <span className="text-emerald-400" title={`GPS con coordenada · ${t.object?.satellites ?? '—'} satélites`}>◎</span>)
                                  : t.object?.voltage_mV != null && t.object?.temperature_C != null ? <span className="text-green-400" title="KeepAlive">●</span>
                                    : <span className="text-text-300">○</span>}
                    </td>
                    {(() => { const { snr, rssi } = mejorSenal(t.rxinfo); return (
                      <>
                        <td className="py-1.5 px-2 text-right font-mono text-[10px] text-text-100">{snr != null ? snr.toFixed(1) : '—'}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-[10px] text-text-100">{rssi != null ? rssi.toFixed(0) : '—'}</td>
                      </>
                    ); })()}
                    <td className="py-1.5 px-2">
                      {Array.isArray(t.rxinfo) && t.rxinfo.length > 0
                        ? <span className="flex items-center gap-1 flex-wrap">{t.rxinfo.map((gw: any, gi: number) => {
                            const name = gwNameMap.get(gw.gatewayId) || gwNameMap.get(gw.gatewayId?.slice(-6)) || gw.gatewayId?.slice(-6) || `GW${gi + 1}`;
                            return <span key={gi} className="text-[10px] bg-bg-300/40 px-1 py-0.5 rounded font-mono text-text-200">{name}</span>;
                          })}</span>
                        : <span className="text-text-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {regTab === "gps"
              ? (!trackLoading && gpsPaquetes.length === 0 &&
                  <p className="text-center text-[11px] py-6 text-text-300">Sin registros GPS</p>)
              : (
                <>
                  {!isLoading && (!telemetryData?.telemetry || telemetryData.telemetry.length === 0) &&
                    <p className="text-center text-[11px] py-6">Sin registros</p>}
                  {isLoading &&
                    <div className="flex justify-center py-4"><span className="text-[10px] text-brand-200 animate-pulse">Cargando...</span></div>}
                </>
              )}
          </div>
        </div>
      </div>

      <div className="grid grid-rows-[0.9fr_1.1fr] gap-2 min-h-0">
        <div className="bg-bg-100 border border-border/30 rounded-lg overflow-hidden flex flex-col min-h-0 shadow">
          <div className="border-b border-border/30 shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold text-text-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Alertas del dispositivo
              </p>
              <span className="text-sm font-bold text-text-100">{deviceAlerts?.length || 0}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {deviceAlerts && deviceAlerts.length > 0 ? (
              deviceAlerts.map((alert: any) => {
                const typeColors: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
                  critica:            { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Crítica' },
                  atencion:           { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Atención' },
                  apertura:           { bg: 'bg-red-500/8', border: 'border-red-500/40', dot: 'bg-red-500', text: 'text-red-300', label: 'Apertura' },
                  presencia:          { bg: 'bg-yellow-500/8', border: 'border-yellow-500/40', dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Presencia' },
                  movimientos_anomalos: { bg: 'bg-purple-500/8', border: 'border-purple-500/40', dot: 'bg-purple-500', text: 'text-purple-300', label: 'Mov. anómalo' },
                  desconexionGW:      { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'GW desconectado' },
                  desconexionGPS:     { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'GPS desconectado' },
                  desconexion220:     { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'CA 220 desconectado' },
                  desconexionbatGW:   { bg: 'bg-orange-500/8', border: 'border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-300', label: 'Batería GW desconectada' },
                };
                const c = typeColors[alert.type] || { bg: 'bg-border/10', border: 'border-border/30', dot: 'bg-border', text: 'text-text-300', label: alert.type };
                const isResolved = alert.status === 'resolved' || alert.status_system === 'resolved';

                return (
                  <div key={alert.id}
                    className={`flex items-start gap-2 text-[12px] leading-snug rounded px-2 py-1.5 border-s-2 ${c.border} ${c.bg} ${isResolved ? 'opacity-50' : ''}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot} ${isResolved ? '' : 'animate-pulse'} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase ${c.text}`}>{c.label}</span>
                        {isResolved && <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 rounded">Resuelta</span>}
                        {alert.status_system === 'active' && alert.type === 'critica' && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 rounded">Activa</span>
                        )}
                        <span className="ml-auto text-[10px] font-medium text-text-200 bg-bg-300/40 px-1.5 py-0.5 rounded">{format(new Date(alert.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      {alert.metadata?.reason && <p className="text-[11px] leading-snug mt-1">{alert.metadata.reason}</p>}
                      {alert.user_reason && <p className="text-[10px] italic mt-1">"{alert.user_reason}"</p>}
                      {alert.resolved_at && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-green-500/60">Resuelta: {format(new Date(alert.resolved_at), "dd/MM HH:mm")}</span>
                          {alert.resolved_by_name && <span className="text-[10px] text-text-300">por {alert.resolved_by_name}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-[13px]">Sin alertas</p>
                  <p className="text-[10px] mt-1">Este dispositivo no tiene alertas registradas</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-rows-2 gap-2 min-h-0">
          <div className="bg-bg-100/80 border border-border/30 rounded-xl p-2.5 shadow-sm flex flex-col min-h-0 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-text-100 pl-2 mb-1 shrink-0 tracking-wider uppercase">Batería y Temperatura</p>
            <div className="flex-1 min-h-0">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradVoltage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#07b3d1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#07b3d1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e64343" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#e64343" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip content={<MonitorChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }} verticalAlign="top" iconType="circle" iconSize={7} />
                    <Area type="monotone" dataKey="voltage" stroke="#07b3d1" strokeWidth={2} fill="url(#gradVoltage)" dot={false} connectNulls activeDot={{ r: 3, stroke: '#07b3d1', strokeWidth: 2, fill: '#1a1d23' }} name="Batería (mV)" animationDuration={600} />
                    <Area type="monotone" dataKey="temperature" stroke="#e64343" strokeWidth={2} fill="url(#gradTemp)" dot={false} connectNulls activeDot={{ r: 3, stroke: '#e64343', strokeWidth: 2, fill: '#1a1d23' }} name="Temperatura (°C)" animationDuration={600} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-text-300">
                  {isLoading ? 'Cargando datos...' : 'Selecciona un rango mayor para ver el gráfico'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg-100/80 border border-border/30 rounded-xl p-2.5 shadow-sm flex flex-col min-h-0 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-text-100 pl-2 mb-1 shrink-0 tracking-wider uppercase">SNR / RSSI por Gateway</p>
            <div className="flex-1 min-h-0">
              {signalKeys.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      {signalKeys.map((key) => {
                        const gradientId = `gradSignal-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;
                        return (
                          <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={signalColorFor(key)} stopOpacity={0.22} />
                            <stop offset="95%" stopColor={signalColorFor(key)} stopOpacity={0} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip content={<MonitorChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }} verticalAlign="top" iconType="circle" iconSize={7} />
                    {signalKeys.map((key) => {
                      const gradientId = `gradSignal-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;
                      return (
                        <Area key={key} type="monotone" dataKey={key} stroke={signalColorFor(key)} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} connectNulls activeDot={{ r: 3, stroke: signalColorFor(key), strokeWidth: 2, fill: '#1a1d23' }} name={signalLabelFor(key)} animationDuration={600} />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-text-300">
                  {isLoading ? 'Cargando datos...' : 'Sin series de señal disponibles'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
