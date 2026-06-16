export interface GpsDevice {
  id: number;
  dev_eui: string;
  name: string;
  type_device: string;
  latitude_current: number;
  longitude_current: number;
  last_seen: string;
  is_active: boolean;
  battery: number;
  accelerometers_status: string;
  operating_mode: string;
  company_name: string;
  best_snr?: number;
  catenaria_linea?: string;
  catenaria_orden?: number;
}

export interface TrackingPoint {
  timestamp: string;
  battery: number;
  latitude: number;
  longitude: number;
  metadata: Record<string, any>;
}

export interface Alert {
  id: number;
  device_id: number;
  type: 'critica' | 'atencion' | 'movimientos_anomalos';
  status: 'active' | 'resolved';
  metadata: Record<string, any>;
  created_at: string;
  device_name: string;
  latitude_current: number;
  longitude_current: number;
  resolved_by_name?: string;
  tracking_data?: TrackingPoint[];
}

export interface DashboardSummary {
  totalGpsDevices: number;
  criticalAlertsCount: number;
  atencionAlertsCount: number;
  desconexionGWCount: number;
  movimientosAnomalosCount: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  devices: GpsDevice[];
  alerts: {
    critical: Alert[];
    atencion: Alert[];
    desconexionGW: Alert[];
    movimientos_anomalos: Alert[];
  };
}

export interface DeviceLocation {
  id: number;
  name: string;
  dev_eui: string;
  type_device: string;
  latitude_current: number;
  longitude_current: number;
  last_seen: string;
  battery: number;
  accelerometers_status: string;
  has_alert: boolean;
  alert_type: string | null;
}

export interface GatewayDevice {
  id: number;
  dev_eui: string;
  name: string;
  company_id: number;
  company_name: string;
  latitude_current: number;
  longitude_current: number;
  last_seen: string;
  is_active: boolean;
  ip_internal: string;
  firmware_version: string;
  is_online: boolean;
}
