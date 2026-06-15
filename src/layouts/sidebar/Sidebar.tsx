import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useSidebar } from "../../../libs/zustand/hooks/useUI";
import { useTheme } from "@/context/ThemeContext";
import type { CompanyConfig, AppConfig } from "@/config/ConfigServer";
import { Link, NavLink } from "react-router";
import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import LineGradientWhite from "@/components/ui/LineGradientWhite";
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
    <aside className={`relative bg-bg-100 min-h-screen w-19 z-10 `}>
      <div
        className={`absolute top-0 left-0 h-full border-e border-border      
          ${
            isCollapsed ? "w-19 animate-slide-in-left" : "w-64  bg-bg-100 "
          } transition-all duration-200 ease-in-out flex flex-col justify-between`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          className="absolute top-3 -right-10 text-text-300 hover:text-text-100 outline outline-transparent p-0.5 bg-linear-to-b from-bg-100 to-bg-300 border-t border-t-white/20 shadow-lg shadow-bg-100 rounded-full"
          onClick={() => setCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <IconChevronRight size={20} />
          ) : (
            <IconChevronLeft size={20} />
          )}
        </button>
        <div className="w-full h-full p-1">
          <div className="bg-bg-100 ">
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
      className={`border-t border-border bg-bg-200 flex items-center p-3 ${
        isCollapsed ? "justify-center" : "justify-start"
      } `}
    >
      <span className={`text-xs text-text-200 text-center`}>
        © {new Date().getFullYear()} v0.0.1
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
  const isSuperuser = role === 'superadmin' || role === 'admin_efe';
  const visibleItems = _useConfigApp.NAVIGATION_APP.filter(item => !item.superadmin || isSuperuser);
  return (
    <div
      className={` ${_isCollapsed ? "mt-4  p-1 " : "mt-4 p-1 mx-1 bg-bg-100 rounded-lg"} `}
    >
      <div className="p-1">
        <h4 className="text-text-300 text-xs tracking-wider ">MENU</h4>
      </div>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <div className="relative">
            <div className="absolute w-3 h-3 bg-blue-500 -right-1 top-1/2 -translate-y-1/2 rounded-full blur-xs"></div>
            <div className="absolute w-3 h-3 bg-blue-600 right-0 top-1/2 -translate-y-1/2 rounded-full "></div>
            <LineGradientWhite color="#fffaf0a4" />
            <NavLink
              key={item.id}
              to={item.link}
              className={({ isActive }: { isActive: boolean }) => `
               relative flex  items-center text-text-200  py-1 px-2 rounded-xl hover:bg-bg-200 transition-all duration-300
              ${_isCollapsed ? "justify-center" : "justify-start"}
              ${isActive ? "bg-linear-to-r backdrop-blur from-bg-300 hover:bg-bg-200" : "text-text-100 bg-bg-100"}
            `}
              target={item.target ? "_blank" : "_self"}
              rel="noreferrer"
            >
              <span>
                <Icon size={22} stroke={2} />
              </span>
              {!_isCollapsed && (
                <span className="ml-2 truncate">{item.name}</span>
              )}
            </NavLink>
          </div>
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
          w-full h-18 border-b border-border flex items-center overflow-hidden
          ${isCollapsed ? "px-2 py-2" : "px-5 py-2"}
          `}
    >
      <div
        className={` h-full flex items-center justify-center
        ${isCollapsed ? "w-full" : "px-5 py-2"}
        `}
      >
        <Link to="/">
          <img
            src={
              theme === "dark"
                ? useCompany.LOGO_COMPANY_WHITE
                : useCompany.LOGO_COMPANY_BLACK
            }
            alt={useCompany.NAME_COMPANY}
            className="h-8 object-cover "
          />
        </Link>
      </div>
      {!isCollapsed && (
        <span className="ml-2 truncate text-xs font-medium">
          {useConfigApp.NAME_APP}
        </span>
      )}
    </div>
  );
};

export default Sidebar;
