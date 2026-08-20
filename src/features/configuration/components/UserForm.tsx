import React, { useState, useEffect } from "react";
import { User, Company } from "../../types/config.types";
import { Button, Input, Checkbox, Label } from "@/components/ui";

interface UserFormProps {
  initialData?: User | null;
  companies: Company[];
  onSubmit: (data: Partial<User>, assignedCompanyIds: number[]) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UserForm({ initialData, companies, onSubmit, onCancel, isLoading }: UserFormProps) {
  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    password: "",
    role: "visualizador",
    phone_call: "",
    phone_whatsapp: "",
    is_active: true,
    notify_calls: false,
    notify_whatsapp: false,
    notify_email: false,
    notify_email_address: "",
  });

  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role,
        phone_call: initialData.phone_call ?? "",
        phone_whatsapp: initialData.phone_whatsapp ?? "",
        is_active: initialData.is_active ?? true,
        notify_calls: initialData.notify_calls ?? false,
        notify_whatsapp: initialData.notify_whatsapp ?? false,
        notify_email: initialData.notify_email ?? false,
        notify_email_address: initialData.notify_email_address ?? "",
      });
      // Extract assigned company IDs
      if (initialData.company_assignments) {
        setSelectedCompanies(initialData.company_assignments.map((c: any) => c.company_id));
      }
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCompanyToggle = (companyId: number) => {
    setSelectedCompanies((prev) => 
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData, selectedCompanies);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="user-name" required>Nombre Completo</Label>
        <Input
          id="user-name"
          name="name"
          value={formData.name || ""}
          onChange={handleChange}
          required
          placeholder="Ej: Juan Pérez"
        />
      </div>
      <div>
        <Label htmlFor="user-email" required={!initialData}>Correo Electrónico</Label>
        <Input
          id="user-email"
          name="email"
          type="email"
          value={formData.email || ""}
          onChange={handleChange}
          required={!initialData}
          placeholder="ejemplo@efe.cl"
          // Un contacto de notificación sí puede definir/cambiar su email (es opcional para ellos)
          disabled={!!initialData && initialData.role !== 'contacto'}
        />
      </div>
      {(!initialData || initialData.role === 'contacto') && (
        <div>
          <Label htmlFor="user-password" required={!initialData}>
            {initialData?.role === 'contacto' ? "Contraseña (para activar acceso)" : "Contraseña"}
          </Label>
          <Input
            id="user-password"
            name="password"
            type="password"
            value={formData.password || ""}
            onChange={handleChange}
            required={!initialData}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
      )}
      
      <div className="pt-2 pb-4 border-b border-border-100">
        <label className="text-sm font-medium text-text-200 mb-1 block">Rol</label>
        <select name="role" value={formData.role || 'visualizador'} onChange={handleChange}
          className="w-full bg-bg-200 border border-border/30 rounded-lg px-3 py-2 text-[13px] text-text-100 outline-none focus:border-brand-100/50"
        >
          <option value="visualizador">Visualizador</option>
          <option value="admin_efe">Admin EFE</option>
          <option value="superadmin">Superadmin</option>
          <option value="contacto">Contacto (sin login)</option>
        </select>
        <p className="text-xs text-text-300 mt-1">
          {formData.role === 'superadmin'
            ? 'Superadmins tienen acceso a todas las empresas automáticamente.'
            : formData.role === 'admin_efe'
              ? 'Admin EFE puede gestionar empresas asignadas.'
              : formData.role === 'contacto'
                ? 'Contacto de notificación: no puede iniciar sesión. Solo el superadmin puede activarlo.'
                : 'Visualizador solo puede ver datos.'}
        </p>
      </div>

      <div className="pt-2 pb-4 border-b border-border-100">
        <label className="text-sm font-medium text-text-200 mb-2 block">Notificaciones (llamadas / WhatsApp / correo)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="user-phone-call">Teléfono para llamadas</Label>
            <Input
              id="user-phone-call"
              name="phone_call"
              value={formData.phone_call || ""}
              onChange={handleChange}
              placeholder="+56912345678"
            />
          </div>
          <div>
            <Label htmlFor="user-phone-whatsapp">Teléfono WhatsApp</Label>
            <Input
              id="user-phone-whatsapp"
              name="phone_whatsapp"
              value={formData.phone_whatsapp || ""}
              onChange={handleChange}
              placeholder="+56912345678"
            />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="user-notify-email">Correo de notificación (opcional)</Label>
          <Input
            id="user-notify-email"
            name="notify_email_address"
            type="email"
            value={formData.notify_email_address || ""}
            onChange={handleChange}
            placeholder="notificaciones@empresa.cl"
          />
          <p className="text-xs text-text-300 mt-1">
            Puede ser distinto al correo de acceso al sistema (p.ej. un correo de empresa para recibir las notificaciones).
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3">
          <Checkbox id="user-is-active" label="Usuario activo (puede iniciar sesión)" name="is_active" checked={formData.is_active ?? true} onChange={handleChange} />
          <Checkbox id="user-notify-calls" label="Recibe llamadas" name="notify_calls" checked={formData.notify_calls ?? false} onChange={handleChange} />
          <Checkbox id="user-notify-whatsapp" label="Recibe WhatsApp" name="notify_whatsapp" checked={formData.notify_whatsapp ?? false} onChange={handleChange} />
          <Checkbox id="user-notify-email" label="Recibe correos" name="notify_email" checked={formData.notify_email ?? false} onChange={handleChange} />
        </div>
        <p className="text-xs text-text-300 mt-2">
          Si marcas alguna opción de notificación, el usuario aparecerá en la sección "Notificaciones Usuarios" y Node-RED podrá llamarlo/enviarle mensajes según la empresa.
        </p>
      </div>

      {formData.role !== 'superadmin' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-200">
            Empresas Asignadas
          </label>
          <div className="bg-bg-200 border border-border-100 rounded-lg p-3 max-h-40 overflow-y-auto flex flex-col gap-2">
            {companies.length === 0 ? (
              <p className="text-xs text-text-400 italic">No hay empresas registradas.</p>
            ) : (
              companies.map((company) => (
                <Checkbox
                  key={company.id}
                  label={company.name}
                  name={`company_${company.id}`}
                  checked={selectedCompanies.includes(company.id)}
                  onChange={() => handleCompanyToggle(company.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border-100">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" isLoading={isLoading}>
          {initialData ? "Guardar Cambios" : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
