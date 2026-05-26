import { apiClient } from "@/apis";
import { DashboardData, DeviceLocation, Alert } from "../types/dashboard.types";

export const dashboardService = {
  getDashboardData: async () => {
    const response = await apiClient.get<{data: DashboardData}>("/dashboard");
    return response.data.data;
  },

  getDevicesLocations: async () => {
    const response = await apiClient.get<{data: { count: number; locations: DeviceLocation[] }}>("/dashboard/devices-locations");
    return response.data.data;
  },

  resolveAlert: async (id: number, data: { reason: string; userId: string }) => {
    const response = await apiClient.post<{data: { message: string; alert: Alert }}>(`/dashboard/alerts/${id}/resolve`, data);
    return response.data.data;
  },
};
