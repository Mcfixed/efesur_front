import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconAlertTriangle, IconAlertCircle, IconWifiOff, IconRadar } from "@tabler/icons-react";
import type { DashboardData, Alert } from "../types/dashboard.types";

interface Props {
  data?: DashboardData;
}

// Ventanas del banner. Son filtros LOCALES del banner (no tocan el mapa, el panel
// derecho ni la voz): presencia y apertura quedan activas para siempre en la BD si
// nadie las resuelve, así que aquí se limita cuánto tiempo se anuncian.
const MIN_MS = 60 * 1000;
const WINDOW_PRESENCIA = 30 * MIN_MS;
const WINDOW_APERTURA = 30 * MIN_MS;
const WINDOW_ATENCION = 5 * MIN_MS; // mismo criterio que el backend

export default function AlertTickerBanner({ data }: Props) {
  // "Reloj" del banner: no se lee durante el render (rompe la pureza). Se refresca
  // cada 30 s para que las alertas vencidas salgan solas sin esperar datos nuevos.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const alertItems = useMemo(() => {
    const items: { device_name: string; type: string; icon: ReactNode; color: string; bg: string }[] = [];
    const recientes = (list: Alert[] | undefined, ventana: number) =>
      (list || []).filter(a => {
        const t = new Date(a.created_at).getTime();
        return Number.isFinite(t) && now - t <= ventana;
      });

    // Críticas y desconexiones: se anuncian mientras sigan activas; desaparecen solas
    // cuando el backend las marca resueltas/inactivas (ya viene filtrado del backend).
    (data?.alerts?.critical || []).forEach(a => items.push({ device_name: a.device_name, type: 'Crítica', icon: <IconAlertTriangle size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    recientes(data?.alerts?.atencion, WINDOW_ATENCION).forEach(a => items.push({ device_name: a.device_name, type: 'Atención', icon: <IconAlertCircle size={13} />, color: '#eab308', bg: 'bg-yellow-500/8' }));
    (data?.alerts?.desconexionGW || []).forEach(a => items.push({ device_name: a.device_name, type: 'GW Off', icon: <IconWifiOff size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    (data?.alerts?.desconexion220 || []).forEach(a => items.push({ device_name: a.device_name, type: 'CA 220 Off', icon: <IconWifiOff size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    (data?.alerts?.desconexionbatGW || []).forEach(a => items.push({ device_name: a.device_name, type: 'Batería GW Off', icon: <IconWifiOff size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    (data?.alerts?.movimientos_anomalos || []).forEach(a => items.push({ device_name: a.device_name, type: 'Mov.', icon: <IconRadar size={13} />, color: '#a855f7', bg: 'bg-purple-500/8' }));
    recientes(data?.alerts?.apertura, WINDOW_APERTURA).forEach(a => items.push({ device_name: a.device_name, type: 'Apertura', icon: <IconAlertTriangle size={13} />, color: '#ef4444', bg: 'bg-red-500/10' }));
    recientes(data?.alerts?.presencia, WINDOW_PRESENCIA).forEach(a => items.push({ device_name: a.device_name, type: 'Presencia', icon: <IconAlertCircle size={13} />, color: '#eab308', bg: 'bg-yellow-500/8' }));
    return items;
  }, [data, now]);

  if (alertItems.length === 0) return null;

  const duplicated = [...alertItems, ...alertItems, ...alertItems];

  return (
    <div className="w-full overflow-hidden bg-bg-100/90 border-b border-border/20 relative" style={{ height: 30 }}>
      <div className="absolute inset-0 flex items-center ticker-track">
        <div className="flex items-center gap-4 whitespace-nowrap ticker-animate shrink-0">
          {duplicated.map((item, i) => (
            <span key={i} className={`flex items-center gap-1.5 text-[12px] font-medium shrink-0 ${item.bg} px-2 py-0.5 rounded`} style={{ color: item.color }}>
              {item.icon}
              <span className="font-semibold">{item.device_name}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.8 }}>{item.type}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
