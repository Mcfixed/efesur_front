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
    refetchInterval: 10000,
    staleTime: 5000,
  });
};

export const useDevicesLocations = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.locations(),
    queryFn: () => dashboardService.getDevicesLocations(),
    refetchInterval: 15000,
    staleTime: 10000,
  });
};

export const useGatewayStatus = () => {
  return useQuery({
    queryKey: DASHBOARD_KEYS.gateways(),
    queryFn: () => dashboardService.getGatewayStatus(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
};

/**
 * Quita una alerta de los datos ya cargados, sin esperar al servidor.
 * Cubre las tres formas que devuelve el backend:
 *  - DashboardData: `{ alerts: { critical: [], atencion: [], … } }`
 *  - timeline/history: `{ alerts: [], total | count }`
 * No se toca ningún otro arreglo (devices, gateways…) aunque un id coincida.
 */
function sinAlerta(data: any, id: number): any {
  if (!data || typeof data !== 'object') return data;

  if (data.alerts && !Array.isArray(data.alerts) && typeof data.alerts === 'object') {
    const alerts: Record<string, any> = {};
    for (const [k, v] of Object.entries(data.alerts)) {
      alerts[k] = Array.isArray(v) ? v.filter((a: any) => a?.id !== id) : v;
    }
    return {
      ...data,
      alerts,
      summary: data.summary
        ? {
            ...data.summary,
            criticalAlertsCount: Array.isArray(alerts.critical) ? alerts.critical.length : data.summary.criticalAlertsCount,
            atencionAlertsCount: Array.isArray(alerts.atencion) ? alerts.atencion.length : data.summary.atencionAlertsCount,
            desconexionGWCount: Array.isArray(alerts.desconexionGW) ? alerts.desconexionGW.length : data.summary.desconexionGWCount,
            movimientosAnomalosCount: Array.isArray(alerts.movimientos_anomalos) ? alerts.movimientos_anomalos.length : data.summary.movimientosAnomalosCount,
          }
        : data.summary,
    };
  }

  if (Array.isArray(data.alerts)) {
    if (!data.alerts.some((a: any) => a?.id === id)) return data;
    const out: any = { ...data, alerts: data.alerts.filter((a: any) => a?.id !== id) };
    if (typeof data.total === "number") out.total = Math.max(0, data.total - 1);
    if (typeof data.count === "number") out.count = Math.max(0, data.count - 1);
    return out;
  }

  return data;
}

export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, action }: { id: number; reason: string; action?: string }) =>
      dashboardService.resolveAlert(id, { reason, action }),
    // La tarjeta desaparece al instante: no se espera a que vuelva el POST ni a que el
    // servidor revalide (antes quedaba en pantalla unos segundos y se resolvía dos veces).
    onMutate: async ({ id }) => {
      const snapshot = queryClient.getQueriesData({ queryKey: DASHBOARD_KEYS.all });
      await queryClient.cancelQueries({ queryKey: DASHBOARD_KEYS.all });
      for (const [key, data] of snapshot) {
        const seccion = Array.isArray(key) ? key[1] : null;
        if (seccion !== "data" && seccion !== "timeline" && seccion !== "history") continue;
        queryClient.setQueryData(key, sinAlerta(data, id));
      }
      return { snapshot };
    },
    onSuccess: (data: any) => {
      const action = data?.alert?.action || 'resolver';
      const msgs: Record<string, string> = {
        abortar: 'Comando abortar emergencia enviado al sensor',
        persecucion: 'Modo persecución activado en el sensor',
        resolver: 'Alerta resuelta visualmente',
      };
      toast.success(msgs[action] || 'Alerta resuelta');
    },
    onError: (error: any, _vars, ctx: any) => {
      // Si falló, se devuelve lo que había para que la tarjeta vuelva a aparecer.
      for (const [key, data] of ctx?.snapshot ?? []) queryClient.setQueryData(key, data);
      toast.error(error.message || "Error al resolver la alerta");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.all });
    },
  });
};

export const useAlertHistory = (type: string, range: string) => {
  return useQuery({
    queryKey: [...DASHBOARD_KEYS.all, "history", type, range],
    queryFn: () => dashboardService.getAlertHistory(type, range),
    refetchInterval: 60000,
    staleTime: 30000,
  });
};

export const useAlertTimeline = (range: string) => {
  return useQuery({
    queryKey: [...DASHBOARD_KEYS.all, "timeline", range],
    queryFn: () => dashboardService.getAlertTimeline(range),
    refetchInterval: 10000,
    staleTime: 5000,
  });
};
