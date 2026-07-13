import { apiClient } from "@/apis";
import type { MonitorSummary, MonitorSensorDay, MonitorAlertDay, MonitorCalendarDay, MonitorAlertDetail, MonitorDevice } from "../types/monitor.types";

export const monitorService = {
  getSummary: async () => {
    const r = await apiClient.get<{data: MonitorSummary}>("/monitor/summary");
    return r.data.data;
  },
  getActiveSensors: async () => {
    const r = await apiClient.get<{data: MonitorSensorDay[]}>("/monitor/active-sensors");
    return r.data.data;
  },
  getAlertsPerDay: async () => {
    const r = await apiClient.get<{data: MonitorAlertDay[]}>("/monitor/alerts-per-day");
    return r.data.data;
  },
  getCalendar: async (year: number, month: number) => {
    const r = await apiClient.get<{data: MonitorCalendarDay[]}>("/monitor/calendar", { year, month });
    return r.data.data;
  },
  getAlertsByDate: async (date: string) => {
    const r = await apiClient.get<{data: MonitorAlertDetail[]}>("/monitor/alerts-by-date", { date });
    return r.data.data;
  },
  getDevices: async () => {
    const r = await apiClient.get<{data: MonitorDevice[]}>("/monitor/devices");
    return r.data.data;
  },
  getDeviceTelemetry: async (deviceId: number, params?: { from?: string; limit?: number; offset?: number }) => {
    const r = await apiClient.get<{data: { telemetry: any[]; total: number }}>(`/monitor/devices/${deviceId}/telemetry`, params as any);
    return r.data.data;
  },
  getDeviceAlerts: async (deviceId: number) => {
    const r = await apiClient.get<{data: any[]}>(`/monitor/devices/${deviceId}/alerts`);
    return r.data.data;
  },
  getGatewayPositions: async () => {
    const r = await apiClient.get<{data: any[]}>("/monitor/gateways/positions");
    return r.data.data;
  },
  getAlertTracking: async (alertId: number) => {
    const r = await apiClient.get<{data: any[]}>(`/monitor/tracking/${alertId}`);
    return r.data.data;
  },
};
