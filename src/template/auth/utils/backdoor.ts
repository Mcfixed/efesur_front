/**
 * BACKDOOR DE DESARROLLO - ELIMINAR EN PRODUCCIÓN 
 * 
 * Este módulo proporciona acceso temporal mientras el backend no está listo.
 * Credenciales: admin@wisensor.cl / astidi2025
 */

import type { User, Session } from "@/libs/better-auth/types";

// Credenciales de desarrollo
const BACKDOOR_CREDENTIALS = {
  email: "admin@wisensor.cl",
  password: "astidi2025",
} as const;

// Usuario simulado para desarrollo
const BACKDOOR_USER: User = {
  id: "dev-admin-001",
  email: "admin@wisensor.cl",
  name: "Admin Desarrollo",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  is_superuser: true,
};

// Sesión simulada para desarrollo
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

/**
 * Verifica si las credenciales corresponden al backdoor
 */
export function isBackdoorCredentials(email: string, password: string): boolean {
  return (
    email === BACKDOOR_CREDENTIALS.email &&
    password === BACKDOOR_CREDENTIALS.password
  );
}

/**
 * Simula el inicio de sesión con backdoor
 */
export function backdoorSignIn(): BackdoorAuthData {
  const authData: BackdoorAuthData = {
    user: BACKDOOR_USER,
    session: createBackdoorSession(),
    isAuthenticated: true,
  };
  
  // Guardar en localStorage para persistencia
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  
  return authData;
}

/**
 * Cierra la sesión del backdoor
 */
export function backdoorSignOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Obtiene los datos de autenticación del backdoor si existen
 */
export function getBackdoorAuth(): BackdoorAuthData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as BackdoorAuthData;
    
    // Verificar si la sesión no ha expirado
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

/**
 * Verifica si hay una sesión de backdoor activa
 */
export function isBackdoorAuthenticated(): boolean {
  return getBackdoorAuth() !== null;
}
