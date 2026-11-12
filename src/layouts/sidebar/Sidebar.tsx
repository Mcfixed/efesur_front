import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useSidebar } from "../../../libs/zustand/hooks/useUI";
import { useTheme } from "@/context/ThemeContext";
import type { CompanyConfig, AppConfig } from "@/config/ConfigServer";
import { Link, NavLink } from "react-router";
import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { useBetterSession } from "@/libs/better-auth";

function Sidebar({
  useCompany,
  useConfigApp,
  isOpenSidebar,
  setIsOpenSidebar,
}: {
  useCompany: CompanyConfig;
  useConfigApp: AppConfig;
  isOpenSidebar: boolean;
  setIsOpenSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { isMobile } = useBreakpoint();
  const { isCollapsed, setCollapsed } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!isCollapsed && !isHovered) {
      timeout = setTimeout(() => {
        setCollapsed(true); // Cambiar a true para que se colapse automáticamente después de 1 segundo de inactividad
      }, 1000);
    }
    return () => clearTimeout(timeout);
  }, [isCollapsed, isHovered, setCollapsed]);

  return !isMobile ? (
    <aside className={`relative bg-bg-100 h-screen w-19 z-10 `}>
      <div
        className={`absolute top-0 left-0 h-full border-e border-border      
          ${
            isCollapsed ? "w-19 animate-slide-in-left" : "w-64  bg-bg-100 "
          } transition-all duration-200 ease-in-out flex flex-col justify-between`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          className="absolute top-3 -right-3.5 z-20 grid place-items-center w-7 h-7 rounded-full bg-bg-300 border border-border text-text-300 hover:text-text-100 shadow-[0_2px_6px_rgba(15,23,42,0.14)] transition-colors duration-150"
          onClick={() => setCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? (
            <IconChevronRight size={16} />
          ) : (
            <IconChevronLeft size={16} />
          )}
        </button>
        <div className="w-full h-full p-1">
          <div className="h-full flex flex-col">
            <TopSidebar
              isCollapsed={isCollapsed}
              useCompany={useCompany}
              useConfigApp={useConfigApp}
            />
            <MenuNavigation
              isCollapsed={isCollapsed}
              useConfigApp={useConfigApp}
            />
          </div>
        </div>
        <BottomSidebar isCollapsed={isCollapsed} />
      </div>
    </aside>
  ) : (
    isOpenSidebar && (
      <div className="fixed inset-0 z-50 bg-bg-100">
        <button
          className="fixed top-2 right-2 bg-bg-100  z-50 p-2 text-text-300 outline outline-transparent "
          onClick={() => setIsOpenSidebar(!isOpenSidebar)}
        >
          <IconX size={20} />
        </button>
        <TopSidebar
          isCollapsed={isCollapsed}
          useCompany={useCompany}
          useConfigApp={useConfigApp}
        />
        <MenuNavigation
          isCollapsed={!isCollapsed}
          useConfigApp={useConfigApp}
        />
      </div>
    )
  );
}

const BottomSidebar = ({ isCollapsed }: { isCollapsed: boolean }) => {
  return (
    <div
      className={`border-t border-border flex items-center p-3 ${
        isCollapsed ? "justify-center" : "justify-start"
      } `}
    >
      <span className={`text-[11px] font-medium text-text-300 text-center`}>
        © {new Date().getFullYear()} v2.5.3
      </span>
    </div>
  );
};

const MenuNavigation = ({
  isCollapsed: _isCollapsed,
  useConfigApp: _useConfigApp,
}: {
  isCollapsed: boolean;
  useConfigApp: AppConfig;
}) => {
  const { user } = useBetterSession();
  const role = user?.role || 'visualizador';
  const visibleItems = _useConfigApp.NAVIGATION_APP.filter(item => !item.roles || item.roles.includes(role));
  return (
    <div className={`mt-3 flex flex-col gap-0.5 ${_isCollapsed ? "px-1" : "px-1.5"}`}>
      {!_isCollapsed && (
        <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-300">
          Menú
        </h4>
      )}
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.id}
            to={item.link}
            title={_isCollapsed ? item.name : undefined}
            target={item.target ? "_blank" : "_self"}
            rel="noreferrer"
            className={({ isActive }) => `
              group relative flex items-center gap-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150
              ${_isCollapsed ? "justify-center px-0" : "px-2.5"}
              ${isActive
                ? "sidebar-item-active text-text-100"
                : "text-text-200 hover:bg-bg-200 hover:text-text-100"}
            `}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="sidebar-item-bar absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full" />
                )}
                <Icon
                  size={20}
                  stroke={isActive ? 2 : 1.8}
                  className={`shrink-0 ${isActive ? "sidebar-item-icon-active" : "text-text-200"}`}
                />
                {!_isCollapsed && <span className="truncate">{item.name}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
};

const TopSidebar = ({
  isCollapsed,
  useCompany,
  useConfigApp,
}: {
  isCollapsed: boolean;
  useCompany: CompanyConfig;
  useConfigApp: AppConfig;
}) => {
  const { theme } = useTheme();

  return (
    <div
      className={`
          w-full h-18 border-b border-border flex items-center gap-2 overflow-hidden
          ${isCollapsed ? "justify-center px-2" : "px-3"}
          `}
    >
      <Link to="/" className="shrink-0 grid place-items-center">
        <img
          src={
            theme === "dark"
              ? useCompany.LOGO_COMPANY_WHITE
              : useCompany.LOGO_COMPANY_BLACK
          }
          alt={useCompany.NAME_COMPANY}
          className="h-8 w-auto object-contain"
        />
      </Link>
      {!isCollapsed && (
        <span className="truncate text-xs font-semibold tracking-wide text-text-200">
          {useConfigApp.NAME_APP}
        </span>
      )}
    </div>
  );
};

export default Sidebar;
