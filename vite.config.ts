import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // SOURCE: Vite's conventional development port.
    proxy: {
      "/api": "http://127.0.0.1:4100", // SOURCE: DispatchOps local API port documented in README.
    },
  },
  build: {
    outDir: "dist/client",
  },
});
