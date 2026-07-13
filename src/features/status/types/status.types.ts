export interface StatusSummary {
  totalSensores: number;
  cobertura: number;
  activosHoy: number;
  criticas: number;
  atencion: number;
  movimientos: number;
  desconexion: number;
}

export interface ActiveSensorDay {
  dia: string;
  activos: number;
}

export interface AlertDay {
  dia: string;
  criticas: number;
  atencion: number;
  movimientos: number;
}

export interface CalendarDay {
  dia: number;
  total: number;
  criticas: number;
  atencion: number;
  movimientos: number;
  desconexion: number;
}

export interface AlertDetail {
  id: number;
  type: string;
  status: string;
  metadata: any;
  created_at: string;
  device_name: string;
  dev_eui: string;
  type_device: string;
}
