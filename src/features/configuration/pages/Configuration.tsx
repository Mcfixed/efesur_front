import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"companies" | "users" | "devices">("companies");

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-100">Configuración del Sistema</h1>
        <p className="text-sm text-text-200 mt-1">Administra empresas, usuarios y dispositivos.</p>
      </div>

      <div className="flex border-b border-border-200 mb-6">
        <button
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "companies" ? "text-brand-200 border-b-2 border-brand-200" : "text-text-300 hover:text-text-200"}`}
          onClick={() => setActiveTab("companies")}
        >
          Empresas
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "users" ? "text-brand-200 border-b-2 border-brand-200" : "text-text-300 hover:text-text-200"}`}
          onClick={() => setActiveTab("users")}
        >
          Usuarios
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "devices" ? "text-brand-200 border-b-2 border-brand-200" : "text-text-300 hover:text-text-200"}`}
          onClick={() => setActiveTab("devices")}
        >
          Dispositivos
        </button>
      </div>

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
            render: (val) => val ? <span className="text-green-400">Activa</span> : <span className="text-text-300">Inactiva</span>
          },
          {
            key: "actions",
            header: "Acciones",
            render: (_, row: Company) => (
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(row)} className="text-brand-200 hover:text-brand-100 p-1" title="Editar">
                  <IconEdit size={18} />
                </button>
                <button onClick={() => handleOpenDelete(row)} className="text-red-500 hover:text-red-400 p-1" title="Eliminar">
                  <IconTrash size={18} />
                </button>
              </div>
            )
          }
        ]}
        isLoading={isLoading}
        pageSize={10}
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
              render: (val) => val ? "Sí" : "No"
            },
            {
              key: "company_assignments",
              header: "Empresas Asignadas",
              render: (val: any) => val?.length > 0 ? val.map((c: any) => c.company_name).join(", ") : "Ninguna"
            },
            {
              key: "actions",
              header: "Acciones",
              render: (_, row: User) => (
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(row)} className="text-brand-200 hover:text-brand-100 p-1" title="Editar">
                    <IconEdit size={18} />
                  </button>
                  <button onClick={() => handleOpenDelete(row)} className="text-red-500 hover:text-red-400 p-1" title="Eliminar">
                    <IconTrash size={18} />
                  </button>
                </div>
              )
            }
          ]}
          isLoading={loadingUsers}
          pageSize={10}
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

// ============================================================================
// DISPOSITIVOS
// ============================================================================
function DevicesTab() {
  const { data: devices, isLoading } = useDevices();
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
            { key: "type_device", header: "Tipo" },
            { key: "company_name", header: "Empresa" },
            { 
              key: "is_active", 
              header: "Estado",
              render: (val) => val ? <span className="text-green-400">Activo</span> : <span className="text-red-400">Inactivo</span>
            },
            {
              key: "actions",
              header: "Acciones",
              render: (_, row: Device) => (
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(row)} className="text-brand-200 hover:text-brand-100 p-1" title="Editar">
                    <IconEdit size={18} />
                  </button>
                  <button onClick={() => handleOpenDelete(row)} className="text-red-500 hover:text-red-400 p-1" title="Eliminar">
                    <IconTrash size={18} />
                  </button>
                </div>
              )
            }
          ]}
          isLoading={isLoading}
          pageSize={10}
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
