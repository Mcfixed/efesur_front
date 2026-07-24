export interface MonitorSummary {
  totalSensores: number; cobertura: number; activosHoy: number;
  criticas: number; atencion: number; apertura: number; presencia: number;
  movimientos: number; desconexion: number;
}

export interface MonitorSensorDay { dia: string; activos: number; }
export interface MonitorAlertDay { dia: string; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; }
export interface MonitorCalendarDay { dia: number; total: number; criticas: number; atencion: number; apertura: number; presencia: number; movimientos: number; desconexion: number; }
export interface MonitorAlertDetail { id: number; type: string; status: string; metadata: any; created_at: string; device_name: string; type_device: string; }
export interface MonitorDevice { id: number; dev_eui: string; name: string; type_device: string; is_active: boolean; last_seen: string; latitude_current: number; longitude_current: number; last_value: string; id_device_father?: number | null; }
