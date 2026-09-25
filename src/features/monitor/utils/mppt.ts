// El firmware del MPPT (Victron SmartSolar) reporta valores "centinela" cuando no puede
// medir: voltaje/energía → 655.35 (0xFFFF), corriente int16 → 327.67 (0x7FFF), potencia →
// 65535, estados/códigos → 255. Las funciones devuelven null en esos casos para que la UI
// muestre "—" en vez de valores absurdos.

export const cleanVoltage = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 500 ? null : v;

export const cleanCurrent = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || Math.abs(v) >= 300 ? null : v;

export const cleanPower = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 50000 ? null : v;

export const cleanState = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v >= 255 ? null : v;

export const cleanTemp = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || Math.abs(v) >= 200 ? null : v;

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

export const isBatteryDisconnected = (mppt: Record<string, any> = {}): boolean => {
  // Voltaje centinela = no medible
  const v = mppt?.batteryVoltage_V;
  return v == null || v >= 500;
};
