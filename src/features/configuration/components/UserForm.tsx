import React, { useState, useEffect } from "react";
import { User, Company } from "../../types/config.types";
import { Button, Input, Checkbox } from "@/components/ui";

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
  });

  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role,
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
      <Input
        label="Nombre Completo"
        name="name"
        value={formData.name || ""}
        onChange={handleChange}
        required
        placeholder="Ej: Juan Pérez"
      />
      <Input
        label="Correo Electrónico"
        name="email"
        type="email"
        value={formData.email || ""}
        onChange={handleChange}
        required
        placeholder="ejemplo@efe.cl"
        disabled={!!initialData} // No permitimos cambiar email por ahora
      />
      {!initialData && (
        <Input
          label="Contraseña"
          name="password"
          type="password"
          value={formData.password || ""}
          onChange={handleChange}
          required
          placeholder="Mínimo 8 caracteres"
        />
      )}
      
      <div className="pt-2 pb-4 border-b border-border-100">
        <label className="text-sm font-medium text-text-200 mb-1 block">Rol</label>
        <select name="role" value={formData.role || 'visualizador'} onChange={handleChange}
          className="w-full bg-bg-200 border border-border/30 rounded-lg px-3 py-2 text-[13px] text-text-100 outline-none focus:border-brand-100/50"
        >
          <option value="visualizador">Visualizador</option>
          <option value="admin_efe">Admin EFE</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <p className="text-xs text-text-300 mt-1">
          {formData.role === 'superadmin'
            ? 'Superadmins tienen acceso a todas las empresas automáticamente.'
            : formData.role === 'admin_efe'
              ? 'Admin EFE puede gestionar empresas asignadas.'
              : 'Visualizador solo puede ver datos.'}
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
