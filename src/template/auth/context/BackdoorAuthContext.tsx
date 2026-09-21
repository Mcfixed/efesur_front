/**
 *  BACKDOOR AUTH PROVIDER - ELIMINAR EN PRODUCCIÓN 
 * 
 * Este contexto envuelve la autenticación real y agrega soporte para
 * el backdoor de desarrollo. Una vez que el backend esté listo,
 * reemplazar BackdoorAuthProvider por AuthProvider en el árbol de componentes.
 */

import {
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { authClient, useSession as useBetterAuthSession } from "@/libs/better-auth/config";
// Importar el contexto original para mantener compatibilidad con useAuth, useSession, etc.
import { AuthContext } from "@/libs/better-auth/context";
import type {
  AuthContextType,
  AuthProvider as AuthProviderType,
  SignUpCredentials,
  BetterAuthUser as User,
  Session,
} from "@/libs/better-auth/types";
import {
  isBackdoorCredentials,
  backdoorSignIn,
  backdoorSignOut,
  getBackdoorAuth,
} from "../utils/backdoor";

interface BackdoorAuthProviderProps {
  children: ReactNode;
}

export function BackdoorAuthProvider({ children }: BackdoorAuthProviderProps) {
  // Datos de la sesión real de better-auth
  const { data: sessionData, isPending } = useBetterAuthSession();
  
  // Estado local para el backdoor (inicializado desde localStorage)
  const [backdoorData, setBackdoorData] = useState<{
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
  }>(() => {
    const stored = getBackdoorAuth();
    return stored || { user: null, session: null, isAuthenticated: false };
  });
  
  const [error, setError] = useState<string | null>(null);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      
      //  BACKDOOR: Verificar primero si son credenciales de desarrollo
      if (isBackdoorCredentials(email, password)) {
        const authData = backdoorSignIn();
        setBackdoorData({
          user: authData.user,
          session: authData.session,
          isAuthenticated: true,
        });
        return;
      }
      
      // Si no es backdoor, usar autenticación real con la librería
      // service_code se inyecta automáticamente en authClient (customFetchImpl)
      // signIn.email() retorna { data, error } — nunca lanza excepción
      const result = await authClient.signIn.email({ email, password });

      if (result.error) {
        const message = result.error.message || "Error al iniciar sesión";
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const signInWithSocial = useCallback(async (provider: AuthProviderType) => {
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
    
    // Si hay sesión de backdoor, cerrarla
    if (backdoorData.isAuthenticated) {
      backdoorSignOut();
      setBackdoorData({
        user: null,
        session: null,
        isAuthenticated: false,
      });
      return;
    }
    
    // Si no, cerrar sesión real
    try {
      await authClient.signOut();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [backdoorData.isAuthenticated]);

  const refreshSession = useCallback(async () => {}, []);

  // Priorizar backdoor sobre sesión real
  const isBackdoorAuth = backdoorData.isAuthenticated;
  const finalUser = isBackdoorAuth ? backdoorData.user : (sessionData?.user as User | null);
  const finalSession = isBackdoorAuth ? backdoorData.session : (sessionData?.session as Session | null);
  const isAuthenticated = isBackdoorAuth || !!sessionData?.session;

  const value: AuthContextType = {
    session: finalSession,
    user: finalUser,
    isLoading: isPending && !isBackdoorAuth,
    isAuthenticated,
    error,
    signIn: {
      email: signInWithEmail,
      social: signInWithSocial,
    },
    signUp,
    signOut,
    refreshSession,
  };

  // Usar el AuthContext original para mantener compatibilidad con todos los hooks existentes
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
