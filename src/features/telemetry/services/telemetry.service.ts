import { apiClient } from "@/apis";
import { 
  SummaryResponse,
  DeviceListItem,
  GpsReviewItem,
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

  getDevicesList: async () => {
    const response = await apiClient.get<{data: DeviceListItem[]}>("/telemetry/devices");
    return response.data.data;
  },

  getGpsDailyReview: async () => {
    const response = await apiClient.get<{data: GpsReviewItem[]}>("/telemetry/devices/gps-review");
    return response.data.data;
  },

  getGpsDailyDetail: async (date: string) => {
    const response = await apiClient.get<{data: { date: string; devices: any[] }}>(`/telemetry/devices/gps-review/${date}`);
    return response.data.data;
  },

  getDevicesFullReport: async () => {
    const response = await apiClient.get<{data: any[]}>("/telemetry/devices/report");
    return response.data.data;
  },

  getLatestTelemetry: async (limit?: number) => {
    const response = await apiClient.get<{data: any[]}>("/telemetry/devices/latest", { limit });
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

  getDeviceAlerts: async (deviceId: number) => {
    const response = await apiClient.get<{data: any[]}>(`/telemetry/devices/${deviceId}/alerts`);
    return response.data.data;
  },

  getGatewayPositions: async () => {
    const response = await apiClient.get<{data: {id: number; dev_eui: string; name: string; latitude_current: number; longitude_current: number}[]}>("/telemetry/gateways/positions");
    return response.data.data;
  },
};
