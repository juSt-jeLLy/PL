import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    allowedHosts: [
      "e3f8-2409-40e5-1059-6da9-94c8-55e4-504c-5c6d.ngrok-free.app"
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/reposcan": {
        target: "http://127.0.0.1:3005",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/reposcan/, ""),
      },
    },
  },
  plugins: [
    wasm(),               // ← handles .wasm files correctly
    topLevelAwait(),      // ← required for wasm async init
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: ["@worldcoin/idkit-core"], // ← stops esbuild from mangling the wasm
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
