import { useQuery } from "@tanstack/react-query";
import { statusService } from "../services/status.service";

const STATUS_KEYS = {
  all: ["status"] as const,
  summary: () => [...STATUS_KEYS.all, "summary"] as const,
  activeSensors: () => [...STATUS_KEYS.all, "active-sensors"] as const,
  alertsPerDay: () => [...STATUS_KEYS.all, "alerts-per-day"] as const,
  calendar: (year: number, month: number) => [...STATUS_KEYS.all, "calendar", year, month] as const,
  alertsByDate: (date: string) => [...STATUS_KEYS.all, "alerts-by-date", date] as const,
};

export const useStatusSummary = () => {
  return useQuery({
    queryKey: STATUS_KEYS.summary(),
    queryFn: () => statusService.getSummary(),
    refetchInterval: 30000,
  });
};

export const useActiveSensorsPerDay = () => {
  return useQuery({
    queryKey: STATUS_KEYS.activeSensors(),
    queryFn: () => statusService.getActiveSensorsPerDay(),
    refetchInterval: 60000,
  });
};

export const useAlertsPerDay = () => {
  return useQuery({
    queryKey: STATUS_KEYS.alertsPerDay(),
    queryFn: () => statusService.getAlertsPerDay(),
    refetchInterval: 60000,
  });
};

export const useAlertsCalendar = (year: number, month: number) => {
  return useQuery({
    queryKey: STATUS_KEYS.calendar(year, month),
    queryFn: () => statusService.getAlertsCalendar(year, month),
    refetchInterval: 60000,
  });
};

export const useAlertsByDate = (date: string | null) => {
  return useQuery({
    queryKey: STATUS_KEYS.alertsByDate(date || ""),
    queryFn: () => statusService.getAlertsByDate(date!),
    enabled: !!date,
  });
};

export const useAlertTracking = (alertId: number | null) => {
  return useQuery({
    queryKey: [...STATUS_KEYS.all, "tracking", alertId],
    queryFn: () => statusService.getAlertTracking(alertId!),
    enabled: !!alertId,
    refetchInterval: false,
  });
};
