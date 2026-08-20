import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useBetterSession } from "@/libs/better-auth";
import { useCompanies, useUsers, useDevices, useRoles, useCreateCompany, useUpdateCompany, useDeleteCompany, useCreateUser, useUpdateUser, useDeleteUser, useCreateDevice, useUpdateDevice, useDeleteDevice, useNotificationUsers } from "../hooks/useConfig";
import { DataTableWidget, PieChartWidget, BarChartWidget } from "@/components/widgets";
import { Company, User, Device } from "../types/config.types";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CompanyForm } from "../components/CompanyForm";
import { UserForm } from "../components/UserForm";
import { NotificationContactForm } from "../components/NotificationContactForm";
import { DeviceForm } from "../components/DeviceForm";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { configService } from "../services/config.service";
import { toast } from "sonner";

import ChirpstackConfig from "@/features/chirpstack/pages/ChirpstackConfig";

export default function Configuration() {
  const { user } = useBetterSession();
  const navigate = useNavigate();
  const role = user?.role || 'visualizador';

  useEffect(() => {
    if (role !== 'superadmin' && role !== 'admin_efe') navigate("/", { replace: true });
  }, [role]);

  const [activeTab, setActiveTab] = useState<"companies" | "users" | "notifications" | "devices" | "chirpstack">("companies");

  // admin_efe solo puede ver la pestaña de Notificaciones Usuarios
  const visibleTabs = role === 'superadmin'
    ? [
        { id: "companies" as const, label: "Empresas" },
        { id: "users" as const, label: "Usuarios" },
        { id: "notifications" as const, label: "Notificaciones Usuarios" },
        { id: "devices" as const, label: "Dispositivos" },
        { id: "chirpstack" as const, label: "Config ChirpStack" },
      ]
    : [
        { id: "notifications" as const, label: "Notificaciones Usuarios" },
      ];

  // Si no es superadmin, forzar la pestaña de notificaciones
  useEffect(() => {
    if (role !== 'superadmin' && activeTab !== 'notifications') {
      setActiveTab('notifications');
    }
  }, [role, activeTab]);

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
            <p className="text-sm text-text-200 mt-1"></p>
          </div>
        </div>
      </div>

      {/* ── Navegación principal ── */}
      <nav className="bg-bg-100 border-b border-border mb-6" role="tablist">
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-brand-100 text-brand-100"
                  : "border-transparent text-text-200 hover:text-text-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Contenido ── */}
      <div className="flex-1">
        {activeTab === "companies" && <CompaniesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "devices" && <DevicesTab />}
        {activeTab === "chirpstack" && <ChirpstackConfig />}
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
        const newUser = await createMutation.mutateAsync({ data: formData });
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

  const handleToggleActive = async (user: User) => {
    await updateMutation.mutateAsync({ id: user.id, data: { is_active: !(user.is_active ?? true) } });
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
              key: "role", 
              header: "Rol",
              render: (val) => {
                const colors: Record<string, string> = {
                  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                  admin_efe: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  visualizador: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
                  contacto: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
                };
                const labels: Record<string, string> = {
                  superadmin: 'Superadmin',
                  admin_efe: 'Admin EFE',
                  visualizador: 'Visualizador',
                  contacto: 'Contacto',
                };
                const c = colors[val as string] || colors.visualizador;
                return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c}`}>{labels[val as string] || val}</span>;
              }
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
              key: "phones",
              header: "Teléfonos",
              render: (_, row: User) => (
                <div className="flex flex-col text-[11px] font-mono leading-tight">
                  <span className={row.phone_call ? "text-text-200" : "text-text-400"}>Llamadas: {row.phone_call || "—"}</span>
                  <span className={row.phone_whatsapp ? "text-text-200" : "text-text-400"}>WhatsApp: {row.phone_whatsapp || "—"}</span>
                </div>
              )
            },
            {
              key: "is_active",
              header: "Estado",
              render: (_, row: User) => (
                <button
                  onClick={() => handleToggleActive(row)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${row.is_active === false ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-green-500/10 text-green-400 border-green-500/30"}`}
                  title={row.is_active === false ? "Activar usuario" : "Desactivar usuario"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${row.is_active === false ? "bg-red-400" : "bg-green-400"}`} />
                  {row.is_active === false ? "Inactivo" : "Activo"}
                </button>
              )
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
// NOTIFICACIONES USUARIOS
// ============================================================================
function NotificationsTab() {
  const { data, refetch } = useNotificationUsers();
  const { data: companies } = useCompanies();
  const updateMutation = useUpdateUser();
  const createMutation = useCreateUser();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<User | null>(null);
  const [confirmState, setConfirmState] = useState<{
    user: User;
    field: 'notify_calls' | 'notify_whatsapp' | 'notify_email';
    next: boolean;
    label: string;
  } | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const safeCompanies = Array.isArray(companies) ? companies : (Array.isArray((companies as any)?.data) ? (companies as any).data : []);
  const selectedCompany = safeCompanies.find((c: Company) => c.id === selectedCompanyId) || null;

  // Seleccionar la primera empresa disponible por defecto
  useEffect(() => {
    if (safeCompanies.length && (selectedCompanyId === null || !safeCompanies.some((c: Company) => c.id === selectedCompanyId))) {
      setSelectedCompanyId(safeCompanies[0].id);
    }
  }, [safeCompanies, selectedCompanyId]);

  const hasAnyChannel = (u: User) => !!(u.notify_calls || u.notify_whatsapp || u.notify_email);
  const notifyUsers = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : []);
  // Filtrar por la empresa seleccionada (+ opcionalmente solo con canales activos)
  const filteredUsers: any = notifyUsers
    .filter((u: User) => u.company_assignments?.some((c) => c.company_id === selectedCompanyId))
    .filter((u: User) => !showOnlyActive || hasAnyChannel(u));

  const requestToggleNotify = (user: User, field: 'notify_calls' | 'notify_whatsapp' | 'notify_email') => {
    const label = field === 'notify_calls' ? 'Llamadas' : field === 'notify_whatsapp' ? 'WhatsApp' : 'Correo de notificación';
    const next = !(user[field] ?? false);
    setConfirmState({ user, field, next, label });
  };

  const handleConfirmToggle = async () => {
    if (!confirmState) return;
    const { user, field, next, label } = confirmState;
    await updateMutation.mutateAsync({ id: user.id, data: { [field]: next } as any, silent: true });
    toast.success(`${user.name}: ${label} → ${next ? 'activado' : 'desactivado'}`);
    refetch();
    setConfirmState(null);
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingContact(user);
    setIsFormOpen(true);
  };

  const handleSubmitContact = async (formData: Partial<User>) => {
    try {
      if (editingContact) {
        await updateMutation.mutateAsync({ id: editingContact.id, data: formData, silent: true });
        toast.success(`Contacto "${formData.name || editingContact.name}" actualizado`);
      } else {
        const created = await createMutation.mutateAsync({
          data: { ...formData, role: 'contacto', is_active: false },
          silent: true,
        });
        if (selectedCompanyId) {
          await configService.assignUserToCompany({ userId: created.id, companyId: selectedCompanyId });
        }
        toast.success(`Contacto "${created.name}" creado`);
      }
      await refetch();
      setIsFormOpen(false);
      setEditingContact(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Selector de empresa + crear contacto */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="notify-company" className="text-sm font-medium text-text-200">Empresa:</label>
            <select
              id="notify-company"
              value={selectedCompanyId ?? ""}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
              className="bg-bg-200 border border-border/30 rounded-lg px-3 py-2 text-[13px] text-text-100 outline-none focus:border-brand-100/50 min-w-50"
            >
              {safeCompanies.length === 0 && <option value="">Sin empresas</option>}
              {safeCompanies.map((c: Company) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-200"
            />
            Solo con canales activos
          </label>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={!selectedCompanyId}
          className="bg-brand-200 text-white px-4 py-2 rounded hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Nuevo Usuario Notificado
        </button>
      </div>

      <DataTableWidget
        title={selectedCompany ? `Usuarios Notificados — ${selectedCompany.name}` : "Usuarios Notificados"}
        data={filteredUsers}
        columns={[
          {
            key: "name",
            header: "Nombre",
            render: (_, row: any) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{row.name}</span>
                <div className="flex flex-wrap gap-1">
                  {row.role === 'contacto' && (
                    <span className="inline-flex w-fit px-1.5 py-px rounded-full text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/30">
                      Contacto
                    </span>
                  )}
                  {!hasAnyChannel(row) && (
                    <span className="inline-flex w-fit px-1.5 py-px rounded-full text-[10px] font-medium bg-bg-300/60 text-text-300 border border-border/30">
                      Sin canales
                    </span>
                  )}
                </div>
              </div>
            )
          },
          { key: "email", header: "Email", render: (val) => val ? <span className="text-xs">{val}</span> : <span className="text-text-400 text-xs">—</span> },
          {
            key: "phone_call",
            header: "Tel. Llamadas",
            render: (val) => val ? <span className="font-mono text-xs">{val}</span> : <span className="text-text-400 text-xs">—</span>
          },
          {
            key: "phone_whatsapp",
            header: "Tel. WhatsApp",
            render: (val) => val ? <span className="font-mono text-xs">{val}</span> : <span className="text-text-400 text-xs">—</span>
          },
          {
            key: "notify_email_address",
            header: "Correo Notif.",
            render: (val: any, row: any) => <span className="text-xs">{val || row.email || "—"}</span>
          },
          {
            key: "notify_calls",
            header: "Llamadas",
            render: (_, row: any) => <ToggleSwitch active={!!row.notify_calls} onClick={() => requestToggleNotify(row, 'notify_calls')} label="Llamadas" />
          },
          {
            key: "notify_whatsapp",
            header: "WhatsApp",
            render: (_, row: any) => <ToggleSwitch active={!!row.notify_whatsapp} onClick={() => requestToggleNotify(row, 'notify_whatsapp')} label="WhatsApp" />
          },
          {
            key: "notify_email",
            header: "Correo",
            render: (_, row: any) => <ToggleSwitch active={!!row.notify_email} onClick={() => requestToggleNotify(row, 'notify_email')} label="Correo de notificación" />
          },
          {
            key: "is_active",
            header: "Estado",
            render: (val) => val === false
              ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">Inactivo login</span>
              : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30">Activo</span>
          },
          {
            key: "actions",
            header: "Acciones",
            render: (_, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-md text-brand-200 hover:bg-brand-200/10 transition-colors" title="Editar contacto">
                  <IconEdit size={16} />
                </button>
              </div>
            )
          },
        ]}
        pageSize={10}
        striped
        hoverable
        compact
      />
      <p className="text-xs text-text-300 -mt-3">
        Se muestran todos los usuarios de la empresa; los canales activos indican a quién WISENSOR puede llamar o
        enviar mensajes. Los contactos creados aquí no pueden iniciar sesión; solo el superadmin puede activarlos en la
        sección "Usuarios".
      </p>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingContact ? "Editar Contacto Notificado" : "Nuevo Usuario Notificado"}>
        <NotificationContactForm
          initialData={editingContact}
          companyName={selectedCompany?.name || ""}
          onSubmit={handleSubmitContact}
          onCancel={() => setIsFormOpen(false)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirmToggle}
        title="Cambiar estado de notificación"
        message={
          confirmState ? (
            <p>
              ¿Deseas <strong>{confirmState.next ? 'activar' : 'desactivar'}</strong> las notificaciones por{' '}
              <strong>{confirmState.label}</strong> para <strong>{confirmState.user.name}</strong>?
            </p>
          ) : null
        }
        confirmText={confirmState?.next ? "Activar" : "Desactivar"}
        cancelText="Cancelar"
        isDestructive={!!confirmState && !confirmState.next}
      />
    </div>
  );
}

function ToggleSwitch({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200/40 ${
        active ? "bg-brand-200" : "bg-bg-300 hover:bg-bg-300/70"
      }`}
      title={`${active ? "Desactivar" : "Activar"} ${label}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ============================================================================
// DISPOSITIVOS
// ============================================================================
function DevicesTab() {
  const [activeDeviceType, setActiveDeviceType] = useState<string | null>(null);
  
  const { data: devices, isLoading } = useDevices(
    activeDeviceType ? { type: activeDeviceType } : undefined
  );
  const { data: lectors } = useDevices({ type: 'Lector' });
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
          searchable
          searchPlaceholder="Buscar por DevEUI, nombre, empresa..."
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
          lectors={lectors || []}
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
