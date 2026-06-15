import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router";
import { IconChevronDown } from "@tabler/icons-react";
import { useBetterAuth, useBetterSession } from "@/libs/better-auth";
import {
  USER_MENU_ITEMS,
  ADMIN_MENU_ITEMS,
  LOGOUT_ITEM,
} from "@/template/config";
import LineGradientWhite from "@/components/ui/LineGradientWhite";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useBetterSession();
  const { signOut } = useBetterAuth();

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    signOut();
  };

  const role = user?.role || 'visualizador';
  const isSuperuser = role === 'superadmin' || role === 'admin_efe';

  return (
    <div className="relative" ref={menuRef}>
      <LineGradientWhite top="" height="0.05rem" color="#a7acb6" />

      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pe-2 ps-0.5 bg-bg-200   shadow-sm shadow-bg-100  hover:bg-bg-300 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 bg-bg-100 rounded-lg flex justify-center items-center">
          <span className="font-bold text-text-100">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </span>
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-medium text-text-100">
            {user?.name}
          </span>
          <span className="text-xs text-text-200">{user?.email}</span>
        </div>
        <IconChevronDown
          size={16}
          className={`transition-transform text-text-100 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute animate-fade-in-down animate-duration-300  right-0 top-full mt-2 w-64 bg-bg-100 border border-border rounded-lg shadow-lg z-500 overflow-hidden">
          {/* Header del menú */}
          <div className="px-4 py-3 border-b border-border bg-bg-200">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-text-100">{user?.email}</p>
          </div>

          {/* Opciones del usuario */}
          <div className="py-2">
            {USER_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.link}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 text-sm hover:bg-bg-200 transition-colors ${
                      isActive ? "bg-bg-200 text-100" : "text-text-100"
                    }`
                  }
                >
                  <Icon size={18} stroke={1.5} />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-text-200">
                        {item.description}
                      </p>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>

          {/* Opciones de admin (solo si es superusuario) */}
          {isSuperuser && (
            <>
              <div className="border-t border-border" />
              <div className="py-2">
                <p className="px-4 py-1 text-xs font-semibold text-text-200 uppercase">
                  Administración
                </p>
                {ADMIN_MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.link}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2 text-sm hover:bg-bg-200 transition-colors ${
                          isActive ? "bg-bg-200 text-100" : "text-text-100"
                        }`
                      }
                    >
                      <Icon size={18} stroke={1.5} />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-text-200">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </>
          )}

          {/* Cerrar sesión */}
          <div className="border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-sm w-full hover:bg-bg-300  text-text-100 transition-colors"
            >
              <LOGOUT_ITEM.icon size={18} stroke={1.5} />
              <span className="font-medium">{LOGOUT_ITEM.name}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
