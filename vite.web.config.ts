import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Browser mic-test site. Static output in dist-web/, deployable to any HTTPS host.
export default defineConfig({
  root: "web",
  base: "./",
  publicDir: "../public",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    // AudioWorklet modules must be real files, never inlined data: URLs.
    assetsInlineLimit: (file) => (file.endsWith(".js") ? false : undefined),
  },
  server: {
    port: 5173,
    // AI voice preview: the local voice server (personal testing build), same computer only.
    proxy: {
      "/ai": { target: "http://127.0.0.1:47821", rewrite: (p) => p.replace(/^\/ai/, "") },
    },
  },
});
