import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMonitorDevices, useMonitorLatestTelemetry } from "../../../hooks/useMonitor";
import { IconAlertTriangle } from "@tabler/icons-react";

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
export default function MonitorLectorDashboard({ lectorDeviceId }: { lectorDeviceId?: number | null }) {
  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);

  const lectores = useMemo(() => {
    if (!allDevices) return [];
    let list = allDevices.filter((d: any) => d.type_device === 'Lector');
    if (lectorDeviceId) {
      const specific = list.find((d: any) => d.id === lectorDeviceId);
      if (specific) return [specific];
    }
    return list;
  }, [allDevices, lectorDeviceId]);

  // Extraer datos de telemetría del primer lector
  const dashboardData = useMemo(() => {
    if (!lectores.length || !latestTelemetry) return null;
    const lector = lectores[0];
    const tel = (latestTelemetry || []).filter((t: any) =>
      t.dev_eui?.toLowerCase() === lector.dev_eui.toLowerCase() || t.device_id === lector.id
    );
    console.log('[LectorDash] lectores:', lectores.length, 'tel:', tel.length, 'lector:', lector.name, lector.dev_eui, lector.id, 'sampleTel:', latestTelemetry?.[0]?.device_id, latestTelemetry?.[0]?.dev_eui);
    if (!tel.length) return { tel: [], mpttTel: [], chartData: [], lector, lastT: null, sensores: {}, charger220: {}, vBat: null, pPan: null, iBat: null, iOut: null, loadState: null, chargeState: null, charging: false, charger220State: null, charger220Volt: null, temp: null };
    const lastT = tel.find((t: any) => t.object?.mppt) || tel[0] || null;
    const obj = lastT?.object || {};
    const mppt = obj.mppt || {};
    const mpttTel = tel.filter((t: any) => t.object?.mppt).sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const cd = mpttTel.slice(-120).map((t: any) => ({
      time: format(new Date(t.ts), "HH:mm"),
      volt: t.object?.mppt?.batteryVoltage_V ?? null,
      power: t.object?.mppt?.panelPower_W ?? null,
      current: t.object?.mppt?.batteryCurrent_A ?? null,
    }));
    return {
      tel, mpttTel, chartData: cd, lector, lastT,
      sensores: obj.sensores || {},
      charger220: obj.charger220 || {},
      vBat: mppt.batteryVoltage_V ?? null,
      pPan: mppt.panelPower_W ?? null,
      iBat: mppt.batteryCurrent_A ?? null,
      iOut: mppt.loadCurrent_A ?? null,
      loadState: mppt.loadState ?? null,
      chargeState: mppt.chargeState ?? null,
      pvVolt: mppt.panelVoltage_V ?? null,
      charging: mppt.loadState === 1,
      charger220State: (obj.charger220?.State) || null,
      charger220Volt: obj.charger220?.battery_V ?? null,
      temp: mppt.temp ?? null,
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

  if (lectores.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-300 text-[13px] min-h-50">
        <IconAlertTriangle size={18} className="mr-2 opacity-50" />
        No hay lectores en el sistema
      </div>
    );
  }

  if (!dashboardData) return null;

  const { chartData, lector, lastT, sensores, charger220, vBat, pPan, iBat, iOut, loadState, chargeState, pvVolt, charging, charger220State, charger220Volt, temp } = dashboardData;

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
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 bg-bg-200 rounded-md">
      <style>{`@keyframes flowLine{to{stroke-dashoffset:-24}}@keyframes flowBack{to{stroke-dashoffset:24}}@keyframes pulseLive{0%{transform:scale(1)}50%{transform:scale(2)}100%{transform:scale(1)}}`}</style>

      {/* HEADER */}
      <div className="rounded-lg px-4 py-2.5 flex items-center justify-between bg-bg-100 border border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00a3e8]/10 flex items-center justify-center border border-[#00a3e8]/30">
            <div className="w-2 h-2 rounded-full bg-[#00a3e8] shadow-[0_0_8px_#00a3e8]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-text-100 tracking-wide">{lector.name}</p>
            <p className="text-[10px] text-text-300 font-mono">{lector.dev_eui} · {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {charging && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />}
          <span className="text-[10px] font-bold tracking-wider" style={{ color: charging ? '#22c55e' : '#6b7280' }}>
            {charging ? `CHARGING (${chargeMeta.label.toUpperCase()})` : 'SYSTEM IDLE'}
          </span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* LEFT COLUMN */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          <div className="rounded-lg p-4 flex-1 flex flex-col justify-center bg-bg-100 border border-border/30">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-300 mb-4">Batería Principal</p>
            <div className="flex flex-col items-center gap-4 justify-center">
              <svg width="80" height="80" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="32" fill="none" stroke="#333" strokeWidth="4" />
                <circle cx="36" cy="36" r="32" fill="none" stroke={batColor} strokeWidth="4"
                  strokeDasharray={`${(batPct / 100) * 201} 201`} strokeLinecap="round" transform="rotate(-90 36 36)" 
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
                  background: lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444',
                  opacity: 0.25, animation: 'pulseLive 2s infinite'
                }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{
                  background: lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 8px ${lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'}`
                }} />
              </span>
              <span className="text-[10px] font-bold tracking-wider" style={{
                color: lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'
              }}>LIVE</span>
              <span className="text-[8px] font-mono text-text-400 ml-1">
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
                {pPan > 0 && (
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
                  <rect width="80" height="50" rx="6" fill="none" stroke={pPan > 0 ? '#eab308' : '#555'} strokeWidth={pPan > 0 ? 1.5 : 1} />
                  <rect x="4" y="4" width="72" height="42" rx="4" fill={pPan > 0 ? '#eab308' : '#00a3e8'} opacity={pPan > 0 ? 0.12 : 0.06} />
                  {pPan > 0 && <circle cx="12" cy="11" r="3" fill="#eab308" filter="url(#glowYellow)" />}
                  <text x="40" y="22" textAnchor="middle" fill={pPan > 0 ? '#eab308' : '#888'} fontSize="8" fontWeight="bold">SOLAR</text>
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
                  <text x="40" y="32" textAnchor="middle" fill="#e0e0e0" fontSize="10" fontWeight="bold">BATERÍA</text>
                  <text x="40" y="46" textAnchor="middle" fill="#22c55e" fontSize="9" fontFamily="monospace">{iBat != null ? `+${Math.abs(iBat).toFixed(1)}A` : '—'}</text>
                </g>
                <g transform="translate(170, 15)">
                  <rect width="80" height="30" rx="6" fill="none" stroke={lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'} strokeWidth="1" />
                  <line x1="30" y1="0" x2="30" y2="-10" stroke="#666" strokeWidth="2" />
                  <line x1="50" y1="0" x2="50" y2="-10" stroke="#666" strokeWidth="2" />
                  <circle cx="12" cy="15" r="3" fill={lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'} filter={lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? 'url(#glowGreen)' : undefined} />
                  <text x="40" y="20" textAnchor="middle" fill="#aaa" fontSize="8" fontWeight="bold">UG65 GW</text>
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
                  {charging ? 'CARGANDO' : pPan > 0 ? 'ACTIVO' : 'INACTIVO'}
                </text>
                <circle cx="210" cy="178" r="3" fill={lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'} />
                <text x="217" y="181" fill={lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? '#22c55e' : '#ef4444'} fontSize="7" fontWeight="bold">
                  {lastT?.ts && Date.now() - new Date(lastT.ts).getTime() < 300000 ? 'GW ONLINE' : 'GW OFFLINE'}
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
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sensores.openingDoorSensor === 1 ? '#ef4444' : '#22c55e' }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: sensores.openingDoorSensor === 1 ? '#ef4444' : '#22c55e' }}>{sensores.openingDoorSensor === 1 ? 'OPEN' : 'CLOSED'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-bg-200/50 border border-border/20">
                <span className="text-[10px] text-text-200">Proximidad</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sensores.presenseSensor === 1 ? '#eab308' : '#6b7280' }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: sensores.presenseSensor === 1 ? '#eab308' : '#6b7280' }}>{sensores.presenseSensor === 1 ? 'DETECTED' : 'CLEAR'}</span>
                </div>
              </div>
            </div>
          </div>
          <SparklineChart data={chartData} dataKey="power" color="#eab308" title="Potencia Solar" unit="W" />
        </div>
      </div>
    </div>
  );
}
