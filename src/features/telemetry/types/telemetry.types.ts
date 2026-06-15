export interface SensorSummary {
  type_device: string;
  total: number;
  disconnected: number;
}

export interface GpsModeBreakdown {
  mode: string;
  count: number;
}

export interface SummaryResponse {
  types: SensorSummary[];
  gpsModes: GpsModeBreakdown[];
}

export interface DeviceListItem {
  id: number;
  dev_eui: string;
  name: string;
  type_device: string;
  is_active: boolean;
  last_seen: string;
  company_id: number;
  company_name: string;
  voltage_mv: number;
  battery_pct: number;
}

export interface GpsReviewItem {
  review_date: string;
  total: number;
  activos: number;
  bateria_buena: number;
  bateria_mala: number;
}

export interface TelemetryData {
  id: string;
  device_id: number;
  ts: string;
  object: Record<string, any>;
  rxinfo: Record<string, any>;
}

export interface TelemetryStats {
  total_records: number;
  first_record: string;
  last_record: string;
}

export interface DeviceSearchResult {
  id: number;
  dev_eui: string;
  name: string;
  type_device: string;
  is_active: boolean;
  last_seen: string;
  company_id: number;
  company_name: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
}
