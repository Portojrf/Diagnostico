import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Vite dev + build configuration for the PontiScore React web app.
// - Dev server runs on 0.0.0.0:3000 so it is reachable through the platform ingress.
// - `allowedHosts: true` accepts the preview subdomain (*.preview.emergentagent.com).
// - `/api` calls are proxied to the FastAPI backend on :8001 in dev, mirroring the
//   Kubernetes ingress behaviour so relative fetches work identically in production
//   (when deployed same-origin) and locally.
const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: srcPath },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      // Use wss on the preview URL for HMR through the ingress.
      clientPort: 443,
      protocol: "wss",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
