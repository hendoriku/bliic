import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base relatif ("./"): build yang sama berjalan di subpath (hendoriku.github.io/bliic/) maupun di akar
// domain sendiri (ibp.diofis.net), jadi pindah domain tidak perlu build ulang dengan pengaturan lain.
// Aman karena aplikasi tidak memakai routing berbasis path. Bisa ditimpa lewat VITE_BASE bila perlu.
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
  plugins: [react()],
});
