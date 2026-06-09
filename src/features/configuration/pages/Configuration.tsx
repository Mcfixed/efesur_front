import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useBetterSession } from "@/libs/better-auth";
import { useCompanies, useUsers, useDevices, useRoles, useCreateCompany, useUpdateCompany, useDeleteCompany, useCreateUser, useUpdateUser, useDeleteUser, useCreateDevice, useUpdateDevice, useDeleteDevice } from "../hooks/useConfig";
import { DataTableWidget, PieChartWidget, BarChartWidget } from "@/components/widgets";
import { Company, User, Device } from "../types/config.types";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CompanyForm } from "../components/CompanyForm";
import { UserForm } from "../components/UserForm";
import { DeviceForm } from "../components/DeviceForm";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { configService } from "../services/config.service";
import { toast } from "sonner";

export default function Configuration() {
  const { user } = useBetterSession();
  const navigate = useNavigate();
  // @ts-expect-error - is_superuser puede venir del backend
  const isSuperuser = user?.is_superuser || user?.role === "admin";

  useEffect(() => {
    if (!isSuperuser) navigate("/", { replace: true });
  }, [isSuperuser]);

  const [activeTab, setActiveTab] = useState<"companies" | "users" | "devices">("companies");

  const tabs = [
    { id: "companies" as const, label: "Empresas" },
    { id: "users" as const, label: "Usuarios" },
    { id: "devices" as const, label: "Dispositivos" },
  ];

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      {/* ── Header ── */}
      <div className="relative rounded-xl bg-linear-to-r from-bg-300/40 via-bg-100/60 to-bg-200/40 border border-border/20 px-5 py-4 mb-6">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[1.5px]"
          style={{ background: "linear-gradient(to left, transparent, #6b7280, transparent)" }}
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-100">Configuración del Sistema</h1>
            <p className="text-sm text-text-200 mt-1">Administra empresas, usuarios y dispositivos.</p>
          </div>
        </div>
      </div>

      {/* ── Navegación principal ── */}
      <nav className="flex gap-1 bg-bg-100/40 p-1 rounded-lg mb-6 border border-border/10" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-brand-200/10 text-brand-200 shadow-xs"
                : "text-text-300 hover:text-text-200 hover:bg-bg-100/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Contenido ── */}
      <div className="flex-1">
        {activeTab === "companies" && <CompaniesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "devices" && <DevicesTab />}
      </div>
    </div>
  );
}

// ============================================================================
// EMPRESAS
// ============================================================================
function CompaniesTab() {
  const { data, isLoading } = useCompanies();
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (company: Company) => {
    setDeletingCompany(company);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (formData: Partial<Company>) => {
    if (editingCompany) {
      await updateMutation.mutateAsync({ id: editingCompany.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (deletingCompany) {
      await deleteMutation.mutateAsync(deletingCompany.id);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex justify-end">
        <button 
          onClick={handleOpenCreate}
          className="bg-brand-200 text-white px-4 py-2 rounded hover:bg-brand-100 transition-colors"
        >
          + Nueva Empresa
        </button>
      </div>
      <DataTableWidget
        title="Empresas Registradas"
        data={Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : [])}
        columns={[
          { key: "id", header: "ID", width: 60 },
          { key: "name", header: "Nombre" },
          { key: "rut", header: "RUT" },
          { key: "sector", header: "Sector" },
          { key: "device_count", header: "Dispositivos" },
          { key: "user_count", header: "Usuarios" },
          { 
            key: "is_active", 
            header: "Estado",
            render: (val) => val
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_3px_rgba(74,222,128,0.4)]" />
                  Activa
                </span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-text-300/10 text-text-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-300" />
                  Inactiva
                </span>
          },
          {
            key: "actions",
            header: "Acciones",
            render: (_, row: Company) => (
              <div className="flex gap-1">
                <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-md text-brand-200 hover:bg-brand-200/10 transition-colors" title="Editar">
                  <IconEdit size={16} />
                </button>
                <button onClick={() => handleOpenDelete(row)} className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                  <IconTrash size={16} />
                </button>
              </div>
            )
          }
        ]}
        isLoading={isLoading}
        pageSize={10}
        striped
        hoverable
        compact
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCompany ? "Editar Empresa" : "Nueva Empresa"}
      >
        <CompanyForm 
          initialData={editingCompany} 
          onSubmit={handleSubmit} 
          onCancel={() => setIsModalOpen(false)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Empresa"
        message={
          <div>
            <p>¿Estás seguro que deseas eliminar la empresa <strong>{deletingCompany?.name}</strong>?</p>
            <p className="mt-2 text-sm text-red-400 font-medium">Esta acción es irreversible y eliminará todos los accesos de los usuarios asociados a esta empresa.</p>
          </div>
        }
        confirmText="Sí, eliminar"
      />
    </div>
  );
}

// ============================================================================
// USUARIOS
// ============================================================================
function UsersTab() {
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useUsers();
  const { data: roles } = useRoles();
  const { data: companies } = useCompanies();
  
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (user: User) => {
    setDeletingUser(user);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (formData: Partial<User>, assignedCompanyIds: number[]) => {
    try {
      let userId = editingUser?.id;

      if (editingUser) {
        await updateMutation.mutateAsync({ id: editingUser.id, data: formData });
        
        // Handle company assignments diff
        const currentCompanyIds = editingUser.company_assignments?.map(c => c.company_id) || [];
        const toAdd = assignedCompanyIds.filter(id => !currentCompanyIds.includes(id));
        const toRemove = currentCompanyIds.filter(id => !assignedCompanyIds.includes(id));

        for (const companyId of toAdd) {
          await configService.assignUserToCompany({ userId: userId!, companyId });
        }
        for (const companyId of toRemove) {
          await configService.removeUserFromCompany(userId!, companyId);
        }
      } else {
        const newUser = await createMutation.mutateAsync(formData);
        userId = newUser.id;
        
        // Add company assignments
        for (const companyId of assignedCompanyIds) {
          await configService.assignUserToCompany({ userId: userId!, companyId });
        }
      }
      
      refetchUsers(); // Refetch to get updated assignments
      setIsModalOpen(false);
    } catch (error: any) {
      // toast is already handled in mutations, but we catch here to stop modal close on error if needed
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (deletingUser) {
      await deleteMutation.mutateAsync(deletingUser.id);
    }
  };

  const safeCompanies = Array.isArray(companies) ? companies : (Array.isArray((companies as any)?.data) ? (companies as any).data : []);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <div className="flex justify-end">
          <button 
            onClick={handleOpenCreate}
            className="bg-brand-200 text-white px-4 py-2 rounded hover:bg-brand-100 transition-colors"
          >
            + Nuevo Usuario
          </button>
        </div>
        <DataTableWidget
          title="Usuarios del Sistema"
          data={Array.isArray(users) ? users : (Array.isArray((users as any)?.data) ? (users as any).data : [])}
          columns={[
            { key: "name", header: "Nombre" },
            { key: "email", header: "Email" },
            { 
              key: "is_superuser", 
              header: "Superuser",
              render: (val) => val
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-200/10 text-brand-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-200" />
                    Sí
                  </span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-text-300/10 text-text-300">No</span>
            },
            {
              key: "company_assignments",
              header: "Empresas Asignadas",
              render: (val: any) => val?.length > 0
                ? <div className="flex flex-wrap gap-1">
                    {val.map((c: any) => (
                      <span key={c.company_id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-bg-300/60 text-text-200 border border-border/30">
                        {c.company_name}
                      </span>
                    ))}
                  </div>
                : <span className="text-text-400 text-xs">Ninguna</span>
            },
            {
              key: "actions",
              header: "Acciones",
              render: (_, row: User) => (
                <div className="flex gap-1">
                  <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-md text-brand-200 hover:bg-brand-200/10 transition-colors" title="Editar">
                    <IconEdit size={16} />
                  </button>
                  <button onClick={() => handleOpenDelete(row)} className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                    <IconTrash size={16} />
                  </button>
                </div>
              )
            }
          ]}
          isLoading={loadingUsers}
          pageSize={10}
          striped
          hoverable
          compact
        />
      </div>
      
      <div className="col-span-12 lg:col-span-4">
        <PieChartWidget
          title="Distribución de Roles"
          data={roles?.map(r => ({ name: r.role, value: parseInt(r.count) })) || []}
          dataKey="value"
          nameKey="name"
          colors={["#8ecae0", "#82ca9d", "#ffc658"]}
          chartHeight={300}
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? "Editar Usuario" : "Nuevo Usuario"}
      >
        <UserForm 
          initialData={editingUser}
          companies={safeCompanies}
          onSubmit={handleSubmit} 
          onCancel={() => setIsModalOpen(false)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Usuario"
        message={
          <div>
            <p>¿Estás seguro que deseas eliminar al usuario <strong>{deletingUser?.name}</strong>?</p>
            <p className="mt-2 text-sm text-red-400 font-medium">No podrá volver a iniciar sesión en el sistema.</p>
          </div>
        }
        confirmText="Sí, eliminar"
      />
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEVICE_TYPE_OPTIONS = [
  { value: null, label: "Todos" },
  { value: "Gps", label: "GPS (Telemetría)" },
  { value: "Gateway", label: "Gateway LoRaWAN" },
  { value: "Lector", label: "Lector" },
  { value: "SubEstacion", label: "Subestación" },
] as const;

const DEVICE_TYPE_LABELS: Record<string, string> = {
  Gps: "GPS (Telemetría)",
  Gateway: "Gateway LoRaWAN",
  Lector: "Lector",
  SubEstacion: "Subestación",
};

// ============================================================================
// DISPOSITIVOS
// ============================================================================
function DevicesTab() {
  const [activeDeviceType, setActiveDeviceType] = useState<string | null>(null);
  
  const { data: devices, isLoading } = useDevices(
    activeDeviceType ? { type: activeDeviceType } : undefined
  );
  const { data: companies } = useCompanies();
  
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const deleteMutation = useDeleteDevice();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  const handleOpenCreate = () => {
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (device: Device) => {
    setDeletingDevice(device);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (formData: Partial<Device>) => {
    if (editingDevice) {
      await updateMutation.mutateAsync({ id: editingDevice.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (deletingDevice) {
      await deleteMutation.mutateAsync(deletingDevice.id);
    }
  };

  const safeCompanies = Array.isArray(companies) ? companies : (Array.isArray((companies as any)?.data) ? (companies as any).data : []);

  // Preparar datos para el gráfico
  const devicesByCompany = safeCompanies.map(c => ({
    empresa: c.name,
    dispositivos: parseInt(c.device_count || "0")
  })).filter(c => c.dispositivos > 0);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        {/* ── Sub-navegación de tipos de dispositivo ── */}
        <nav className="flex flex-wrap gap-1.5 bg-bg-100/30 p-1 rounded-lg border border-border/10" aria-label="Filtro por tipo de dispositivo">
          {DEVICE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value ?? "all"}
              onClick={() => setActiveDeviceType(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                activeDeviceType === option.value
                  ? "bg-brand-200/15 text-brand-200 shadow-xs"
                  : "text-text-300 hover:text-text-200 hover:bg-bg-100/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className="flex justify-end">
          <button 
            onClick={handleOpenCreate}
            className="bg-brand-200 text-white px-4 py-2 rounded hover:bg-brand-100 transition-colors"
          >
            + Nuevo Dispositivo
          </button>
        </div>
        <DataTableWidget
          title="Inventario de Dispositivos"
          data={Array.isArray(devices) ? devices : (Array.isArray((devices as any)?.data) ? (devices as any).data : [])}
          columns={[
            { key: "dev_eui", header: "DevEUI" },
            { key: "name", header: "Nombre" },
            { 
              key: "type_device", 
              header: "Tipo",
              render: (val: string) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-200/10 text-brand-200 border border-brand-200/20">
                  {DEVICE_TYPE_LABELS[val] ?? val}
                </span>
              )
            },
            { key: "company_name", header: "Empresa" },
            { 
              key: "is_active", 
              header: "Estado",
              render: (val) => val
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_3px_rgba(74,222,128,0.4)]" />
                    Activo
                  </span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_3px_rgba(248,113,113,0.4)]" />
                    Inactivo
                  </span>
            },
            {
              key: "actions",
              header: "Acciones",
              render: (_, row: Device) => (
                <div className="flex gap-1">
                  <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-md text-brand-200 hover:bg-brand-200/10 transition-colors" title="Editar">
                    <IconEdit size={16} />
                  </button>
                  <button onClick={() => handleOpenDelete(row)} className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                    <IconTrash size={16} />
                  </button>
                </div>
              )
            }
          ]}
          isLoading={isLoading}
          pageSize={10}
          striped
          hoverable
          compact
        />
      </div>

      <div className="col-span-12 lg:col-span-4">
        <BarChartWidget
          title="Dispositivos por Empresa"
          data={devicesByCompany}
          xAxisKey="empresa"
          dataKey={["dispositivos"]}
          colors={["#8ecae0"]}
          chartHeight={300}
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingDevice ? "Editar Dispositivo" : "Nuevo Dispositivo"}
      >
        <DeviceForm 
          initialData={editingDevice}
          companies={safeCompanies}
          onSubmit={handleSubmit} 
          onCancel={() => setIsModalOpen(false)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Dispositivo"
        message={
          <div>
            <p>¿Estás seguro que deseas eliminar el dispositivo <strong>{deletingDevice?.name}</strong> ({deletingDevice?.dev_eui})?</p>
            <p className="mt-2 text-sm text-red-400 font-medium">Se perderá todo el historial de telemetría y alertas asociadas.</p>
          </div>
        }
        confirmText="Sí, eliminar"
      />
    </div>
  );
}
