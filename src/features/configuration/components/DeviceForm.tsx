import React, { useState, useEffect } from "react";
import { Device, Company } from "../../types/config.types";
import { Button, Input, Checkbox } from "@/components/ui";

interface DeviceFormProps {
  initialData?: Device | null;
  companies: Company[];
  lectors: Device[];
  onSubmit: (data: Partial<Device>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeviceForm({ initialData, companies, lectors, onSubmit, onCancel, isLoading }: DeviceFormProps) {
  const [formData, setFormData] = useState<Partial<Device>>({
    dev_eui: "",
    name: "",
    type_device: "Gps",
    company_id: companies.length > 0 ? companies[0].id : undefined,
    id_device_father: null,
    is_active: true,
    latitude_current: null,
    longitude_current: null,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        dev_eui: initialData.dev_eui,
        name: initialData.name,
        type_device: initialData.type_device,
        company_id: initialData.company_id,
        id_device_father: initialData.id_device_father,
        is_active: initialData.is_active,
        latitude_current: initialData.latitude_current,
        longitude_current: initialData.longitude_current,
      });
    } else if (companies.length > 0 && !formData.company_id) {
      setFormData(prev => ({ ...prev, company_id: companies[0].id }));
    }
  }, [initialData, companies]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Type casting for checkboxes
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : 
              name === "company_id" ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };
    // Limpiar campos nulos para que el backend los trate como opcionales
    if (payload.latitude_current === "" || payload.latitude_current === null) {
      delete payload.latitude_current;
    }
    if (payload.longitude_current === "" || payload.longitude_current === null) {
      delete payload.longitude_current;
    }
    if (payload.id_device_father === null || payload.id_device_father === undefined) {
      delete payload.id_device_father;
    }
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dev_eui" className="text-sm font-medium text-text-200">DevEUI</label>
        <Input
          id="dev_eui"
          name="dev_eui"
          value={formData.dev_eui || ""}
          onChange={handleChange}
          required
          placeholder="Ej: A1B2C3D4E5F6G7H8"
          disabled={!!initialData} // No se cambia el DevEUI una vez creado
        />
        <p className="text-xs text-text-300">Identificador único del dispositivo LoRaWAN (16 caracteres hexadecimales). No se puede modificar después de crear el dispositivo.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="device_name" className="text-sm font-medium text-text-200">Nombre del Dispositivo</label>
        <Input
          id="device_name"
          name="name"
          value={formData.name || ""}
          onChange={handleChange}
          required
          placeholder="Ej: Locomotora 502"
        />
      </div>
      
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-200">Tipo de Dispositivo</label>
        <select
          name="type_device"
          value={formData.type_device || "GPS"}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-bg-200 border border-border-200 rounded-lg focus:outline-none focus:border-brand-200 text-text-100 transition-colors"
          required
        >
          <option value="Gps">GPS (Telemetría)</option>
          <option value="Gateway">Gateway LoRaWAN</option>
          <option value="SubEstacion">Subestación</option>
          <option value="Lector">Lector</option>
        </select>
      </div>

      {/* Lector asociado (solo para Gateways) */}
      {formData.type_device === "Gateway" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-200">Dispositivo Lector Asociado</label>
          <select
            name="id_device_father"
            value={formData.id_device_father ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setFormData((prev) => ({
                ...prev,
                id_device_father: val ? parseInt(val) : null,
              }));
            }}
            className="w-full px-3 py-2 bg-bg-200 border border-border-200 rounded-lg focus:outline-none focus:border-brand-200 text-text-100 transition-colors"
          >
            <option value="">Sin lector asociado</option>
            {lectors
              .filter(l => l.company_id === formData.company_id || !formData.company_id)
              .map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.dev_eui})</option>
              ))}
          </select>
          <p className="text-xs text-text-300">Selecciona el dispositivo Lector que este gateway supervisa. Los datos del lector (batería, panel solar) aparecerán en el tab "Lector asignado".</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-200">Empresa Asignada</label>
        <select
          name="company_id"
          value={formData.company_id || ""}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-bg-200 border border-border-200 rounded-lg focus:outline-none focus:border-brand-200 text-text-100 transition-colors"
          required
        >
          {companies.length === 0 && <option value="" disabled>Sin empresas registradas</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ── Ubicación ── */}
      <div className="border-t border-border-100 pt-3">
        <p className="text-sm font-semibold text-text-200 mb-3">Ubicación del Dispositivo</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitud"
            name="latitude_current"
            type="number"
            step="any"
            value={formData.latitude_current ?? ""}
            onChange={handleChange}
            placeholder="Ej: -33.4489"
          />
          <Input
            label="Longitud"
            name="longitude_current"
            type="number"
            step="any"
            value={formData.longitude_current ?? ""}
            onChange={handleChange}
            placeholder="Ej: -70.6693"
          />
        </div>
        <p className="text-xs text-text-300 mt-1">
          Coordenadas geográficas del dispositivo (opcional).
        </p>
      </div>

      <div className="pt-2">
        <Checkbox
          label="Dispositivo Activo"
          name="is_active"
          checked={formData.is_active || false}
          onChange={handleChange}
        />
        <p className="text-xs text-text-300 mt-1 ml-6">
          Los dispositivos inactivos no se muestran en el dashboard ni registran telemetría.
        </p>
      </div>
      
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border-100">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" isLoading={isLoading}>
          {initialData ? "Guardar Cambios" : "Crear Dispositivo"}
        </Button>
      </div>
    </form>
  );
}
