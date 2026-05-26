import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";
import { toast } from "sonner";

const DASHBOARD_KEYS = {
  all: ["dashboard"] as const,
  data: () => [...DASHBOARD_KEYS.all, "data"] as const,
  locations: () => [...DASHBOARD_KEYS.all, "locations"] as const,
};

export const useDashboardData = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.data(),
    queryFn: () => dashboardService.getDashboardData(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useDevicesLocations = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.locations(),
    queryFn: () => dashboardService.getDevicesLocations(),
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, userId }: { id: number; reason: string; userId: string }) =>
      dashboardService.resolveAlert(id, { reason, userId }),
    onSuccess: () => {
      toast.success("Alerta resuelta con éxito");
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.all });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al resolver la alerta");
    },
  });
};
