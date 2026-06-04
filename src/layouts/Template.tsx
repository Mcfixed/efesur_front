import { Outlet } from "react-router";
import Header from "./header/Header";
import Sidebar from "./sidebar/Sidebar";
import { configServer } from "@/config/ConfigServer";
import { DropdownProvider } from "@/components/ui/Dropdown";
import { useState } from "react";

function Template() {
  const { useCompany, useConfigApp } = configServer();
  const [isOpenSidebar, setOpenSidebar] = useState(false);
  return (
    <DropdownProvider>
      <div className="min-h-screen w-screen flex overflow-hidden">
        <Sidebar
          useCompany={useCompany}
          useConfigApp={useConfigApp}
          isOpenSidebar={isOpenSidebar}
          setIsOpenSidebar={setOpenSidebar}
        />
        <div className="flex-1 flex flex-col z-0   pe-2 pb-2">
          <div className="relative bg-bg-100  p-1 animate-slide-in-top z-60">
            {/* <div className="absolute left-1/2 -top-5 rotate-45 w-13 h-13  bg-blue-600 -translate-x-1/2 blur-lg"></div> */}

            <Header
              useConfigApp={useConfigApp}
              isOpenSidebar={isOpenSidebar}
              setIsOpenSidebar={setOpenSidebar}
            />
          </div>
          <div className="flex-1 flex flex-col z-0 rounded-2xl rounded-ss-none overflow-hidden bg-bg-200 ">
            <main className="flex-1 overflow-hidden w-full">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </DropdownProvider>
  );
}

export default Template;
