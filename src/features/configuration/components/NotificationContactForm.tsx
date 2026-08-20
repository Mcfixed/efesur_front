import React, { useState } from "react";
import { User } from "../../types/config.types";
import { Button, Input, Checkbox, Label } from "@/components/ui";

interface NotificationContactFormProps {
  initialData?: User | null;
  companyName: string;
  onSubmit: (data: Partial<User>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Formulario para crear/editar un CONTACTO DE NOTIFICACIÓN.
 * Un contacto es un registro en `users` apto para recibir llamadas/WhatsApp/correos
 * desde Node-RED, pero que NO puede iniciar sesión en el sistema (sin password,
 * is_active=false y role='contacto'). Solo el superadmin puede activarlo como
 * usuario real desde la sección "Usuarios".
 */
export function NotificationContactForm({ initialData, companyName, onSubmit, onCancel, isLoading }: NotificationContactFormProps) {
  const [formData, setFormData] = useState<Partial<User>>({
    name: initialData?.name || "",
    phone_call: initialData?.phone_call ?? "",
    phone_whatsapp: initialData?.phone_whatsapp ?? "",
    notify_email_address: initialData?.notify_email_address ?? "",
    notify_calls: initialData?.notify_calls ?? false,
    notify_whatsapp: initialData?.notify_whatsapp ?? false,
    notify_email: initialData?.notify_email ?? false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="contact-name" required>Nombre del contacto</Label>
        <Input
          id="contact-name"
          name="name"
          value={formData.name || ""}
          onChange={handleChange}
          required
          placeholder="Ej: Juan Pérez"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contact-phone-call">Teléfono para llamadas</Label>
          <Input
            id="contact-phone-call"
            name="phone_call"
            value={formData.phone_call || ""}
            onChange={handleChange}
            placeholder="+56912345678"
          />
        </div>
        <div>
          <Label htmlFor="contact-phone-whatsapp">Teléfono WhatsApp</Label>
          <Input
            id="contact-phone-whatsapp"
            name="phone_whatsapp"
            value={formData.phone_whatsapp || ""}
            onChange={handleChange}
            placeholder="+56912345678"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-notify-email">Correo de notificación (opcional)</Label>
        <Input
          id="contact-notify-email"
          name="notify_email_address"
          type="email"
          value={formData.notify_email_address || ""}
          onChange={handleChange}
          placeholder="notificaciones@empresa.cl"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
        <Checkbox id="contact-notify-calls" label="Recibe llamadas" name="notify_calls" checked={formData.notify_calls ?? false} onChange={handleChange} />
        <Checkbox id="contact-notify-whatsapp" label="Recibe WhatsApp" name="notify_whatsapp" checked={formData.notify_whatsapp ?? false} onChange={handleChange} />
        <Checkbox id="contact-notify-email2" label="Recibe correos" name="notify_email" checked={formData.notify_email ?? false} onChange={handleChange} />
      </div>
      <div className="rounded-lg bg-bg-200 border border-border/30 px-3 py-2 text-xs text-text-300">
        Empresa: <strong className="text-text-200">{companyName || "—"}</strong>
      </div>
      <div className="flex justify-end gap-3 mt-2">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {initialData ? "Guardar" : "Crear contacto"}
        </Button>
      </div>
    </form>
  );
}
