interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

interface ApiClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
}

// ─── Recuperación ante sesión de red expirada ───────────────────────────────
// Cloudflare Access NO está pensado para XHR: cuando la sesión de red expira
// responde un 302 cross-origin a wisensor.cloudflareaccess.com, y el navegador
// bloquea esa respuesta por CORS. El SPA no puede leerla ni recuperarse, así que
// la app queda "rota" hasta que el usuario recarga a mano.
//
// Estas guardas convierten ese estado en una recarga automática (una navegación
// sí puede completar el re-login silencioso de Access). El guard de tiempo evita
// bucles si el problema persiste (backend caído, Access caído, etc.).
const RELOAD_GUARD_KEY = "api_reload_at";
const RELOAD_GUARD_MS = 15000;

function reloadOnce(reason: string): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    console.warn(`[apiClient] ${reason}. Recargando para revalidar la sesión...`);
    window.location.reload();
  } catch {
    /* sessionStorage no disponible: mejor no recargar */
  }
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseURL}${endpoint}`;

    // Agregar query params si existen
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // La autenticación va por la COOKIE de sesión de better-auth (credentials: include).
    // No se envía `Authorization: Bearer`: el backend no tiene habilitado el plugin
    // `bearer` de better-auth, así que ese header se ignora y solo daría una falsa
    // sensación de seguridad.
    const headers: Record<string, string> = { ...this.defaultHeaders };

    const config: RequestInit = {
      method,
      headers,
      credentials: "include",
    };

    if (data && method !== "GET") {
      config.body = JSON.stringify(data);
    }

    // `redirect: "manual"` permite DETECTAR la intercepción de Access en vez de morir
    // con un error de CORS ilegible.
    let response: Response;
    try {
      response = await fetch(url, { ...config, redirect: "manual" });
    } catch (err) {
      if (err instanceof TypeError) {
        reloadOnce("No se pudo contactar la API (¿sesión de red expirada?)");
        throw new ApiError("No se pudo contactar la API", 0, null);
      }
      throw err;
    }

    // Respuesta opaca: la petición fue redirigida (típicamente al login de Access)
    if (response.type === "opaqueredirect" || response.status === 0) {
      reloadOnce("La petición fue redirigida a un login externo");
      throw new ApiError("Sesión de red expirada", 0, null);
    }

    // Sesión de la app expirada o revocada: recargar lleva a ProtectedRoute -> login
    if (response.status === 401) {
      reloadOnce("Sesión expirada o revocada");
      throw new ApiError("Sesión expirada", 401, null);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || errorData.error || `Error ${response.status}`,
        response.status,
        errorData
      );
    }

    // Manejar respuestas vacías (ej: DELETE)
    const text = await response.text();
    let responseData: unknown = null;
    if (text) {
      try {
        responseData = JSON.parse(text);
      } catch {
        // No es JSON: casi siempre es la página HTML del login de Access
        if ((response.headers.get("content-type") || "").includes("text/html")) {
          reloadOnce("La API devolvió HTML en vez de JSON");
        }
        throw new ApiError("Respuesta no válida del servidor", response.status, text.slice(0, 200));
      }
    }

    return {
      data: responseData as T,
      status: response.status,
      ok: response.ok,
    };
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, undefined, params);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, data);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, data);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint);
  }

  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
}


export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3005/api",
});

export { ApiClient };
export type { ApiResponse, ApiClientConfig };
