// ============================================
// Tipos de Usuario
// ============================================

export interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  is_superuser?: boolean;
  role?: string;
}

// ============================================
// Tipos de Sesión
// ============================================

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  session: Session | null;
  user: BetterAuthUser | null;
}

// ============================================
// Tipos de Autenticación
// ============================================

export type AuthProvider = "google" | "github" | "facebook" | "twitter";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  name: string;
}

export interface AuthState {
  session: Session | null;
  user: BetterAuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthActions {
  signIn: {
    email: (email: string, password: string) => Promise<void>;
    social: (provider: AuthProvider) => Promise<void>;
  };
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export type AuthContextType = AuthState & AuthActions;

// ============================================
// Tipos de Configuración
// ============================================

export interface AuthConfig {
  baseUrl: string;
  callbackUrl?: string;
  providers?: AuthProvider[];
}
