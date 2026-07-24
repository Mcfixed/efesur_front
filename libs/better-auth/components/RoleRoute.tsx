import { Navigate } from "react-router";
import { useBetterSession } from "../hooks";
import type { ReactNode } from "react";

interface RoleRouteProps {
  children: ReactNode;
  roles?: string[];
  redirectTo?: string;
}

export function RoleRoute({
  children,
  roles,
  redirectTo = "/",
  fallback = (
    <div className="bg-bg-100 text-text-100 h-screen w-screen flex items-center justify-center">
      Cargando...
    </div>
  ),
}: RoleRouteProps & { fallback?: ReactNode }) {
  const { user, isLoading } = useBetterSession();
  const role = user?.role || 'visualizador';

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
