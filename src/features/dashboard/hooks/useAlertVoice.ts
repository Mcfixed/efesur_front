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

// Al abrir el panel solo se recitan alertas de los últimos minutos (mismo
// criterio de "reciente" que usa el dashboard). Las alertas activas antiguas
// (apertura/presencia que nadie resolvió) siguen en la lista y antes se
// recitaban por voz en cada carga del panel.
const RECENT_WINDOW_MS = 5 * 60 * 1000;

// Tope de alertas recitadas en el primer lote para no encadenar una locución larga
const MAX_FIRST_BATCH = 3;

// Orden de locución: primero lo más grave
const VOICE_PRIORITY: Record<string, number> = {
  critica: 0,
  apertura: 1,
  presencia: 2,
  movimientos_anomalos: 3,
  atencion: 4,
};

function isRecent(createdAt: string | undefined, now: number): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t <= RECENT_WINDOW_MS;
}

function byVoicePriority(a: VoiceAlert, b: VoiceAlert): number {
  const pa = VOICE_PRIORITY[a.type] ?? 9;
  const pb = VOICE_PRIORITY[b.type] ?? 9;
  if (pa !== pb) return pa - pb;
  return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
}

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

interface VoiceAlert {
  type: string;
  device_name: string;
  id: number;
  created_at?: string;
}

interface AlertVoiceOptions {
  alerts?: VoiceAlert[];
}

export function useAlertVoice({ alerts = [] }: AlertVoiceOptions) {
  const [muted, setMuted] = useState(false);
  const lastAlertIds = useRef<string>("");
  const welcomed = useRef(false);
  const [ready, setReady] = useState(false);

  // Inicializar: desbloquear audio + robustecer la carga de voces
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
    const poll = setInterval(checkVoices, 400);
    const timeout = setTimeout(() => setReady(true), 2500);

    return () => {
      speechSynthesis.removeEventListener("voiceschanged", checkVoices);
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, []);

  // Pedir permiso de notificaciones del sistema en la primera interacción
  useEffect(() => {
    const request = () => requestNotificationPermission();
    window.addEventListener("pointerdown", request, { once: true });
    return () => window.removeEventListener("pointerdown", request);
  }, []);

  // Bienvenida (voz TTS)
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
    const active = alerts
      .filter(a => a.type && a.type !== "resolved" && !VOICE_EXCLUDED_TYPES.has(a.type))
      .sort(byVoicePriority);
    if (active.length === 0) return;

    const currentIds = active.map(a => a.id).sort().join(",");
    if (currentIds === lastAlertIds.current) return;

    // Primer lote: anunciar después de la bienvenida (3.5s) solo lo reciente
    if (!initialAnnounced.current) {
      initialAnnounced.current = true;
      lastAlertIds.current = currentIds;
      const recientes = active.filter(a => isRecent(a.created_at, Date.now())).slice(0, MAX_FIRST_BATCH);
      if (recientes.length === 0) return;
      setTimeout(() => {
        for (const alert of recientes) {
          speak(buildAlertMessage(alert));
        }
      }, 3500);
      return;
    }

    // Alertas que no se habían visto: anunciar inmediatamente
    const prevIds = new Set(lastAlertIds.current.split(",").filter(Boolean));
    const newAlerts = active.filter(a => !prevIds.has(String(a.id)));

    for (const alert of newAlerts) {
      speak(buildAlertMessage(alert));
      notifyAlert(alert); // notificación del sistema (críticas)
    }

    lastAlertIds.current = currentIds;
  }, [alerts, muted, ready]);

  const toggleMute = useCallback(() => {
    unlockAudio();
    setMuted(m => !m);
  }, []);

  return { muted, toggleMute };
}
