import { apiClient } from "@/apis";
import { 
  DeviceSearchResult, 
  PaginatedResponse, 
  TelemetryData, 
  TelemetryStats, 
  TelemetryHourlyStat 
} from "../types/telemetry.types";

export interface SearchParams {
  q?: string;
  type?: string;
  companyId?: number;
  limit?: number;
  offset?: number;
}

export interface TelemetryParams {
  from?: string;
  to?: string;
  limit?: number;
}

export const telemetryService = {
  getDeviceTypes: async () => {
    const response = await apiClient.get<{data: string[]}>("/telemetry/devices/types");
    return response.data.data;
  },

  searchDevices: async (params: SearchParams) => {
    // paginatedSuccess returns { data, pagination }
    const response = await apiClient.get<PaginatedResponse<DeviceSearchResult>>("/telemetry/devices/search", params as Record<string, unknown>);
    return response.data;
  },

  getDeviceTelemetry: async (deviceId: number, params: TelemetryParams) => {
    const response = await apiClient.get<{data: { telemetry: TelemetryData[]; stats: TelemetryStats; limit: number }}>(`/telemetry/devices/${deviceId}/telemetry`, params as Record<string, unknown>);
    return response.data.data;
  },

  getDeviceTelemetryStats: async (deviceId: number, hours?: number) => {
    const response = await apiClient.get<{data: { deviceId: string; hours: number; stats: TelemetryHourlyStat[] }}>(`/telemetry/devices/${deviceId}/stats`, { hours });
    return response.data.data;
  },
};
