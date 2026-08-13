import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // The remaining large chunk is the lazy-loaded PDF parser, not the app shell.
    chunkSizeWarningLimit: 550,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    // vitest.setup.ts raises findBy*/waitFor's ceiling to 5000ms so a session
    // render behind async mocks doesn't expire the wait. The test timeout must
    // sit comfortably above that ceiling, or a single near-ceiling settle burns
    // the whole budget and the test times out before its later assertions run —
    // the Practice keyboard-navigation flake (PREPIO-142), where starting a
    // session then navigating chains several async settles with no headroom.
    testTimeout: 20000,
    // Playwright specs in e2e/ are run by `npm run test:e2e`, not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  }
}));
