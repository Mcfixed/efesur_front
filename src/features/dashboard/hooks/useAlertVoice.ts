import { useEffect, useRef, useState, useCallback } from "react";

const WELCOME_MESSAGE = "Bienvenido al sistema de monitoreo catenaria";

const TYPE_LABELS: Record<string, string> = {
  critica: "crítica",
  atencion: "atención",
};

let audioUnlocked = false;

/** Desbloquea el audio en Chrome/Edge (requiere un gesto o contexto silencioso) */
function unlockAudio() {
  if (audioUnlocked || typeof window === "undefined") return;
  audioUnlocked = true;
  try {
    // Crear un contexto de audio silencioso para desbloquear el autoplay
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 0;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(0.001);
    ctx.resume();
  } catch {}
}

function speak(text: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.rate = 1.1;
    const voices = speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith("es"));
    if (esVoice) utterance.voice = esVoice;
    // IMPORTANTE: No llamar a cancel() — rompe el speech en Chrome
    speechSynthesis.speak(utterance);
  } catch {}
}

interface AlertVoiceOptions {
  alerts?: { type: string; device_name: string; id: number }[];
}

export function useAlertVoice({ alerts = [] }: AlertVoiceOptions) {
  const [muted, setMuted] = useState(false);
  const lastAlertIds = useRef<string>("");
  const welcomed = useRef(false);
  const [ready, setReady] = useState(false);

  // Inicializar al montar
  useEffect(() => {
    unlockAudio();
    // Precargar voces
    if (typeof window !== "undefined" && speechSynthesis) {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener("voiceschanged", () => setReady(true), { once: true });
      // Si ya están cargadas
      if (speechSynthesis.getVoices().length > 0) setReady(true);
    }
  }, []);

  // Bienvenida
  useEffect(() => {
    if (muted || welcomed.current || !ready) return;
    welcomed.current = true;
    const timer = setTimeout(() => speak(WELCOME_MESSAGE), 1500);
    return () => clearTimeout(timer);
  }, [muted, ready]);

  // Anunciar alertas (primer lote + nuevas)
  const initialAnnounced = useRef(false);

  useEffect(() => {
    if (muted || !ready) return;
    const active = alerts.filter(a => a.type === "critica" || a.type === "atencion");
    if (active.length === 0) return;

    const currentIds = active.map(a => a.id).sort().join(",");
    if (currentIds === lastAlertIds.current) return;

    // Primer lote: anunciar después de la bienvenida (4s)
    if (!initialAnnounced.current) {
      initialAnnounced.current = true;
      lastAlertIds.current = currentIds;
      setTimeout(() => {
        for (const alert of active) {
          const label = TYPE_LABELS[alert.type] || alert.type;
          speak(`Alerta ${label} en ${alert.device_name}`);
        }
      }, 4000);
      return;
    }

    // Nuevas alertas: anunciar inmediatamente
    const prevIds = new Set(lastAlertIds.current.split(",").filter(Boolean));
    const newAlerts = active.filter(a => !prevIds.has(String(a.id)));

    for (const alert of newAlerts) {
      const label = TYPE_LABELS[alert.type] || alert.type;
      speak(`Alerta ${label} en ${alert.device_name}`);
    }

    lastAlertIds.current = currentIds;
  }, [alerts, muted, ready]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
  }, []);

  return { muted, toggleMute };
}
