import { apiClient } from "@/apis";
import { Company, User, Device, CompanyConfig, RoleCount } from "../types/config.types";

export const configService = {
  // Companies
  getCompanies: async () => {
    const res = await apiClient.get<{data: Company[]}>("/config/companies");
    return res.data.data;
  },
  getCompany: async (id: number) => {
    const res = await apiClient.get<{data: Company}>(`/config/companies/${id}`);
    return res.data.data;
  },
  createCompany: async (data: Partial<Company>) => {
    const res = await apiClient.post<{data: Company}>("/config/companies", data);
    return res.data.data;
  },
  updateCompany: async (id: number, data: Partial<Company>) => {
    const res = await apiClient.put<{data: Company}>(`/config/companies/${id}`, data);
    return res.data.data;
  },
  deleteCompany: async (id: number) => {
    await apiClient.delete(`/config/companies/${id}`);
  },

  // Users
  getUsers: async () => {
    const res = await apiClient.get<{data: User[]}>("/config/users");
    return res.data.data;
  },
  createUser: async (data: Partial<User>) => {
    const res = await apiClient.post<{data: User}>("/config/users", data);
    return res.data.data;
  },
  updateUser: async (id: string, data: Partial<User>) => {
    const res = await apiClient.put<{data: User}>(`/config/users/${id}`, data);
    return res.data.data;
  },
  deleteUser: async (id: string) => {
    await apiClient.delete(`/config/users/${id}`);
  },
  assignUserToCompany: async (data: { userId: string; companyId: number; role?: string }) => {
    const res = await apiClient.post<{data: any}>("/config/users/assign-company", data);
    return res.data.data;
  },
  removeUserFromCompany: async (userId: string, companyId: number) => {
    await apiClient.delete(`/config/users/${userId}/companies/${companyId}`);
  },
  getRoles: async () => {
    const res = await apiClient.get<{data: RoleCount[]}>("/config/roles");
    return res.data.data;
  },

  // Devices
  getDevices: async (filters?: { companyId?: number; type?: string; isActive?: boolean }) => {
    const res = await apiClient.get<{data: Device[]}>("/config/devices", filters as Record<string, unknown>);
    return res.data.data;
  },
  getDevice: async (id: number) => {
    const res = await apiClient.get<{data: Device}>(`/config/devices/${id}`);
    return res.data.data;
  },
  createDevice: async (data: Partial<Device>) => {
    const res = await apiClient.post<{data: Device}>("/config/devices", data);
    return res.data.data;
  },
  updateDevice: async (id: number, data: Partial<Device>) => {
    const res = await apiClient.put<{data: Device}>(`/config/devices/${id}`, data);
    return res.data.data;
  },
  deleteDevice: async (id: number) => {
    await apiClient.delete(`/config/devices/${id}`);
  },

  // Company Config
  getCompanyConfig: async (companyId: number) => {
    const res = await apiClient.get<{data: CompanyConfig}>(`/config/companies/${companyId}/config`);
    return res.data.data;
  },
  updateCompanyConfig: async (companyId: number, data: Partial<CompanyConfig>) => {
    const res = await apiClient.put<{data: CompanyConfig}>(`/config/companies/${companyId}/config`, data);
    return res.data.data;
  },
};
