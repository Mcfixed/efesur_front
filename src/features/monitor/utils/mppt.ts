/**
 * Utilidades para valores de telemetría MPPT (Victron SmartSolar).
 *
 * Cuando la batería está desconectada o el MPPT no puede medir, el firmware
 * reporta valores "centinela" (valores máximos de uint16/int16) en lugar de
 * datos reales:
 *   - Voltaje / corriente / energía  → 655.35  (0xFFFF, sentinel de float)
 *   - Corriente (int16)              → 327.67  (0x7FFF)
 *   - Potencia (uint16)              → 65535   (0xFFFF)
 *   - Estados / códigos              → 255     (0xFF)
 *
 * Estas funciones devuelven `null` cuando el valor es inválido, para que la UI
 * muestre "—" en lugar de valores absurdos (65535W, 655.35V, 327.67A).
 */

/** Voltaje/energía válido (excluye sentinel 655.35 y cualquier valor >= 500V) */
export const cleanVoltage = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 500 ? null : v;

/** Corriente válida (excluye sentinel 327.67 y valores absurdos > 300A) */
export const cleanCurrent = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || Math.abs(v) >= 300 ? null : v;

/** Potencia válida (excluye sentinel 65535 y valores absurdos > 50000W) */
export const cleanPower = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 50000 ? null : v;

/** Estado/código válido (excluye 255 = "desconocido" del protocolo) */
export const cleanState = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 255 ? null : v;

/** Temperatura válida (excluye sentinels -655.35 / 655.35) */
export const cleanTemp = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || Math.abs(v) >= 200 ? null : v;

/** Aplica saneamiento a un objeto Mppt completo, devolviendo un objeto limpio */
export const cleanMppt = (mppt: Record<string, any> = {}) => ({
  deviceMode: mppt.deviceMode,
  loadCurrent_A: cleanCurrent(mppt.loadCurrent_A),
  loadState: cleanState(mppt.loadState),
  loadStateText: mppt.loadStateText,
  yieldTotal_kWh: cleanVoltage(mppt.yieldTotal_kWh),
  trackerMode: cleanState(mppt.trackerMode),
  errorText: mppt.errorText,
  batteryCurrent_A: cleanCurrent(mppt.batteryCurrent_A),
  daySequence: mppt.daySequence,
  offReasonText: mppt.offReasonText,
  batteryVoltage_V: cleanVoltage(mppt.batteryVoltage_V),
  trackerModeText: mppt.trackerModeText,
  panelVoltage_V: cleanVoltage(mppt.panelVoltage_V),
  panelPower_W: cleanPower(mppt.panelPower_W),
  chargeState: cleanState(mppt.chargeState),
  yieldToday_kWh: cleanVoltage(mppt.yieldToday_kWh),
  chargeStateText: mppt.chargeStateText,
  offReasonVal: mppt.offReasonVal,
  deviceModeText: mppt.deviceModeText,
  maxPowerYesterday_W: cleanPower(mppt.maxPowerYesterday_W),
  errorCode: cleanState(mppt.errorCode),
  maxPowerToday_W: cleanPower(mppt.maxPowerToday_W),
  internalTemp_C: cleanTemp(mppt.internalTemp_C),
  yieldYesterday_kWh: cleanVoltage(mppt.yieldYesterday_kWh),
});

/** ¿El MPPT está reportando que la batería está desconectada? */
export const isBatteryDisconnected = (mppt: Record<string, any> = {}): boolean => {
  // Batería desconectada = voltaje centinela (no medible) o loadState sentinel
  const v = mppt?.batteryVoltage_V;
  return v == null || v >= 500;
};
