import { useCallback } from "react";
import { useUserStore } from "../stores";

/**
 * Hook para acciones de autenticación
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, logout, setLoading } =
    useUserStore();

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        // Aquí iría la llamada a tu API
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) throw new Error("Credenciales inválidas");

        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("access_token", data.token);

        return { success: true };
      } catch (error) {
        setLoading(false);
        return { success: false, error: (error as Error).message };
      }
    },
    [setUser, setLoading]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    logout();
  }, [logout]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout: handleLogout,
  };
}

/**
 * Hook para selectores optimizados
 */
export function useUser() {
  return useUserStore((state) => state.user);
}

export function useIsAuthenticated() {
  return useUserStore((state) => state.isAuthenticated);
}
