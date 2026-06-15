export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  role?: string;
  created_at: string;
  total_services?: number;
}

export interface UserProfile {
  user: User;
  companies: {
    id: number;
    name: string;
    rut: string;
  }[];
  services: {
    id: number;
    name: string;
    code: string;
  }[];
  total_companies: number;
  total_services: number;
}
