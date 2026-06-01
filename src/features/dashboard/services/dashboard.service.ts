import { apiClient } from "@/apis";
import { DashboardData, DeviceLocation, Alert, GatewayDevice } from "../types/dashboard.types";

export const dashboardService = {
  getDashboardData: async () => {
    const response = await apiClient.get<{data: DashboardData}>("/dashboard");
    return response.data.data;
  },

  getDevicesLocations: async () => {
    const response = await apiClient.get<{data: { count: number; locations: DeviceLocation[] }}>("/dashboard/devices-locations");
    return response.data.data;
  },

  getGatewayStatus: async () => {
    const response = await apiClient.get<{data: { count: number; gateways: GatewayDevice[] }}>("/dashboard/gateways");
    return response.data.data;
  },

  resolveAlert: async (id: number, data: { reason: string }) => {
    const response = await apiClient.post<{data: { message: string; alert: Alert }}>(`/dashboard/alerts/${id}/resolve`, data);
    return response.data.data;
  },

  getAlertHistory: async (type: string, range: string) => {
    const response = await apiClient.get<{data: { count: number; alerts: any[] }}>(`/dashboard/alerts/history`, { type, range });
    return response.data.data;
  },

  getAlertTimeline: async (range: string) => {
    const response = await apiClient.get<{data: { total: number; summary: any; alerts: any[] }}>(`/dashboard/alerts/timeline`, { range });
    return response.data.data;
  },
};
