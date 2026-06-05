import { apiClient } from "@/apis";
import { 
  SummaryResponse,
  DeviceSearchResult, 
  PaginatedResponse, 
  TelemetryData, 
  TelemetryStats,
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
  getSummary: async () => {
    const response = await apiClient.get<{data: SummaryResponse}>("/telemetry/summary");
    return response.data.data;
  },

  searchDevices: async (params: SearchParams) => {
    const response = await apiClient.get<PaginatedResponse<DeviceSearchResult>>("/telemetry/devices/search", params as Record<string, unknown>);
    return response.data;
  },

  getDeviceTelemetry: async (deviceId: number, params: TelemetryParams) => {
    const response = await apiClient.get<{data: { telemetry: TelemetryData[]; stats: TelemetryStats; limit: number }}>(`/telemetry/devices/${deviceId}/telemetry`, params as Record<string, unknown>);
    return response.data.data;
  },
};
