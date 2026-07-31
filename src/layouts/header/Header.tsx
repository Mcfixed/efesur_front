import ThemeToggleButton from "../modeColor/ThemeToggleButton";
import type { AppConfig } from "@/config/ConfigServer";
import { NotificationDropdown } from "@/template/notifications";
import { UserMenu } from "@/template/components";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { IconCategory2 } from "@tabler/icons-react";
import LineGradientWhite from "@/components/ui/LineGradientWhite";

function Header({
  useConfigApp,
  isOpenSidebar,
  setIsOpenSidebar,
}: {
  useConfigApp: AppConfig;
  isOpenSidebar: boolean;
  setIsOpenSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { isMobile } = useBreakpoint();
  return (
    <header className="h-10 text-text-100 w-full z-100 flex items-center relative">
      <LineGradientWhite top="-0.07rem" height="1.5rem" color={"#6b7280"} />

      <div className="relative w-full rounded-lg  flex items-center justify-between shadow bg-linear-to-l from-bg-300 via-bg-100 to-bg-200 ">
        <div className="px-10 flex gap-1">
          <h4 className="font-bold text-text-200">
            <span className="text-brand-100">
              {useConfigApp.PROVIDER_APP.slice(0, 2)}
            </span>
            {useConfigApp.PROVIDER_APP.slice(2)}
          </h4>
        </div>
        {!isMobile && (
          <div className="absolute left-[50%] -translate-x-1/2 text-white text-center">
            <h2 className="bg-white to-100% font-black text-shadow-xs/40 text-shadow-gray-900 bg-clip-text text-clip text-transparent">
              {useConfigApp.NAME_APP}
            </h2>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center gap-3 px-1 rounded-2xl">
            {isMobile && (
              <button
                className="text-text-100 "
                onClick={() => setIsOpenSidebar(!isOpenSidebar)}
              >
                <IconCategory2 size={20} />
              </button>
            )}
            <ThemeToggleButton />
            <NotificationDropdown />
          </div>
          <div className="border-s border-border/50 py-0.5 px-0.5 relative">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
