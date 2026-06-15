import { useEffect, useRef } from "react";

function playBeep(frequency = 880, duration = 0.15) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.setValueAtTime(frequency * 0.75, ctx.currentTime + duration * 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* fallback silencioso */ }
}

function playCriticalAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Dos osciladores para un sonido más agresivo
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    // Alternancia rápida tipo sirena: 440 → 880 → 440 → 880
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.setValueAtTime(880, now + 0.1);
    osc1.frequency.setValueAtTime(440, now + 0.2);
    osc1.frequency.setValueAtTime(880, now + 0.3);
    osc1.frequency.setValueAtTime(440, now + 0.4);

    osc2.frequency.setValueAtTime(660, now);
    osc2.frequency.setValueAtTime(1100, now + 0.1);
    osc2.frequency.setValueAtTime(660, now + 0.2);
    osc2.frequency.setValueAtTime(1100, now + 0.3);
    osc2.frequency.setValueAtTime(660, now + 0.4);

    // Volumen más alto y sostenido
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.setValueAtTime(0.5, now + 0.1);
    gain.gain.setValueAtTime(0.4, now + 0.2);
    gain.gain.setValueAtTime(0.5, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch { /* fallback silencioso */ }
}

export function useAlertSound(alertCounts: {
  critical: number;
  atencion: number;
  desconexionGW: number;
}) {
  const prev = useRef({ critical: 0, atencion: 0, desconexionGW: 0 });
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Primer render: solo registrar, sin sonido
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prev.current = { ...alertCounts };
      return;
    }

    // Críticas nuevas → alarma distintiva (una vez, no importa cuántas críticas nuevas)
    if (alertCounts.critical > prev.current.critical) {
      playCriticalAlarm();
    }

    // Atención nuevas → beep estándar (uno por cada alerta nueva)
    const diffAtencion = alertCounts.atencion - prev.current.atencion;
    for (let i = 0; i < diffAtencion && i < 5; i++) {
      setTimeout(() => playBeep(660, 0.12), i * 200);
    }

    // Desconexión GW nuevas → beep más grave (uno por cada alerta nueva)
    const diffDesconexion = alertCounts.desconexionGW - prev.current.desconexionGW;
    for (let i = 0; i < diffDesconexion && i < 5; i++) {
      setTimeout(() => playBeep(330, 0.2), i * 250);
    }

    prev.current = { ...alertCounts };
  }, [alertCounts.critical, alertCounts.atencion, alertCounts.desconexionGW]);
}

// Mantener export antiguo para compatibilidad
export const useCriticalAlertSound = useAlertSound;
