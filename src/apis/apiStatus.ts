// Estado de conexión con la API: lo alimenta apiClient y lo muestra ConnectionBanner.
export type EstadoConexion = "ok" | "sin-red" | "sin-servidor";

type Listener = (estado: EstadoConexion, ultimoOk: number) => void;

const listeners = new Set<Listener>();
let estado: EstadoConexion = typeof navigator !== "undefined" && !navigator.onLine ? "sin-red" : "ok";
let ultimoOk = Date.now();

const emitir = () => listeners.forEach((l) => l(estado, ultimoOk));

export const apiStatus = {
  snapshot: () => ({ estado, ultimoOk }),

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  exito() {
    ultimoOk = Date.now();
    if (estado !== "ok") { estado = "ok"; emitir(); }
  },

  // El backend respondió 503: está vivo pero sin base de datos
  falloServidor() {
    if (estado !== "sin-servidor") { estado = "sin-servidor"; emitir(); }
  },

  // Ni siquiera hubo respuesta
  falloRed() {
    const nuevo: EstadoConexion = !navigator.onLine ? "sin-red" : "sin-servidor";
    if (estado !== nuevo) { estado = nuevo; emitir(); }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => { estado = "sin-red"; emitir(); });
  window.addEventListener("online", () => { estado = "sin-servidor"; emitir(); });
}
