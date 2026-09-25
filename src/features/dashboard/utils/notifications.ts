// ─────────────────────────────────────────────────────────────
// Notificaciones del sistema (Web Notifications API): avisa cuando llega una alerta
// nueva y el usuario no está mirando la pestaña. Cubre los mismos tipos que la voz.
// NO usar `renotify` sin `tag`: lanza TypeError y la notificación no se muestra.
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
    Notification.requestPermission()
      .then((p) => resolve(p === "granted"))
      .catch(() => resolve(false));
  });
}

export function notificationsAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

// `tag` con el id de la alerta: si hay varias pestañas abiertas el navegador
// reemplaza la notificación en vez de duplicarla.
export async function notifyAlert(alert: {
  type: string;
  device_name: string;
  id?: number;
}) {
  if (!NOTIFY_TYPES.has(alert.type)) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;

  // Si está mirando la pestaña, ya avisan la voz y la UI.
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
