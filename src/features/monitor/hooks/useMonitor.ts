import { useQuery } from "@tanstack/react-query";
import { monitorService } from "../services/monitor.service";

const KEYS = { all: ["monitor"] as const };

export const useMonitorSummary = () => useQuery({ queryKey: [...KEYS.all, "summary"], queryFn: () => monitorService.getSummary(), refetchInterval: 30000 });
export const useMonitorActiveSensors = () => useQuery({ queryKey: [...KEYS.all, "active-sensors"], queryFn: () => monitorService.getActiveSensors(), refetchInterval: 60000 });
export const useMonitorAlertsPerDay = () => useQuery({ queryKey: [...KEYS.all, "alerts-per-day"], queryFn: () => monitorService.getAlertsPerDay(), refetchInterval: 60000 });
export const useMonitorCalendar = (year: number, month: number) => useQuery({ queryKey: [...KEYS.all, "calendar", year, month], queryFn: () => monitorService.getCalendar(year, month), refetchInterval: 60000 });
export const useMonitorAlertsByDate = (date: string | null) => useQuery({ queryKey: [...KEYS.all, "alerts-by-date", date], queryFn: () => monitorService.getAlertsByDate(date!), enabled: !!date });
export const useMonitorDevices = () => useQuery({ queryKey: [...KEYS.all, "devices"], queryFn: () => monitorService.getDevices(), refetchInterval: 30000 });
export const useMonitorDeviceTelemetry = (deviceId: number | null, params?: { from?: string; limit?: number; offset?: number }) => useQuery({ queryKey: [...KEYS.all, "telemetry", deviceId, params], queryFn: () => monitorService.getDeviceTelemetry(deviceId!, params), enabled: !!deviceId, refetchInterval: 15000 });
export const useMonitorDeviceAlerts = (deviceId: number | null) => useQuery({ queryKey: [...KEYS.all, "alerts", deviceId], queryFn: () => monitorService.getDeviceAlerts(deviceId!), enabled: !!deviceId, refetchInterval: 30000 });
export const useMonitorGatewayPositions = () => useQuery({ queryKey: [...KEYS.all, "gateways"], queryFn: () => monitorService.getGatewayPositions(), staleTime: 300000 });
export const useMonitorAlertTracking = (alertId: number | null) => useQuery({ queryKey: [...KEYS.all, "tracking", alertId], queryFn: () => monitorService.getAlertTracking(alertId!), enabled: !!alertId, refetchInterval: false });
export const useMonitorLatestTelemetry = (limit?: number) => useQuery({ queryKey: [...KEYS.all, "latest", limit], queryFn: () => monitorService.getLatestTelemetry(limit), refetchInterval: 15000 });
