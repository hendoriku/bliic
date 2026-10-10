import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE: "/bliic/" di GitHub Pages (subpath), "/" di domain sendiri.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
});
