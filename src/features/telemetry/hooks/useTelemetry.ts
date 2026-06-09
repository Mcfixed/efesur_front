import { useQuery } from "@tanstack/react-query";
import { telemetryService, SearchParams, TelemetryParams } from "../services/telemetry.service";

const TELEMETRY_KEYS = {
  all: ["telemetry"] as const,
  summary: () => [...TELEMETRY_KEYS.all, "summary"] as const,
  devices: () => [...TELEMETRY_KEYS.all, "devices"] as const,
  gpsReview: () => [...TELEMETRY_KEYS.all, "gps-review"] as const,
  gpsDetail: (date: string) => [...TELEMETRY_KEYS.all, "gps-detail", date] as const,
  search: (params: SearchParams) => [...TELEMETRY_KEYS.all, "search", params] as const,
  deviceData: (deviceId: number, params: TelemetryParams) => [...TELEMETRY_KEYS.all, "device", deviceId, "data", params] as const,
};

export const useSensorSummary = () => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.summary(),
    queryFn: () => telemetryService.getSummary(),
    refetchInterval: 60000,
  });
};

export const useDevicesList = () => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.devices(),
    queryFn: () => telemetryService.getDevicesList(),
    refetchInterval: 30000,
  });
};

export const useGpsDailyReview = () => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.gpsReview(),
    queryFn: () => telemetryService.getGpsDailyReview(),
    refetchInterval: 30000,
  });
};

export const useSearchDevices = (params: SearchParams) => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.search(params),
    queryFn: () => telemetryService.searchDevices(params),
    enabled: params.q !== undefined && params.q !== "",
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
};

export const useDeviceTelemetry = (deviceId: number | null, params: TelemetryParams) => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.deviceData(deviceId!, params),
    queryFn: () => telemetryService.getDeviceTelemetry(deviceId!, params),
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
};
