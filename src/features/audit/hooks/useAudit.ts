import { useQuery } from "@tanstack/react-query";
import { auditService } from "../services/audit.service";

export const useAuditLogs = (params: {
  limit?: number;
  offset?: number;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}) => {
  return useQuery({
    queryKey: ["audit", params.limit, params.offset, params.action, params.userId, params.from, params.to],
    queryFn: () => auditService.getLogs(params),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
};
