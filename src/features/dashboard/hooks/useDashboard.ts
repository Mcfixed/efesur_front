import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";
import { toast } from "sonner";

const DASHBOARD_KEYS = {
  all: ["dashboard"] as const,
  data: () => [...DASHBOARD_KEYS.all, "data"] as const,
  locations: () => [...DASHBOARD_KEYS.all, "locations"] as const,
  gateways: () => [...DASHBOARD_KEYS.all, "gateways"] as const,
};

export const useDashboardData = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.data(),
    queryFn: () => dashboardService.getDashboardData(),
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useDevicesLocations = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.locations(),
    queryFn: () => dashboardService.getDevicesLocations(),
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useGatewayStatus = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.gateways(),
    queryFn: () => dashboardService.getGatewayStatus(),
    refetchInterval: 10000, // Refetch every 10 seconds for real-time status
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      dashboardService.resolveAlert(id, { reason }),
    onSuccess: () => {
      toast.success("Alerta resuelta con éxito");
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.all });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al resolver la alerta");
    },
  });
};

export const useAlertHistory = (type: string, range: string) => {
  return useQuery({
    queryKey: [...DASHBOARD_KEYS.all, "history", type, range],
    queryFn: () => dashboardService.getAlertHistory(type, range),
    refetchInterval: 30000,
  });
};

export const useAlertTimeline = (range: string) => {
  return useQuery({
    queryKey: [...DASHBOARD_KEYS.all, "timeline", range],
    queryFn: () => dashboardService.getAlertTimeline(range),
    refetchInterval: 15000,
  });
};
