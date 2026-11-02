import { useEffect, useRef, useState } from "react";
import { IconWifiOff, IconPlugConnected, IconAlertTriangle } from "@tabler/icons-react";
import { apiStatus } from "@/apis/apiStatus";

// Franja fija que avisa cuando la plataforma no está recibiendo datos frescos.
export default function ConnectionBanner() {
  const [snap, setSnap] = useState(apiStatus.snapshot());
  const [reconectado, setReconectado] = useState(false);
  const anterior = useRef(snap.estado);

  useEffect(() => apiStatus.subscribe((estado, ultimoOk) => setSnap({ estado, ultimoOk })), []);

  useEffect(() => {
    if (anterior.current !== "ok" && snap.estado === "ok") {
      setReconectado(true);
      anterior.current = snap.estado;
      const id = window.setTimeout(() => setReconectado(false), 3000);
      return () => window.clearTimeout(id);
    }
    anterior.current = snap.estado;
  }, [snap.estado]);

  if (snap.estado === "ok" && !reconectado) return null;

  const hora = new Date(snap.ultimoOk).toLocaleTimeString("es-CL", { hour12: false });

  const estilos =
    snap.estado === "ok"
      ? { caja: "bg-emerald-500/15 border-emerald-400/40 text-emerald-300", Icono: IconPlugConnected, texto: "Conexión restablecida" }
      : snap.estado === "sin-red"
        ? { caja: "bg-amber-500/15 border-amber-400/40 text-amber-200", Icono: IconWifiOff, texto: "Sin conexión a internet · reintentando…" }
        : { caja: "bg-rose-500/15 border-rose-400/40 text-rose-200", Icono: IconAlertTriangle, texto: `Sin conexión con el servidor · datos congelados a las ${hora}` };

  const { Icono } = estilos;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center px-3 pt-2">
      <div className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md ${estilos.caja}`}>
        <Icono size={14} />
        <span>{estilos.texto}</span>
        {snap.estado !== "ok" && <span className="animate-pulse">●</span>}
      </div>
    </div>
  );
}
