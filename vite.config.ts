import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split big libraries into their own chunks so the main bundle stays small
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          leaflet: ["leaflet", "react-leaflet"],
          firebase: [
            "firebase/app",
            "firebase/messaging",
            "firebase/firestore",
            "firebase/database",
          ],
        },
      },
    },
    // Slightly relax the warning limit now that we are chunking
    chunkSizeWarningLimit: 900,
  },
}));
