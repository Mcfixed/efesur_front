import { Navigate, useLocation } from "react-router";
import { useBetterSession } from "../hooks";
import { useEffect, useState, type ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * Pantalla de espera cuando no se pudo VALIDAR la sesión (base de datos o red caída).
 * No se manda al login: la sesión sigue siendo válida y se reintenta sola, así un corte
 * de infraestructura no saca al usuario de la plataforma.
 */
function Reconectando({ reintentar }: { reintentar?: () => Promise<boolean> }) {
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const tick = async () => {
      const ok = await reintentar?.();
      if (!cancelado && !ok) setIntentos((n) => n + 1);
    };
    const id = window.setInterval(tick, 3000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [reintentar]);

  return (
    <div className="bg-bg-100 text-text-100 h-screen w-screen flex flex-col items-center justify-center gap-2">
      <span className="text-lg font-semibold">Reconectando con el servidor…</span>
      <span className="text-text-200 text-sm">
        El servidor no respondió. Tu sesión se mantiene y la página vuelve sola.
      </span>
      {intentos > 0 && (
        <span className="text-text-300 text-xs">Reintentos: {intentos}</span>
      )}
    </div>
  );
}

/**
 * Componente para proteger rutas que requieren autenticacion
 */
export function ProtectedRoute({
  children,
  redirectTo = "/login",
  fallback = (
    <div className="bg-bg-100 text-text-100 h-screen w-screen flex items-center justify-center">
      Cargando...
    </div>
  ),
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, sessionError, reintentarSesion } = useBetterSession();
  const location = useLocation();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    // Si la sesión no se pudo validar (base/red caída) NO es un logout: se espera y se reintenta.
    if (sessionError) {
      return <Reconectando reintentar={reintentarSesion} />;
    }
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

interface PublicOnlyRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Componente para rutas solo accesibles sin autenticacion
 * (ej: login, register)
 */
export function PublicOnlyRoute({
  children,
  redirectTo = "/dashboard",
}: PublicOnlyRouteProps) {
  const { isAuthenticated, isLoading } = useBetterSession();

  if (isLoading) {
    return (
      <div className="bg-bg-100 text-text-100 h-screen w-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
