import { useEffect, useRef } from "react";
import { playSound, unlockAudio, registerAudioUnlock } from "../utils/audio";

export function useAlertSound(alertCounts: {
  critical: number;
  atencion: number;
  desconexionGW: number;
  movimientos_anomalos: number;
}) {
  const prev = useRef({ critical: 0, atencion: 0, desconexionGW: 0, movimientos_anomalos: 0 });
  const isFirstRender = useRef(true);

  // Desbloquear el audio al montar + registrar gesto global de refuerzo
  useEffect(() => {
    unlockAudio();
    registerAudioUnlock();
  }, []);

  useEffect(() => {
    // Primer render: si ya hay críticas activas, suenan DESPUÉS de la bienvenida
    // (la bienvenida se encola a los 1.2s; la crítica a los 3.5s para respetar el orden).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const first = { ...alertCounts };
      if (first.critical > 0) {
        setTimeout(() => playSound("critica"), 3500);
      }
      prev.current = first;
      return;
    }

    // Críticas nuevas → sonido de crítica
    if (alertCounts.critical > prev.current.critical) {
      playSound("critica");
    }

    // Movimientos anómalos nuevos
    const diffMov = alertCounts.movimientos_anomalos - prev.current.movimientos_anomalos;
    for (let i = 0; i < diffMov && i < 5; i++) {
      setTimeout(() => playSound("movimientos_anomalos"), i * 220);
    }

    // Atención nuevas
    const diffAtencion = alertCounts.atencion - prev.current.atencion;
    for (let i = 0; i < diffAtencion && i < 5; i++) {
      setTimeout(() => playSound("atencion"), i * 200);
    }

    // Desconexión GW nuevas
    const diffDesconexion = alertCounts.desconexionGW - prev.current.desconexionGW;
    for (let i = 0; i < diffDesconexion && i < 5; i++) {
      setTimeout(() => playSound("desconexion"), i * 250);
    }

    prev.current = { ...alertCounts };
  }, [alertCounts.critical, alertCounts.atencion, alertCounts.desconexionGW, alertCounts.movimientos_anomalos]);
}

// Mantener export antiguo para compatibilidad
export const useCriticalAlertSound = useAlertSound;
