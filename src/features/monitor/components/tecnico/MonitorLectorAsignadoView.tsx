import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMonitorDevices, useMonitorLatestTelemetry } from "../../hooks/useMonitor";
import { IconBattery, IconSolarPanel, IconPlug, IconDoor, IconEye, IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";

type MpptData = {
  voltaje_bateria?: number;
  corriente_bateria?: number;
  voltaje_panel?: number;
  potencia_panel?: number;
  estado_salida_carga?: string;
  corriente_salida_carga?: number;
  estado_carga?: string;
  codigo_error_hardware?: number;
  modo_algoritmo_mptt?: number;
  modo_dispositivo?: number;
  razon_apagado?: string;
  state_of_charge?: number;
  "Código de error"?: number;
};

type Salida220Data = { estado?: string; error?: string; bateria_220_v?: number; corriente_220_v?: number };
type DevicesData = { estado_sensor_puerta?: number; estado_sensor_proximidad?: number };
type LectorObject = { mppt?: MpptData; salida_220?: Salida220Data; devices?: DevicesData };

const SOC_LABELS: Record<number, string> = { 0: "—", 1: "Fault", 2: "Carga inicial", 3: "Absorción", 4: "Flotación" };

// ─── Gauge semicircular ───
function Gauge({ value, min, max, unit, label, color, size = 80 }: { value: number; min: number; max: number; unit: string; label: string; color: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circ = Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#374151" strokeWidth={6} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#e5e7eb" fontSize="11" fontFamily="monospace" fontWeight="bold">{value.toFixed(1)}{unit}</text>
      </svg>
      <span className="text-[8px] text-text-400 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Barra de progreso ───
function ProgressBar({ value, min, max, color, label, unit }: { value: number; min: number; max: number; color: string; label: string; unit?: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-text-400">{label}</span>
        <span className="text-[9px] font-bold font-mono text-text-200">{value.toFixed(2)}{unit}</span>
      </div>
      <div className="h-2.5 bg-bg-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Indicador de estado ───
function StateIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold" style={{ background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: ok ? '#22c55e' : '#ef4444' }}>
      {ok ? <IconCheck size={12} /> : <IconX size={12} />}
      {label}
    </div>
  );
}

// ─── Chip ───
function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: `${color || '#6b7280'}20`, color: color || '#9ca3af' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color || '#9ca3af' }} />{label}
    </span>
  );
}

// ══════════════════════════════════════════
// MPPT CARD
// ══════════════════════════════════════════
function MpptCard({ data }: { data?: MpptData }) {
  if (!data) return null;
  const vBat = data.voltaje_bateria ?? 0;
  const vPan = data.voltaje_panel ?? 0;
  const pPan = data.potencia_panel ?? 0;
  const iBat = data.corriente_bateria ?? 0;
  const iOut = data.corriente_salida_carga ?? 0;
  const charging = data.estado_carga?.toUpperCase() === 'ON';
  const outputOn = data.estado_salida_carga?.toUpperCase() === 'ON';
  const soc = data.state_of_charge ?? 0;
  const hasError = (data.codigo_error_hardware ?? 0) > 0 || (data["Código de error"] ?? 0) > 0;
  const batColor = vBat >= 12.5 ? '#22c55e' : vBat >= 11.8 ? '#f97316' : '#ef4444';

  return (
    <div className="bg-bg-100 border border-border/30 rounded-xl overflow-hidden shadow-sm">
      <div className="border-b border-border/20 px-3 py-2 flex items-center gap-2">
        <IconSolarPanel size={15} className="text-yellow-400" />
        <span className="text-[10px] font-bold text-text-200 uppercase tracking-wider">MPPT — Controlador Solar</span>
        {hasError && <span className="ml-auto text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Error HW</span>}
      </div>
      <div className="p-3 space-y-3">
        {/* Gauges row */}
        <div className="flex items-center justify-around">
          <Gauge value={vBat} min={10} max={15} unit="V" label="Batería" color={batColor} />
          <div className="flex flex-col items-center">
            <IconSolarPanel size={24} className="text-yellow-400 mb-1" />
            <span className="text-lg font-bold font-mono text-yellow-400">{pPan}W</span>
            <span className="text-[8px] text-text-400">Panel solar</span>
          </div>
          <Gauge value={vPan} min={0} max={50} unit="V" label="Panel" color="#eab308" />
        </div>
        {/* Progress bars */}
        <div className="space-y-2">
          <ProgressBar value={iBat} min={-5} max={5} color={iBat > 0 ? '#22c55e' : '#f97316'} label="Corriente batería" unit="A" />
          <ProgressBar value={iOut} min={0} max={10} color="#3b82f6" label="Corriente salida" unit="A" />
          <ProgressBar value={vPan} min={0} max={50} color="#eab308" label="Voltaje panel" unit="V" />
        </div>
        {/* Status */}
        <div className="flex flex-wrap gap-1.5">
          <StateIndicator ok={charging} label={`Carga: ${data.estado_carga || 'OFF'}`} />
          <StateIndicator ok={outputOn} label={`Salida: ${data.estado_salida_carga || 'OFF'}`} />
        </div>
        {/* Chips */}
        <div className="flex flex-wrap gap-1">
          <Chip label={SOC_LABELS[soc] || '—'} color={['#6b7280','#ef4444','#f97316','#22c55e','#3b82f6'][soc] || '#6b7280'} />
          {data.razon_apagado ? <Chip label={data.razon_apagado} color="#ef4444" /> : null}
          <Chip label={`MPTT: ${data.modo_algoritmo_mptt ?? 0}`} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// SALIDA 220 CARD
// ══════════════════════════════════════════
function Salida220Card({ data }: { data?: Salida220Data }) {
  if (!data) return null;
  const v220 = data.bateria_220_v ?? 0;
  const i220 = data.corriente_220_v ?? 0;
  const hasError = data.error && data.error !== 'no error' && data.error !== '';
  const isStoring = data.estado === 'ALMACENAMIENTO';

  return (
    <div className="bg-bg-100 border border-border/30 rounded-xl overflow-hidden shadow-sm">
      <div className="border-b border-border/20 px-3 py-2 flex items-center gap-2">
        <IconPlug size={15} className="text-blue-400" />
        <span className="text-[10px] font-bold text-text-200 uppercase tracking-wider">Salida 220V</span>
        {hasError && <span className="ml-auto text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full text-[9px] font-bold">Error</span>}
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center">
            <IconPlug size={22} className="text-blue-400 mb-1" />
            <span className="text-lg font-bold font-mono text-blue-400">{v220.toFixed(1)}V</span>
            <span className="text-[8px] text-text-400">Batería 220V</span>
          </div>
          <div className="flex flex-col items-center">
            <IconBattery size={22} className={isStoring ? 'text-green-400' : 'text-yellow-400'} />
            <span className="text-sm font-bold font-mono" style={{ color: isStoring ? '#22c55e' : '#f97316' }}>{isStoring ? 'Almacenando' : data.estado || '—'}</span>
            <span className="text-[8px] text-text-400">Estado</span>
          </div>
        </div>
        <ProgressBar value={v220} min={0} max={260} color="#3b82f6" label="Tensión" unit="V" />
        <ProgressBar value={i220} min={0} max={20} color="#06b6d4" label="Corriente" unit="A" />
        <StateIndicator ok={!hasError} label={hasError ? `Error: ${data.error}` : 'Sin errores'} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DEVICES CARD
// ══════════════════════════════════════════
function DevicesCard({ data }: { data?: DevicesData }) {
  if (!data) return null;
  const doorOpen = data.estado_sensor_puerta === 1;
  const proxOn = data.estado_sensor_proximidad === 1;

  return (
    <div className="bg-bg-100 border border-border/30 rounded-xl overflow-hidden shadow-sm">
      <div className="border-b border-border/20 px-3 py-2 flex items-center gap-2">
        <IconEye size={15} className="text-purple-400" />
        <span className="text-[10px] font-bold text-text-200 uppercase tracking-wider">Sensores</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl p-4 flex flex-col items-center gap-2 border ${doorOpen ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
            <IconDoor size={28} style={{ color: doorOpen ? '#ef4444' : '#22c55e' }} />
            <span className="text-[12px] font-bold" style={{ color: doorOpen ? '#ef4444' : '#22c55e' }}>{doorOpen ? 'Abierta' : 'Cerrada'}</span>
            <span className="text-[9px] text-text-400">Puerta</span>
          </div>
          <div className={`rounded-xl p-4 flex flex-col items-center gap-2 border ${proxOn ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-gray-500/5 border-gray-500/20'}`}>
            <IconEye size={28} style={{ color: proxOn ? '#eab308' : '#6b7280' }} />
            <span className="text-[12px] font-bold" style={{ color: proxOn ? '#eab308' : '#6b7280' }}>{proxOn ? 'Detectado' : 'Inactivo'}</span>
            <span className="text-[9px] text-text-400">Proximidad</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// LECTOR CARD
// ══════════════════════════════════════════
function LectorCard({ device, telemetry }: { device: any; telemetry: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const lastT = telemetry?.[0];
  const obj: LectorObject = lastT?.object || {};
  const hasMppt = obj.mppt && Object.keys(obj.mppt).length > 0;
  const hasSalida220 = obj.salida_220 && Object.keys(obj.salida_220).length > 0;
  const hasDevices = obj.devices && Object.keys(obj.devices).length > 0;
  const hasData = hasMppt || hasSalida220 || hasDevices;

  return (
    <div className="bg-bg-200/30 border border-border/20 rounded-xl overflow-hidden shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-200/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-linear-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
            <IconSolarPanel size={18} className="text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-text-200">{device.name}</p>
            <p className="text-[9px] text-text-400 font-mono">{device.dev_eui} · {lastT?.ts ? format(new Date(lastT.ts), "dd/MM HH:mm") : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasMppt && <span className="w-2 h-2 rounded-full bg-green-400" />}
          {hasSalida220 && <span className="w-2 h-2 rounded-full bg-blue-400" />}
          {hasDevices && <span className="w-2 h-2 rounded-full bg-purple-400" />}
          <span className={`ml-1 transform transition-transform ${expanded ? 'rotate-180' : ''} text-text-400`}>▼</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/10 pt-3">
          {hasData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hasMppt && <MpptCard data={obj.mppt} />}
              {hasSalida220 && <Salida220Card data={obj.salida_220} />}
              {hasDevices && <DevicesCard data={obj.devices} />}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-text-400 text-[12px]">
              <IconAlertTriangle size={16} className="mr-2" />
              Sin datos de telemetría para este lector
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonitorLectorAsignadoView() {
  const { data: allDevices } = useMonitorDevices();
  const { data: latestTelemetry } = useMonitorLatestTelemetry(5000);
  const lectores = useMemo(() => (allDevices || []).filter(d => d.type_device === 'Lector'), [allDevices]);
  const lectoresWithData = useMemo(() => lectores.map(l => ({ device: l, telemetry: (latestTelemetry || []).filter((t: any) => t.dev_eui?.toLowerCase() === l.dev_eui.toLowerCase() || t.device_id === l.id) })), [lectores, latestTelemetry]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-text-200 flex items-center gap-2"><IconSolarPanel size={18} className="text-amber-400" /> Lectores asignados</h2>
        <p className="text-[11px] text-text-400 mt-1">{lectores.length} lectores · Datos MPPT, salida 220V y sensores</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {lectoresWithData.length > 0 ? lectoresWithData.map(({ device, telemetry }) => <LectorCard key={device.id} device={device} telemetry={telemetry} />) : (
          <div className="flex flex-col items-center justify-center py-20 text-text-400"><IconSolarPanel size={40} className="opacity-30 mb-4" /><p className="text-[13px]">No hay lectores asignados</p></div>
        )}
      </div>
    </div>
  );
}
