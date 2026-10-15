import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Powly serves uploaded builds from a path of their own, so generated URLs must be relative.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
