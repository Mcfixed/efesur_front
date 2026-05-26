import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { configService } from "../services/config.service";
import { toast } from "sonner";
import { Company, User, Device, CompanyConfig } from "../types/config.types";

export const CONFIG_KEYS = {
  all: ["config"] as const,
  companies: () => [...CONFIG_KEYS.all, "companies"] as const,
  users: () => [...CONFIG_KEYS.all, "users"] as const,
  devices: (filters?: any) => [...CONFIG_KEYS.all, "devices", filters] as const,
  roles: () => [...CONFIG_KEYS.all, "roles"] as const,
  companyConfig: (companyId: number) => [...CONFIG_KEYS.all, "companyConfig", companyId] as const,
};

// --- Companies Hooks ---
export const useCompanies = () => useQuery({ queryKey: CONFIG_KEYS.companies(), queryFn: () => configService.getCompanies() });
export const useCreateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Company>) => configService.createCompany(data),
    onSuccess: () => { toast.success("Empresa creada"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.companies() }); },
    onError: (e: any) => toast.error(e.message || "Error al crear empresa"),
  });
};
export const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Company> }) => configService.updateCompany(id, data),
    onSuccess: () => { toast.success("Empresa actualizada"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.companies() }); },
    onError: (e: any) => toast.error(e.message || "Error al actualizar empresa"),
  });
};
export const useDeleteCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => configService.deleteCompany(id),
    onSuccess: () => { toast.success("Empresa eliminada"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.companies() }); },
    onError: (e: any) => toast.error(e.message || "Error al eliminar empresa"),
  });
};

// --- Users Hooks ---
export const useUsers = () => useQuery({ queryKey: CONFIG_KEYS.users(), queryFn: () => configService.getUsers() });
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<User>) => configService.createUser(data),
    onSuccess: () => { toast.success("Usuario creado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.users() }); },
    onError: (e: any) => toast.error(e.message || "Error al crear usuario"),
  });
};
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => configService.updateUser(id, data),
    onSuccess: () => { toast.success("Usuario actualizado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.users() }); },
    onError: (e: any) => toast.error(e.message || "Error al actualizar usuario"),
  });
};
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configService.deleteUser(id),
    onSuccess: () => { toast.success("Usuario eliminado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.users() }); },
    onError: (e: any) => toast.error(e.message || "Error al eliminar usuario"),
  });
};

// --- Devices Hooks ---
export const useDevices = (filters?: { companyId?: number; type?: string; isActive?: boolean }) => useQuery({ queryKey: CONFIG_KEYS.devices(filters), queryFn: () => configService.getDevices(filters) });
export const useCreateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Device>) => configService.createDevice(data),
    onSuccess: () => { toast.success("Dispositivo creado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.devices() }); },
    onError: (e: any) => toast.error(e.message || "Error al crear dispositivo"),
  });
};
export const useUpdateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) => configService.updateDevice(id, data),
    onSuccess: () => { toast.success("Dispositivo actualizado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.devices() }); },
    onError: (e: any) => toast.error(e.message || "Error al actualizar dispositivo"),
  });
};
export const useDeleteDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => configService.deleteDevice(id),
    onSuccess: () => { toast.success("Dispositivo eliminado"); queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.devices() }); },
    onError: (e: any) => toast.error(e.message || "Error al eliminar dispositivo"),
  });
};

// --- Utils & Config Hooks ---
export const useRoles = () => useQuery({ queryKey: CONFIG_KEYS.roles(), queryFn: () => configService.getRoles() });
export const useCompanyConfig = (companyId: number | null) => useQuery({ queryKey: CONFIG_KEYS.companyConfig(companyId!), queryFn: () => configService.getCompanyConfig(companyId!), enabled: !!companyId });
