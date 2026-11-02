import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authClient, useSession as useBetterAuthSession } from "../config";
import type {
  AuthContextType,
  AuthProvider,
  SignUpCredentials,
  BetterAuthUser,
  Session,
} from "../types";

// Exportar el contexto para poder usarlo en proveedores alternativos (ej: BackdoorAuthProvider)
export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: sessionData, isPending, error: sessionQueryError } = useBetterAuthSession();
  const [error, setError] = useState<string | null>(null);
  // Se activa cuando no se pudo validar la sesión (base/red caída), no cuando no hay sesión.
  const [falloSesion, setFalloSesion] = useState(false);

  // Estado local para reflejar el login inmediatamente mientras better-auth
  const [localAuth, setLocalAuth] = useState<{
    user: BetterAuthUser | null;
    isAuthenticated: boolean;
  } | null>(null);

  // Verdadero mientras se intenta restaurar la sesión desde localStorage (tras F5)
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(
    () => !!localStorage.getItem("auth_token")
  );

  // Al montar (o tras un F5), si hay token en localStorage intentamos restaurar
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    authClient.getSession().then((result) => {
      if (result?.data?.user) {
        setLocalAuth({
          user: result.data.user as BetterAuthUser,
          isAuthenticated: true,
        });
        setFalloSesion(false);
      } else {
        // Respuesta válida sin usuario: el token sí es inválido o expiró — limpiar
        localStorage.removeItem("auth_token");
      }
    }).catch(() => {
      // No se pudo validar (base caída / red): se CONSERVA el token y se avisa para reintentar.
      setFalloSesion(true);
    }).finally(() => {
      setIsRestoringSession(false);
    });
  }, []);

  // Reintenta validar la sesión sin recargar la página (usado cuando el backend no responde)
  const reintentarSesion = useCallback(async () => {
    try {
      const result = await authClient.getSession();
      if (result?.data?.user) {
        setLocalAuth({
          user: result.data.user as BetterAuthUser,
          isAuthenticated: true,
        });
        setFalloSesion(false);
        return true;
      }
    } catch {
      /* el backend sigue sin responder */
    }
    return false;
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      // service_code se inyecta automáticamente en authClient (customFetchImpl)
      const result = await authClient.signIn.email({ email, password });

      if (result.error) {
        const message = result.error.message || "Error al iniciar sesión";
        setError(message);
        throw new Error(message);
      }

      // Guardar token en localStorage para enviarlo como Authorization header
      const token = (result.data as { session?: { token?: string } } | null)?.session?.token;
      if (token) {
        localStorage.setItem("auth_token", token);
      }

      // Guardar user en estado local para que isAuthenticated sea true
      setLocalAuth({
        user: (result.data?.user as BetterAuthUser) ?? null,
        isAuthenticated: true,
      });
    },
    [],
  );

  const signInWithSocial = useCallback(async (provider: AuthProvider) => {
    setError(null);
    try {
      await authClient.signIn.social({ provider });
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    setError(null);
    try {
      await authClient.signUp.email({
        email: credentials.email,
        password: credentials.password,
        name: credentials.name,
      });
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await authClient.signOut();
      localStorage.removeItem("auth_token");
      setLocalAuth(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const refreshSession = useCallback(async () => {}, []);

  // localAuth actúa como override inmediato tras el login;
  const effectiveUser = (sessionData?.user as BetterAuthUser | null) ?? localAuth?.user ?? null;
  const effectiveSession = sessionData?.session as Session | null;
  const isAuthenticated = !!effectiveSession || (localAuth?.isAuthenticated ?? false);

  const value: AuthContextType = {
    session: effectiveSession,
    user: effectiveUser,
    isLoading: isPending || isRestoringSession,
    isAuthenticated,
    error,
    // Error al consultar la sesión sin usuario: casi siempre es la base caída, no un logout
    sessionError: falloSesion || (!!sessionQueryError && !sessionData?.user),
    reintentarSesion,
    signIn: {
      email: signInWithEmail,
      social: signInWithSocial,
    },
    signUp,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext debe usarse dentro de AuthProvider");
  }
  return context;
}
