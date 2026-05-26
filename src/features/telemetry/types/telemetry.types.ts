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

export interface TelemetryHourlyStat {
  hour: string;
  record_count: number;
  avg_temperature: number;
  max_temperature: number;
  min_temperature: number;
  avg_speed: number;
  max_speed: number;
  avg_fuel: number;
  min_fuel: number;
  max_fuel: number;
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
