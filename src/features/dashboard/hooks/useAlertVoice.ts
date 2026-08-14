import { useEffect, useRef, useState, useCallback } from "react";
import { speak, unlockAudio, registerAudioUnlock } from "../utils/audio";
import { notifyAlert, requestNotificationPermission } from "../utils/notifications";

// Tipos de alerta que NO se recitan por voz (las de desconexión no suenan)
const VOICE_EXCLUDED_TYPES = new Set([
  "desconexionGW",
  "desconexionGPS",
  "desconexion220",
  "desconexionbatGW",
]);

// Etiquetas para la voz (las alertas se recitan con nombre de dispositivo)
const TYPE_LABELS: Record<string, string> = {
  critica: "crítica",
  atencion: "atención",
  apertura: "apertura",
  presencia: "presencia",
  movimientos_anomalos: "movimientos anómalos",
};

/** Construye el mensaje de voz según el tipo de alerta. */
function buildAlertMessage(alert: { type: string; device_name: string }): string {
  // Críticas: mensaje urgente repetido x3 + protocolo
  if (alert.type === "critica") {
    const d = alert.device_name || "el dispositivo";
    return (
      `ALERTA CRÍTICA en ${d}. ` +
      `ALERTA CRÍTICA en ${d}. ` +
      `ALERTA CRÍTICA en ${d}. ` +
      `Revise inmediatamente la plataforma y ejecute el protocolo establecido.`
    );
  }
  const label = TYPE_LABELS[alert.type] || alert.type;
  return `Alerta ${label} en ${alert.device_name}`;
}

interface AlertVoiceOptions {
  alerts?: { type: string; device_name: string; id: number }[];
}

export function useAlertVoice({ alerts = [] }: AlertVoiceOptions) {
  const [muted, setMuted] = useState(false);
  const lastAlertIds = useRef<string>("");
  const welcomed = useRef(false);
  const [ready, setReady] = useState(false);

  // Inicializar: desbloquear audio + robustecer la carga de voces.
  // `voiceschanged` puede dispararse antes de registrarse el listener,
  // así que también hacemos polling para no quedar en ready=false.
  useEffect(() => {
    unlockAudio();
    registerAudioUnlock();

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setReady(false);
      return;
    }

    const checkVoices = () => {
      try {
        if (speechSynthesis.getVoices().length > 0) setReady(true);
      } catch { /* noop */ }
    };

    checkVoices();
    speechSynthesis.addEventListener("voiceschanged", checkVoices);
    // Polling de respaldo (Chrome a veces no dispara voiceschanged a tiempo)
    const poll = setInterval(checkVoices, 400);
    const timeout = setTimeout(() => setReady(true), 2500);

    return () => {
      speechSynthesis.removeEventListener("voiceschanged", checkVoices);
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, []);

  // Pedir permiso de notificaciones del sistema en la primera interacción
  // (gesto real). Así las alertas críticas pueden avisar aunque la pestaña
  // esté en segundo plano.
  useEffect(() => {
    const request = () => requestNotificationPermission();
    window.addEventListener("pointerdown", request, { once: true });
    return () => window.removeEventListener("pointerdown", request);
  }, []);

  // Bienvenida (voz TTS). IMPORTANTE: `welcomed` se marca DENTRO del setTimeout,
  // no antes. En React StrictMode el efecto corre mount→cleanup→mount: si lo
  // marcáramos antes, el cleanup cancela el timer y el segundo mount ya no
  // reprograma la bienvenida (nunca sonaría).
  useEffect(() => {
    if (muted || welcomed.current) return;
    const timer = setTimeout(() => {
      welcomed.current = true;
      speak("Bienvenido al sistema de monitoreo catenaria");
    }, 1200);
    return () => clearTimeout(timer);
  }, [muted]);

  // Anunciar alertas (primer lote + nuevas)
  const initialAnnounced = useRef(false);

  useEffect(() => {
    if (muted || !ready) return;
    // La voz anuncia las alertas activas con nombre, EXCEPTO las de desconexión
    const active = alerts.filter(
      a => a.type && a.type !== "resolved" && !VOICE_EXCLUDED_TYPES.has(a.type)
    );
    if (active.length === 0) return;

    const currentIds = active.map(a => a.id).sort().join(",");
    if (currentIds === lastAlertIds.current) return;

    // Primer lote: anunciar después de la bienvenida (3.5s)
    if (!initialAnnounced.current) {
      initialAnnounced.current = true;
      lastAlertIds.current = currentIds;
      setTimeout(() => {
        for (const alert of active.slice(0, 5)) {
          speak(buildAlertMessage(alert));
        }
      }, 3500);
      return;
    }

    // Nuevas alertas: anunciar inmediatamente
    const prevIds = new Set(lastAlertIds.current.split(",").filter(Boolean));
    const newAlerts = active.filter(a => !prevIds.has(String(a.id)));

    for (const alert of newAlerts) {
      speak(buildAlertMessage(alert));
      notifyAlert(alert); // notificación del sistema (críticas)
    }

    lastAlertIds.current = currentIds;
  }, [alerts, muted, ready]);

  const toggleMute = useCallback(() => {
    // Al hacer clic, también forzamos el desbloqueo de audio (gesto real)
    unlockAudio();
    setMuted(m => !m);
  }, []);

  return { muted, toggleMute };
}
