const BATTERY_TABLE = [
  { v: 4.20, p: 100 },
  { v: 4.15, p: 95 },
  { v: 4.11, p: 90 },
  { v: 4.08, p: 80 },
  { v: 4.02, p: 70 },
  { v: 3.98, p: 60 },
  { v: 3.95, p: 50 },
  { v: 3.91, p: 40 },
  { v: 3.87, p: 30 },
  { v: 3.82, p: 20 },
  { v: 3.79, p: 15 },
  { v: 3.75, p: 10 },
  { v: 3.70, p: 5 },
  { v: 3.50, p: 0 },
];

/** Convierte voltaje (en mV) a porcentaje de batería usando interpolación lineal */
export function voltageToPercent(mV: number | null | undefined): number | null {
  if (mV == null) return null;
  const v = mV / 1000;
  if (v >= BATTERY_TABLE[0].v) return BATTERY_TABLE[0].p;
  if (v <= BATTERY_TABLE[BATTERY_TABLE.length - 1].v) return 0;
  for (let i = 0; i < BATTERY_TABLE.length - 1; i++) {
    const a = BATTERY_TABLE[i];
    const b = BATTERY_TABLE[i + 1];
    if (v <= a.v && v >= b.v) {
      const t = (v - a.v) / (b.v - a.v);
      return Math.round(a.p + t * (b.p - a.p));
    }
  }
  return 0;
}

/** Formatea voltaje + porcentaje: "4.02V · 70%" */
export function formatBattery(mV: number | null | undefined): string {
  if (mV == null) return '—';
  const pct = voltageToPercent(mV);
  return `${(mV / 1000).toFixed(2)}V · ${pct}%`;
}

/** Color del texto según porcentaje */
export function batteryColor(mV: number | null | undefined): string {
  const pct = voltageToPercent(mV);
  if (pct == null) return 'text-text-300';
  if (pct >= 50) return 'text-green-400';
  if (pct >= 20) return 'text-orange-400';
  return 'text-red-400';
}

// ─── Batería de la estación (plomo 12 V) ───
// Curva real del banco de los gateways: 14,20 V en carga/absorción → 10,70 V descargado.
const BATERIA_12V_TABLE = [
  { v: 14.20, p: 100 }, // Máximo voltaje en fase de carga (Absorción)
  { v: 14.00, p: 99 },
  { v: 13.80, p: 99 },
  { v: 13.60, p: 98 },  // Batería completamente cargada (en reposo)
  { v: 13.40, p: 95 },
  { v: 13.30, p: 90 },
  { v: 13.25, p: 85 },
  { v: 13.20, p: 80 },
  { v: 13.15, p: 75 },
  { v: 13.10, p: 70 },
  { v: 13.05, p: 65 },
  { v: 13.00, p: 60 },
  { v: 12.95, p: 55 },
  { v: 12.90, p: 50 },
  { v: 12.85, p: 45 },
  { v: 12.80, p: 40 },
  { v: 12.75, p: 35 },
  { v: 12.70, p: 30 },
  { v: 12.65, p: 25 },
  { v: 12.60, p: 20 },
  { v: 12.40, p: 15 },
  { v: 12.00, p: 10 },
  { v: 11.50, p: 5 },
  { v: 10.70, p: 0 },
];

/** Porcentaje del banco de 12 V a partir del voltaje (null si no hay dato válido) */
export function stationBatteryPercent(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v >= 500) return null;
  const V = Number(v);
  const t = BATERIA_12V_TABLE;
  if (V >= t[0].v) return t[0].p;
  const ultimo = t[t.length - 1];
  if (V <= ultimo.v) return ultimo.p;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    if (V <= a.v && V >= b.v) {
      const k = (V - a.v) / (b.v - a.v);
      return Math.round(a.p + k * (b.p - a.p));
    }
  }
  return 0;
}

/** Formatea el voltaje del banco: "13.49V · 62%" */
export function formatStationBattery(v: number | null | undefined): string {
  const pct = stationBatteryPercent(v);
  if (pct == null) return '—';
  return `${Number(v).toFixed(2)}V · ${pct}%`;
}

/** Color del texto según el voltaje del banco (mismos cortes que el panel del gateway) */
export function stationBatteryColor(v: number | null | undefined): string {
  if (stationBatteryPercent(v) == null) return 'text-text-300';
  if (Number(v) >= 12.5) return 'text-green-400';
  if (Number(v) >= 11.8) return 'text-orange-400';
  return 'text-red-400';
}
