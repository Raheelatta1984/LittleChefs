import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The browser only ever talks to Vite (same origin). Vite proxies /api and
// /uploads to the local API server, so the preview host works without CORS or
// hard-coded localhost URLs in the client bundle.
const proxy = {
  "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
  "/uploads": { target: "http://127.0.0.1:8787", changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // Preview sandboxes serve the app from a generated *.e2b.app host.
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy,
  },
});
