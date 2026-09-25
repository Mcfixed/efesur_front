import { useEffect, useRef } from "react";
import { useBetterSession } from "@/libs/better-auth";
import { queryClient } from "@/libs/tanstack-query";

/**
 * Vacía la caché de React Query cuando cambia el usuario autenticado.
 *
 * El QueryClient global tiene staleTime de 5 min y no se limpiaba al cerrar
 * sesión, así que la sesión nueva podía servir datos cacheados de la anterior
 * (p. ej. un admin_efe veía la lista de empresas del superadmin).
 */
export default function SessionCacheGuard() {
  const { user, isLoading } = useBetterSession();
  const userId = user?.id ?? null;
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;
    // Primer valor tras restaurar la sesión: solo se registra
    if (prevUserId.current === undefined) {
      prevUserId.current = userId;
      return;
    }
    if (prevUserId.current !== userId) {
      queryClient.clear();
      prevUserId.current = userId;
    }
  }, [userId, isLoading]);

  return null;
}
