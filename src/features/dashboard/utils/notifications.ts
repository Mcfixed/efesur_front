// ─────────────────────────────────────────────────────────────
// Notificaciones del sistema (Web Notifications API)
// - Muestra una notificación del SO cuando llega una alerta NUEVA y el
//   usuario no está mirando la pestaña (tab oculta o ventana sin foco).
// - Cubre los mismos tipos que la voz: critica, atencion, apertura,
//   presencia, movimientos_anomalos (desconexiones no).
// - IMPORTANTE: NO usar `renotify` sin `tag` — lanza TypeError y la
//   notificación nunca se muestra.
// ─────────────────────────────────────────────────────────────

// Tipos que generan notificación del sistema (igual que los que anuncia la voz)
const NOTIFY_TYPES = new Set([
  "critica",
  "atencion",
  "apertura",
  "presencia",
  "movimientos_anomalos",
]);

const TYPE_LABELS: Record<string, string> = {
  critica: "crítica",
  atencion: "atención",
  apertura: "apertura",
  presencia: "presencia",
  movimientos_anomalos: "movimientos anómalos",
};

/** Pide permiso de notificaciones del sistema (si aún no está decidido). */
export function requestNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      resolve(false);
      return;
    }
    if (Notification.permission === "granted") {
      resolve(true);
      return;
    }
    if (Notification.permission === "denied") {
      resolve(false);
      return;
    }
    // "default": pedir
    Notification.requestPermission()
      .then((p) => resolve(p === "granted"))
      .catch(() => resolve(false));
  });
}

/** ¿Está permitido mostrar notificaciones del sistema? */
export function notificationsAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

/**
 * Muestra una notificación del sistema para una alerta nueva.
 * Solo si: permiso otorgado, tipo permitido y el usuario NO está mirando
 * la pestaña (oculta o ventana sin foco). Si el permiso aún no está
 * decidido, lo pide en ese momento.
 * Se usa `tag` con el id de la alerta para que, si hay varias pestañas
 * abiertas, NO se repita la notificación (el navegador reemplaza las
 * que tienen el mismo tag en todo el origen).
 */
export async function notifyAlert(alert: {
  type: string;
  device_name: string;
  id?: number;
}) {
  if (!NOTIFY_TYPES.has(alert.type)) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;

  // Si el usuario está mirando la pestaña, la voz + la UI ya avisan:
  // no hace falta la notificación del sistema.
  if (!document.hidden && document.hasFocus()) return;

  if (Notification.permission === "default") {
    const ok = await requestNotificationPermission();
    if (!ok) return;
  }
  if (Notification.permission !== "granted") return;

  const device = alert.device_name || "un dispositivo";
  const label = TYPE_LABELS[alert.type] || alert.type;

  let title: string;
  let body: string;
  if (alert.type === "critica") {
    title = "🔴 ALERTA CRÍTICA";
    body = `ALERTA CRÍTICA en ${device}. Revise inmediatamente la plataforma y ejecute el protocolo establecido.`;
  } else {
    title = `⚠️ Alerta de ${label}`;
    body = `Alerta ${label} en ${device}.`;
  }

  try {
    const n = new Notification(title, {
      body,
      tag: alert.id !== undefined ? `alerta-${alert.id}` : undefined,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* noop */
  }
}
