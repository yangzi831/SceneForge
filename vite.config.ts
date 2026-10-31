import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      input: { main: "index.html", festival: "festival-hq/index.html" },
    },
    sourcemap: true,
  },
});
