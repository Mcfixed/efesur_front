import { IconBuildingSkyscraper, IconSettings } from "@tabler/icons-react";
import { useUserProfile } from "../hooks";
import { useCompanyConfig } from "@/template/companies";

export default function UserProfilePanel() {
  const { profile, loading, error, loadProfile } = useUserProfile();
  const { companyConfig } = useCompanyConfig(profile?.companies[0]?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-text-100">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className=" bg-red-950 p-4 text-red-400 border border-red-800">
        <h3 className="font-semibold">Error</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadProfile}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const { user, companies, services, total_companies, total_services } =
    profile;

  return (
    <div className="space-y-6 w-full grid grid-cols-2 gap-4">
      {/* Información del usuario */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-text-100">
              Información del Usuario
            </h3>
            <p className="mt-1 text-sm text-text-200">
              Datos de tu cuenta y accesos
            </p>
          </div>
          {user.role === 'superadmin' && (
            <span className="rounded-full bg-purple-950 border border-purple-500 px-3 py-1 text-xs font-semibold text-purple-200">
              SUPERADMIN
            </span>
          )}
          {user.role === 'admin_efe' && (
            <span className="rounded-full bg-blue-950 border border-blue-500 px-3 py-1 text-xs font-semibold text-blue-200">
              ADMIN
            </span>
          )}
          {(!user.role || user.role === 'visualizador') && (
            <span className="rounded-full bg-gray-800 border border-gray-500 px-3 py-1 text-xs font-semibold text-gray-300">
              VISUALIZADOR
            </span>
          )}
        </div>

        <div className="mt-5 py-5 grid grid-cols-1 gap-4 border-t border-border-200">
          <div>
            <label className="text-sm font-medium text-text-200">Nombre</label>
            <p className="mt-1 text-base font-semibold text-text-100">
              {user.name}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-200">Email</label>
            <p className="mt-1 text-base font-semibold text-text-100">
              {user.email}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-200">Estado</label>
            <p className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  user.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {user.is_active ? "Activo" : "Inactivo"}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-200">
              Fecha de Creación
            </label>
            <p className="mt-1 text-base text-text-100">
              {new Date(user.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="relative grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          <div className="col-span-2 flex justify-center items-center py-5">
            <small className="text-text-200">Resumen Rápido</small>
          </div>
          <div className="flex items-center p-6 border border-border-200 rounded-2xl">
            <div className="text-3xl">
              <IconBuildingSkyscraper size={25} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-text-100">Compañías</p>
              <p className="text-2xl font-bold text-text-100">
                {total_companies}
              </p>
            </div>
          </div>
          <div className="flex items-center p-6 border border-border-200 rounded-2xl">
            <div className="text-3xl">
              <IconSettings size={25} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-text-100">Servicios</p>
              <p className="text-2xl font-bold text-text-100">
                {total_services}
              </p>
            </div>
          </div>
        </div>

        {/* Compañías */}
        {companies.length > 0 && (
          <div className=" bg-bg-100 p-6 shadow">
            <h3 className="text-lg font-semibold text-text-100 mb-4">
              Mis Compañías
            </h3>
            <div className="space-y-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  style={{
                    backgroundColor: companyConfig?.color_theme,
                  }}
                  className="flex items-center  rounded justify-between  border border-border-200 p-4 hover:bg-bg-200"
                >
                  <div>
                    <h2 className="font-bold text-text-100">{company.name} </h2>
                    <p className="text-sm text-text-100">RUT: {company.rut}</p>
                    <p className="text-sm text-text-100">
                      {companyConfig?.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Servicios */}
        {services.length > 0 && (
          <div className=" bg-bg-100 p-6 shadow">
            <h3 className="text-lg font-semibold text-text-100 mb-4">
              Mis Servicios
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className=" border border-border p-4 hover:bg-bg-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-100">
                        {service.name}
                      </p>
                      <p className="text-xs text-text-200 mt-1">
                        {service.code}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      Activo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
