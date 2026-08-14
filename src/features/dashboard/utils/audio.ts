// ─────────────────────────────────────────────────────────────
// Módulo de audio del dashboard (voz TTS)
// - speechSynthesis lee la bienvenida y las alertas con nombre.
// - Cola FIFO: garantiza orden (bienvenida → alertas) y evita solapes.
// - Si la voz está bloqueada hasta el primer gesto, los mensajes se quedan
//   en la cola y se reproducen todos al primer clic — no se pierde nada,
//   aunque tardes en hacer el clic.
// - detectStickyActivation: si el usuario ya interactuó (ej. login), no
//   espera otro gesto.
// ─────────────────────────────────────────────────────────────

let unlocked = false;      // la voz está permitida (gesto o habla con éxito)
let processing = false;
let epoch = 0;             // invalida handlers de utterances viejas al desbloquear
const queue: string[] = [];

function pickEsVoice(): SpeechSynthesisVoice | undefined {
  try {
    return speechSynthesis.getVoices().find(v => v.lang.startsWith("es"));
  } catch {
    return undefined;
  }
}

function flush() {
  if (processing || queue.length === 0) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  processing = true;
  const myEpoch = ++epoch;
  const text = queue[0]; // peek: solo se saca cuando realmente se habla

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-MX";
  utterance.rate = 1.1;
  const esVoice = pickEsVoice();
  if (esVoice) utterance.voice = esVoice;

  let started = false;
  let finished = false;
  let safety: ReturnType<typeof setTimeout> | null = null;
  const isCurrent = () => myEpoch === epoch;

  function cleanup() {
    if (safety) clearTimeout(safety);
    utterance.removeEventListener("start", onStart);
    utterance.removeEventListener("end", onEnd);
    utterance.removeEventListener("error", onError);
  }
  function onStart() {
    started = true;
    unlocked = true; // la voz arranca → permitida
  }
  function onEnd() {
    if (finished || !isCurrent()) return;
    finished = true;
    cleanup();
    queue.shift(); // se habló → sacar
    processing = false;
    flush();
  }
  function onError() {
    if (finished || !isCurrent()) return;
    if (!started) {
      // Voz bloqueada por autoplay: dejar el mensaje y esperar un gesto
      finished = true;
      cleanup();
      processing = false;
      return;
    }
    onEnd();
  }

  utterance.addEventListener("start", onStart);
  utterance.addEventListener("end", onEnd);
  utterance.addEventListener("error", onError);
  safety = setTimeout(() => (started ? onEnd() : onError()), 5000);

  try {
    speechSynthesis.speak(utterance);
  } catch {
    onError();
  }
}

/** Anuncia un mensaje por voz, en orden (bienvenida primero, luego alertas). */
export function speak(text: string) {
  if (typeof window === "undefined") return;
  detectStickyActivation();
  queue.push(text);
  flush();
}

/**
 * Si el usuario ya interactuó con esta página (ej. login), el navegador
 * permite autoplay: lo marca en userActivation (sticky), aunque el clic
 * ocurrió antes de que registráramos nuestros listeners.
 */
function detectStickyActivation() {
  if (
    !unlocked &&
    typeof navigator !== "undefined" &&
    navigator.userActivation?.hasBeenActive
  ) {
    unlocked = true;
  }
}

/** Intenta hablar lo pendiente (navegadores permisivos o tras login). */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  detectStickyActivation();
  flush();
}

/** ¿El navegador aún no ha reproducido la voz ni hubo gesto? */
export function isAudioBlocked(): boolean {
  return !unlocked;
}

/**
 * Registra listeners globales de primer gesto para desbloquear la voz.
 * Al primer gesto reproduce toda la cola pendiente en orden (bienvenida +
 * alertas), sin importar cuánto hayas tardado.
 * @param onUnlock Se invoca en el primer gesto real.
 */
export function registerAudioUnlock(onUnlock?: () => void) {
  if (typeof window === "undefined") return;
  detectStickyActivation();
  const attempt = () => {
    unlocked = true;
    // Invalidar la utterance colgada y reproducir todo lo pendiente
    epoch++;
    processing = false;
    try { speechSynthesis.cancel(); } catch { /* noop */ }
    flush();
    cleanup();
    try { onUnlock && onUnlock(); } catch { /* noop */ }
  };
  const cleanup = () => {
    ["pointerdown", "mousedown", "keydown", "touchstart", "click"].forEach(ev =>
      window.removeEventListener(ev, attempt)
    );
  };
  ["pointerdown", "mousedown", "keydown", "touchstart", "click"].forEach(ev =>
    window.addEventListener(ev, attempt, { once: true, passive: true })
  );
  // Refuerzo: si la voz ya está permitida (login o play exitoso), drenar cola
  if (unlocked) flush();
}
