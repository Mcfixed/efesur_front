import BottomBar from "@/components/bars/BottomBar";
import RightBar from "@/components/bars/RightBar";
import BaseMap from "@/components/baseMap/components/BaseMap";
import { Marker } from "react-map-gl";
import { useBreakpoint } from "@/hooks/useBreakpoints";
import { AreaChartWrapper } from "@/libs/recharts";
import { useState, useMemo } from "react";
import { IconArrowNarrowLeft, IconX, IconCheck } from "@tabler/icons-react";
import { KPIWidget } from "@/components/widgets";
import { useDashboardData, useResolveAlert } from "../hooks/useDashboard";
import { Alert } from "../types/dashboard.types";
import { format } from "date-fns";

function Dashboard() {
  const { isMobile } = useBreakpoint();
  const [isOpenRightBar, setOpenRightBar] = useState(false);
  const { data, isLoading } = useDashboardData();

  // Preparar datos para el BottomBar (Alertas de atención en el tiempo)
  const atencionData = useMemo(() => {
    if (!data?.alerts?.atencion) return [];
    
    // Agrupar por minuto (simplificado)
    const grouped = data.alerts?.atencion.reduce((acc, alert) => {
      const time = format(new Date(alert.created_at), "HH:mm");
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([time, count]) => ({
      time,
      alertas: count
    })).sort((a, b) => a.time.localeCompare(b.time));
  }, [data?.alerts?.atencion]);

  return (
    <div className={`w-full h-full flex flex-col`}>
      {/* KPI Header */}
      <div className="p-2 z-10 bg-bg-100 border-b border-border-100">
        <KPIWidget
          title="Monitoreo en Tiempo Real"
          items={[
            { label: "Dispositivos GPS Activos", value: data?.summary?.totalGpsDevices || 0, color: "#8ecae0", trend: "neutral" },
            { label: "Alertas Críticas", value: data?.summary?.criticalAlertsCount || 0, color: "#f87171", trend: data?.summary?.criticalAlertsCount ? "up" : "neutral" },
            { label: "Alertas Atención", value: data?.summary?.atencionAlertsCount || 0, color: "#ffc658", trend: data?.summary?.atencionAlertsCount ? "up" : "neutral" },
          ]}
          columns={3}
        />
      </div>

      <div className={`flex-1 w-full ${isMobile ? "flex flex-row" : "grid grid-cols-12 overflow-hidden"}`}>
        <div className={`${!isMobile && "col-span-10"} h-full flex flex-col justify-between items-center w-full relative`}>
          
          <BaseMap>
            {data?.devices?.map(device => {
              // Validar que existan coordenadas
              if (!device.latitude_current || !device.longitude_current) return null;
              
              const isAlert = data.alerts?.critical?.some(a => a.device_id === device.id) || 
                              data.alerts?.atencion?.some(a => a.device_id === device.id);

              return (
                <Marker 
                  key={device.id} 
                  longitude={Number(device.longitude_current)} 
                  latitude={Number(device.latitude_current)}
                >
                  <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${
                    isAlert ? "bg-red-500 animate-pulse" : "bg-blue-500"
                  }`} />
                </Marker>
              );
            })}
          </BaseMap>

          <BottomBar title="Alertas de Atención (últimos 30 min)">
             {isLoading ? (
               <div className="flex items-center justify-center h-full"><p>Cargando datos...</p></div>
             ) : (
                <AreaChartWrapper
                  data={atencionData}
                  dataKey="alertas"
                  xAxisKey="time"
                  height={150}
                  colors={["#ffc658"]}
                  showGrid={true}
                  showLegend={false}
                />
             )}
          </BottomBar>
        </div>

        {!isMobile ? (
          <RightBarDashboard alerts={data?.alerts?.critical || []} isLoading={isLoading} />
        ) : isOpenRightBar ? (
          <RightBarDashboard alerts={data?.alerts?.critical || []} setOpenRightBar={setOpenRightBar} isLoading={isLoading} />
        ) : (
          <button
            className="absolute right-0 z-50 top-[50%] rounded-s-sm bg-brand-100 p-1"
            onClick={() => setOpenRightBar(true)}
          >
            <IconArrowNarrowLeft size={24} stroke={1.5} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

const RightBarDashboard = ({
  alerts,
  isLoading,
  setOpenRightBar,
}: {
  alerts: Alert[];
  isLoading: boolean;
  setOpenRightBar?: (isOpen: boolean) => void;
}) => {
  const resolveMutation = useResolveAlert();

  const handleResolve = (id: number) => {
    // En un caso real, userId vendría del contexto de autenticación
    resolveMutation.mutate({ id, reason: "Revisado por operador", userId: "00000000-0000-0000-0000-000000000000" });
  };

  return (
    <div className="relative col-span-2 z-50 h-full">
      {setOpenRightBar && (
        <button
          onClick={() => setOpenRightBar(false)}
          className="absolute top-2 flex justify-center items-center right-2 z-50 outline outline-transparent"
        >
          <IconX size={20} stroke={1.5} />
        </button>
      )}
      <RightBar
        title="Alertas Críticas"
        subTitle="Requieren atención inmediata"
      >
        <div className="flex flex-col gap-3 h-full overflow-y-auto pb-20">
          {isLoading ? (
            <p className="text-sm text-text-300">Cargando alertas...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-text-300">No hay alertas críticas activas.</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-red-400">{alert.device_name}</h4>
                  <span className="text-xs text-text-300">{format(new Date(alert.created_at), "HH:mm")}</span>
                </div>
                <p className="text-xs text-text-200 mb-3">{alert.metadata?.reason || "Sin detalle"}</p>
                
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-bg-300 hover:bg-bg-400 text-xs py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  <IconCheck size={14} className="text-green-400" />
                  Marcar como Resuelta
                </button>
              </div>
            ))
          )}
        </div>
      </RightBar>
    </div>
  );
};

export default Dashboard;
