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
    is_superuser: false,
  });

  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        is_superuser: initialData.is_superuser,
      });
      // Extract assigned company IDs
      if (initialData.company_assignments) {
        setSelectedCompanies(initialData.company_assignments.map((c: any) => c.company_id));
      }
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
        <Checkbox
          label="Es Superadministrador"
          name="is_superuser"
          checked={formData.is_superuser || false}
          onChange={handleChange}
        />
        <p className="text-xs text-text-300 mt-1 ml-6">
          Los superadministradores tienen acceso a todas las empresas automáticamente.
        </p>
      </div>

      {!formData.is_superuser && (
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
