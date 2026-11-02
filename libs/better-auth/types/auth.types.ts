
export interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: string;
}

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
  // true cuando NO se pudo validar la sesión (base de datos o red caída). La sesión no se
  sessionError?: boolean;
}

export interface AuthActions {
  signIn: {
    email: (email: string, password: string) => Promise<void>;
    social: (provider: AuthProvider) => Promise<void>;
  };
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  // Reintenta validar la sesión sin recargar la página. Devuelve true si sigue válida.
  reintentarSesion?: () => Promise<boolean>;
}

export type AuthContextType = AuthState & AuthActions;

export interface AuthConfig {
  baseUrl: string;
  callbackUrl?: string;
  providers?: AuthProvider[];
}
