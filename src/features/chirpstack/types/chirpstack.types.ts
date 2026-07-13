export interface GpsDevice {
  id: number;
  dev_eui: string;
  name: string;
  type_device: string;
  is_active: boolean;
  last_seen: string | null;
  operating_mode: string;
}

export interface ChirpstackCommand {
  key: string;
  label: string;
  hex: string;
  fPort: number;
  group: string;
}

export interface SendResult {
  command: string;
  commandLabel: string;
  total: number;
  exito: number;
  fallo: number;
  detalles: { devEui: string; status: string; error?: string }[];
}
