export interface Company {
  id: number;
  name: string;
  rut: string;
  address?: string;
  phone?: string;
  email?: string;
  status: boolean;
  color_theme?: string;
  url_image?: string;
  url_website?: string;
  coordinates?: string;
  total_users?: number;
  total_services?: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  role?: string;
  created_at: string;
  total_services?: number;
}
