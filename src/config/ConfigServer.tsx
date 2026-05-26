//  Configuración de empresa
import logoWhite from "@/assets/company/AST-LOGO_BLANCO.png";
import logoBlack from "@/assets/company/AST-LOGO_NEGRO.png";
import { IconLayoutDashboard } from "@tabler/icons-react";
import React from "react";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import Telemetry from "@/features/telemetry/pages/Telemetry";
import Configuration from "@/features/configuration/pages/Configuration";
import { IconDeviceAnalytics, IconSettings } from "@tabler/icons-react";

// Imports del template (rutas base de la plantilla)
import { AdminPage } from "@/template/admin";
import { UserProfilePage } from "@/template/user-profile";
import { CompaniesPage } from "@/template/companies";
import { ServicesPanelPage } from "@/template/services-panel";
import { NotificationsPage } from "@/template/notifications";

const name = import.meta.env.VITE_COMPANY_NAME;
const address = import.meta.env.VITE_COMPANY_ADDRESS;
const phone = import.meta.env.VITE_COMPANY_PHONE;
const email = import.meta.env.VITE_COMPANY_EMAIL;
const website = import.meta.env.VITE_COMPANY_WEBSITE;

// Configuración de la aplicación
const app_name = import.meta.env.VITE_APP_NAME;
const app_provider = import.meta.env.VITE_APP_PROVEEDOR;
const app_theme = import.meta.env.VITE_APP_DEFAULT_THEME;

// Configuración de autenticación
const auth_url = import.meta.env.VITE_AUTH_URL || "http://localhost:3000";
const auth_callback_url = import.meta.env.VITE_AUTH_CALLBACK_URL || "/";
const auth_endpoint = "/authentication";

// Configuración del servidor de desarrollo
const server_port = import.meta.env.VITE_SERVER_PORT || 3001;
const server_host = import.meta.env.VITE_SERVER_HOST === "true";

export interface CompanyConfig {
  NAME_COMPANY: string;
  ADDRESS_COMPANY: string;
  PHONE_COMPANY: string;
  EMAIL_COMPANY: string;
  WEBSITE_COMPANY: string;
  LOGO_COMPANY_BLACK: string;
  LOGO_COMPANY_WHITE: string;
}

export interface NavigationItem {
  id: number;
  name: string;
  link: string;
  icon: React.ElementType;
  component: React.ComponentType;
  target: boolean;
  state: boolean;
}

export interface AppConfig {
  NAME_APP: string;
  PROVIDER_APP: string;
  THEME_APP?: string;
  NAVIGATION_APP: NavigationItem[];
  TEMPLATE_ROUTES?: NavigationItem[];
}

export interface AuthConfigServer {
  AUTH_URL: string;
  AUTH_CALLBACK_URL: string;
  AUTH_ENDPOINT: string;
  AUTH_LOGIN_PATH: string;
  AUTH_REGISTER_PATH: string;
  AUTH_FORGOT_PASSWORD_PATH: string;
}

export interface ServerConfig {
  SERVER_PORT: number;
  SERVER_HOST: boolean;
}

export const configServer = () => {
  const useCompany: CompanyConfig = {
    NAME_COMPANY: name,
    ADDRESS_COMPANY: address,
    PHONE_COMPANY: phone,
    EMAIL_COMPANY: email,
    WEBSITE_COMPANY: website,
    LOGO_COMPANY_BLACK: logoBlack,
    LOGO_COMPANY_WHITE: logoWhite,
  };

  // Navegación del sistema (aparece en el Sidebar)
  // Aquí se agregarán los menús específicos de cada sistema
  const NAVIGATION_DATA: NavigationItem[] = [
    {
      id: 1,
      name: "Dashboard",
      link: "/",
      icon: IconLayoutDashboard,
      component: Dashboard,
      target: false,
      state: true,
    },
    {
      id: 2,
      name: "Telemetría",
      link: "/telemetry",
      icon: IconDeviceAnalytics,
      component: Telemetry,
      target: false,
      state: true,
    },
    {
      id: 3,
      name: "Configuración",
      link: "/configuration",
      icon: IconSettings,
      component: Configuration,
      target: false,
      state: true,
    }
  ];

  // Rutas del template (aparecen en el menú de usuario del Header)
  // Estas rutas son parte de la plantilla base
  const TEMPLATE_ROUTES: NavigationItem[] = [
    {
      id: 100,
      name: "Mi Perfil",
      link: "/template/perfil",
      icon: IconLayoutDashboard,
      component: UserProfilePage,
      target: false,
      state: true,
    },
    {
      id: 101,
      name: "Mis Compañías",
      link: "/template/companias",
      icon: IconLayoutDashboard,
      component: CompaniesPage,
      target: false,
      state: true,
    },
    {
      id: 102,
      name: "Mis Servicios",
      link: "/template/servicios",
      icon: IconLayoutDashboard,
      component: ServicesPanelPage,
      target: false,
      state: true,
    },
    {
      id: 103,
      name: "Panel Admin",
      link: "/template/admin",
      icon: IconLayoutDashboard,
      component: AdminPage,
      target: false,
      state: true,
    },
    {
      id: 104,
      name: "Configuración",
      link: "/template/configuracion",
      icon: IconLayoutDashboard,
      component: () => <div className="p-6">Configuración del sistema</div>,
      target: false,
      state: true,
    },
    {
      id: 105,
      name: "Notificaciones",
      link: "/template/notificaciones",
      icon: IconLayoutDashboard,
      component: NotificationsPage,
      target: false,
      state: true,
    },
  ];

  const useConfigApp: AppConfig = {
    NAME_APP: app_name,
    PROVIDER_APP: app_provider,
    THEME_APP: app_theme,
    NAVIGATION_APP: NAVIGATION_DATA,
    TEMPLATE_ROUTES: TEMPLATE_ROUTES,
  };

  const useAuthConfig: AuthConfigServer = {
    AUTH_URL: auth_url,
    AUTH_CALLBACK_URL: auth_callback_url,
    AUTH_ENDPOINT: auth_endpoint,
    AUTH_LOGIN_PATH: `${auth_endpoint}/login`,
    AUTH_REGISTER_PATH: `${auth_endpoint}/register`,
    AUTH_FORGOT_PASSWORD_PATH: `${auth_endpoint}/forgot-password`,
  };

  const useServerConfig: ServerConfig = {
    SERVER_PORT: Number(server_port),
    SERVER_HOST: server_host,
  };

  return { useCompany, useConfigApp, useAuthConfig, useServerConfig };
};
