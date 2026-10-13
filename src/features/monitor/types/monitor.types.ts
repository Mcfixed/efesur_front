export interface MonitorSummary {
  totalSensores: number; cobertura: number; activosHoy: number;
  criticas: number; atencion: number; apertura: number; presencia: number;
  movimientos: number; desconexion: number;
}

export interface MonitorSensorDay { dia: string; activos: number; }
export interface MonitorAlertDay { dia: string; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number; }
export interface MonitorCalendarDay { dia: number; total: number; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number; }
export interface MonitorAlertDetail { id: number; type: string; status: string; metadata: any; created_at: string; device_name: string; type_device: string; }
export interface MonitorDevice { id: number; dev_eui: string; name: string; type_device: string; is_active: boolean; last_seen: string; latitude_current: number; longitude_current: number; last_value: string; id_device_father?: number | null; operating_mode?: string | null; }

export interface SystemServiceStatus {
  key: string; label: string; online: boolean; latencyMs: number;
  detail?: string | null; error?: string | null;
}
export interface SystemServicesStatus {
  checkedAt: string; total: number; online: number; offline: number;
  services: SystemServiceStatus[];
}

// ─── Reporte de un día (Excel del mapa de calor): una fila por sensor activo ───
// Si el sensor no reportó ese día, ultimo_ts/bat_mv/snr/rssi/gw_* llegan en null.
export interface MonitorDayGateway {
  eui: string;
  name: string | null;
  snr: number | null;
  rssi: number | null;
}
export interface MonitorDaySensor {
  id: number; name: string; dev_eui: string;
  last_seen_global: string | null;
  ultimo_ts: string | null;
  bat_mv: number | null;
  temp_c: number | null;
  gw_eui: string | null;
  gw_name: string | null;
  snr: number | null;
  rssi: number | null;
  // Gateways que recibieron el último dato del día, ordenados por mejor señal
  gateways: MonitorDayGateway[] | null;
}
export interface MonitorDayReport {
  dia: string; total: number; conDatos: number; sinDatos: number;
  sensores: MonitorDaySensor[];
}
