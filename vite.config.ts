import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_SERVER_PORT) || 3001,
      host: env.VITE_SERVER_HOST === "true",
      allowedHosts: [
        env.VITE_SERVER_ALLOW_CORS || "dominio_produccion.iotlink.cl",
      ],
      proxy: {
        // Reenvía todas las peticiones /api al backend principal
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    resolve: {
      alias: [
        { find: "@/libs", replacement: path.resolve(__dirname, "./libs") },
        { find: "@/apis", replacement: path.resolve(__dirname, "./src/apis") },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },
  };
});
