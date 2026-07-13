import { apiClient } from "@/apis";
import type { StatusSummary, ActiveSensorDay, AlertDay, CalendarDay, AlertDetail } from "../types/status.types";

export const statusService = {
  getSummary: async () => {
    const response = await apiClient.get<{data: StatusSummary}>("/status");
    return response.data.data;
  },
  getActiveSensorsPerDay: async () => {
    const response = await apiClient.get<{data: ActiveSensorDay[]}>("/status/active-sensors");
    return response.data.data;
  },
  getAlertsPerDay: async () => {
    const response = await apiClient.get<{data: AlertDay[]}>("/status/alerts-per-day");
    return response.data.data;
  },
  getAlertsCalendar: async (year: number, month: number) => {
    const response = await apiClient.get<{data: CalendarDay[]}>("/status/alerts-calendar", { year, month });
    return response.data.data;
  },
  getAlertsByDate: async (date: string) => {
    const response = await apiClient.get<{data: AlertDetail[]}>("/status/alerts-by-date", { date });
    return response.data.data;
  },
  getAlertTracking: async (alertId: number) => {
    const response = await apiClient.get<{data: any[]}>(`/status/tracking/${alertId}`);
    return response.data.data;
  },
};
