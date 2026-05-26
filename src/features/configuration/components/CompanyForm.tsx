import React, { useState, useEffect } from "react";
import { Company } from "../../types/config.types";
import { Button, Input, Checkbox } from "@/components/ui";

interface CompanyFormProps {
  initialData?: Company | null;
  onSubmit: (data: Partial<Company>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CompanyForm({ initialData, onSubmit, onCancel, isLoading }: CompanyFormProps) {
  const [formData, setFormData] = useState<Partial<Company>>({
    name: "",
    rut: "",
    sector: "",
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        rut: initialData.rut,
        sector: initialData.sector,
        is_active: initialData.is_active,
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre de la Empresa"
        name="name"
        value={formData.name || ""}
        onChange={handleChange}
        required
        placeholder="Ej: EFE Sur"
      />
      <Input
        label="RUT"
        name="rut"
        value={formData.rut || ""}
        onChange={handleChange}
        required
        placeholder="Ej: 76.123.456-7"
      />
      <Input
        label="Sector / Rubro"
        name="sector"
        value={formData.sector || ""}
        onChange={handleChange}
        placeholder="Ej: Transporte Ferroviario"
      />
      <div className="pt-2">
        <Checkbox
          label="Empresa Activa"
          name="is_active"
          checked={formData.is_active || false}
          onChange={handleChange}
        />
        <p className="text-xs text-text-300 mt-1 ml-6">
          Si se desactiva, los usuarios y dispositivos asociados podrían perder acceso.
        </p>
      </div>
      
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border-100">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" isLoading={isLoading}>
          {initialData ? "Guardar Cambios" : "Crear Empresa"}
        </Button>
      </div>
    </form>
  );
}
