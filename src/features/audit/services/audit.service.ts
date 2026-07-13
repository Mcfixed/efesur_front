import { apiClient } from "@/apis";

export interface AuditLog {
  id: number;
  user_id: string;
  user_name: string;
  action: string;
  details: any;
  ip: string;
  path: string;
  method: string;
  created_at: string;
}

export interface AuditResponse {
  logs: AuditLog[];
  total: number;
}

export const auditService = {
  getLogs: async (params: {
    limit?: number;
    offset?: number;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
  }) => {
    const response = await apiClient.get<{data: AuditResponse}>("/audit/logs", params as any);
    return response.data.data;
  },
};
