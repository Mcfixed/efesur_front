// Curva de descarga de la LIT55-12 (12 V 55 Ah/704 Wh, LiFePO4 12,8 V): tensión en reposo → %.
// Solo para lectores con esta batería. Interpolación lineal, saturada en los extremos.
const SOC_CURVE: ReadonlyArray<readonly [volts: number, pct: number]> = [
  [13.60, 100],
  [13.40, 90],
  [13.25, 80],
  [13.15, 70],
  [13.05, 60],
  [12.95, 50],
  [12.85, 40],
  [12.75, 30],
  [12.65, 20],
  [12.40, 10],
  [12.00, 0],
];

export const LIT55_12_NOMINAL_V = 12.8;

export function lit5512SocPct(volts: number | null | undefined): number | null {
  if (volts == null || !Number.isFinite(volts)) return null;

  const maxV = SOC_CURVE[0][0];
  const minV = SOC_CURVE[SOC_CURVE.length - 1][0];
  if (volts >= maxV) return 100;
  if (volts <= minV) return 0;

  for (let i = 0; i < SOC_CURVE.length - 1; i++) {
    const [vHi, pHi] = SOC_CURVE[i];
    const [vLo, pLo] = SOC_CURVE[i + 1];
    if (volts <= vHi && volts >= vLo) {
      const f = (volts - vLo) / (vHi - vLo);
      return Math.round(pLo + f * (pHi - pLo));
    }
  }
  return null;
}

export function socColor(pct: number | null): string {
  if (pct == null) return '#6b7280';
  if (pct >= 60) return '#22c55e';
  if (pct >= 30) return '#f97316';
  return '#ef4444';
}

// Fuera del componente para no llamar a Date.now() durante el render.
export function isLectorValueStale(ts: string | null | undefined, maxMs = 5 * 60 * 1000): boolean {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > maxMs;
}
