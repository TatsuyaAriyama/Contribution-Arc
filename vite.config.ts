import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Native shells (Electron, Capacitor/iOS) load the bundle from a local
// origin (file:// or capacitor://localhost), so they need a RELATIVE base.
// The default web build keeps the GitHub Pages sub-path.
const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";
const isNativeBuild = isElectronBuild || isCapacitorBuild;

export default defineConfig({
  base: isNativeBuild ? "./" : "/Contribution-Arc/",
  plugins: [react(), tailwindcss()],
  resolve: {
    // @vitejs/plugin-react v6 no longer dedupes these automatically.
    dedupe: ["react", "react-dom"],
  },
});
