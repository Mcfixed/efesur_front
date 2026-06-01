import { useQuery } from "@tanstack/react-query";
import { telemetryService, SearchParams, TelemetryParams } from "../services/telemetry.service";

const TELEMETRY_KEYS = {
  all: ["telemetry"] as const,
  types: () => [...TELEMETRY_KEYS.all, "types"] as const,
  search: (params: SearchParams) => [...TELEMETRY_KEYS.all, "search", params] as const,
  deviceData: (deviceId: number, params: TelemetryParams) => [...TELEMETRY_KEYS.all, "device", deviceId, "data", params] as const,
  deviceStats: (deviceId: number, hours?: number) => [...TELEMETRY_KEYS.all, "device", deviceId, "stats", hours] as const,
};

export const useDeviceTypes = () => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.types(),
    queryFn: () => telemetryService.getDeviceTypes(),
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

export const useDeviceTelemetryStats = (deviceId: number | null, hours?: number) => {
  return useQuery({
    queryKey: TELEMETRY_KEYS.deviceStats(deviceId!, hours),
    queryFn: () => telemetryService.getDeviceTelemetryStats(deviceId!, hours),
    enabled: !!deviceId,
    refetchInterval: 60000,
  });
};
