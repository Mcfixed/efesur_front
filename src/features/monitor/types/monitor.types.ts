export interface MonitorSummary {
  totalSensores: number; cobertura: number; activosHoy: number;
  criticas: number; atencion: number; apertura: number; presencia: number;
  movimientos: number; desconexion: number;
}

export interface MonitorSensorDay { dia: string; activos: number; }
export interface MonitorAlertDay { dia: string; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number; }
export interface MonitorCalendarDay { dia: number; total: number; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number; }
export interface MonitorAlertDetail { id: number; type: string; status: string; metadata: any; created_at: string; device_id?: number | null; device_name: string; type_device: string; }
export interface MonitorDevice { id: number; dev_eui: string; name: string; type_device: string; is_active: boolean; last_seen: string; latitude_current: number; longitude_current: number; last_value: string; id_device_father?: number | null; operating_mode?: string | null; battery_v?: number | null; }

export interface SystemServiceStatus {
  key: string; label: string; online: boolean; latencyMs: number;
  detail?: string | null; error?: string | null;
}
export interface SystemServicesStatus {
  checkedAt: string; total: number; online: number; offline: number;
  services: SystemServiceStatus[];
}

// ─── Reporte de un día (Excel del mapa de calor): una fila por sensor activo ───
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

// ─── Anexo SAT "Documento verificación funcionamiento" (ventana de N días) ───
export interface MonitorSatSensor {
  id: number; name: string; dev_eui: string;
  last_seen: string | null;
  latitude_current: number | null;
  longitude_current: number | null;
  operating_mode: string | null;
  registros: number | null;
  dias: number | null;
  primer_ts: string | null;
  huecos: number | null;
  hueco_en_curso?: boolean;
  ultimo_ts: string | null;
  bat_mv: number | null;
  temp_c: number | null;
  sats: number | null;
  gateways: MonitorDayGateway[] | null;
  gw_eui: string | null;
  gw_name: string | null;
  snr: number | null;
  rssi: number | null;
  eventos: number | null;
  ultimo_evento: string | null;
}
export interface MonitorSatGateway {
  id: number; name: string; dev_eui: string;
  is_active: boolean;
  last_seen: string | null;
  firmware_version: string | null;
  uplinks: number | null;
  sensores: number | null;
}
export interface MonitorSatReport {
  desde: string; hasta: string; dias: number;
  sensores: MonitorSatSensor[];
  gateways: MonitorSatGateway[];
}

// ─── Uptime de gateways: caídas del período por gateway (tabla del panel técnico) ───
export interface MonitorGatewayUptime {
  id: number; name: string; dev_eui: string;
  is_active: boolean;
  last_seen: string | null;
  intervalos: { start: string; end: string }[];
}
export interface MonitorGatewaysUptime {
  dias: number;
  desde: string | null;
  hasta: string | null;
  gateways: MonitorGatewayUptime[];
}

// ─── Recorrido de un tracker (LillieGo) ───
export interface MonitorTrackGateway {
  eui: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  rssi: number | null;
  snr: number | null;
}
export interface MonitorTrackPoint {
  ts: string;
  lat: number;
  lng: number;
  alt: number | null;
  bateria_mv: number | null;
  n_gw: number;
  gateways: MonitorTrackGateway[];
  rssi: number | null;
  snr: number | null;
}
export interface MonitorDeviceTrack {
  device: { id: number; name: string; dev_eui: string; type_device: string } | null;
  desde: string;
  hasta: string;
  total_registros: number;
  puntos: MonitorTrackPoint[];
  resumen: { puntos: number; sin_fix: number; gw_promedio: number; distancia_km: number };
}
