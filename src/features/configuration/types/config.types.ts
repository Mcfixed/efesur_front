export interface Company {
  id: number;
  name: string;
  rut: string;
  sector: string;
  color_theme: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  device_count?: string;
  user_count?: string;
}

export interface UserCompanyAssignment {
  company_id: number;
  company_name: string;
  role: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  created_at: string;
  company_assignments?: UserCompanyAssignment[];
}

export interface Device {
  id: number;
  dev_eui: string;
  name: string;
  company_id: number | null;
  id_device_father: number | null;
  type_device: string;
  is_active: boolean;
  last_seen: string | null;
  latitude_current: number | null;
  longitude_current: number | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  specific_data?: Record<string, any>;
}

export interface CompanyConfig {
  id: number;
  company_id: number;
  url: string | null;
  color: string | null;
}

export interface RoleCount {
  role: string;
  count: string;
}
