/**
 * BACKDOOR DE DESARROLLO - ELIMINAR EN PRODUCCIÓN 
 * 
 * Acceso temporal de desarrollo (backend no listo).
 * Credenciales: admin@wisensor.cl / astidi2025
 */

import type { BetterAuthUser as User, Session } from "@/libs/better-auth/types";

const BACKDOOR_CREDENTIALS = {
  email: "admin@wisensor.cl",
  password: "astidi2025",
} as const;

const BACKDOOR_USER: User = {
  id: "dev-admin-001",
  email: "admin@wisensor.cl",
  name: "Admin Desarrollo",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "superadmin",
};

const createBackdoorSession = (): Session => ({
  id: `session-${Date.now()}`,
  userId: BACKDOOR_USER.id,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
  token: `dev-token-${Date.now()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const STORAGE_KEY = "backdoor-auth";

interface BackdoorAuthData {
  user: User;
  session: Session;
  isAuthenticated: boolean;
}

export function isBackdoorCredentials(email: string, password: string): boolean {
  return (
    email === BACKDOOR_CREDENTIALS.email &&
    password === BACKDOOR_CREDENTIALS.password
  );
}

export function backdoorSignIn(): BackdoorAuthData {
  const authData: BackdoorAuthData = {
    user: BACKDOOR_USER,
    session: createBackdoorSession(),
    isAuthenticated: true,
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  
  return authData;
}

export function backdoorSignOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getBackdoorAuth(): BackdoorAuthData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as BackdoorAuthData;
    
    const expiresAt = new Date(data.session.expiresAt);
    if (expiresAt < new Date()) {
      backdoorSignOut();
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function isBackdoorAuthenticated(): boolean {
  return getBackdoorAuth() !== null;
}
