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
  // ビルドごとに変わる ID。Service Worker の登録 URL に付与して、
  // デプロイのたびに新しい SW として更新が検知されるようにする
  // (古いアプリシェルが残って「反映されない」のを防ぐ)。
  define: {
    __SW_BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  resolve: {
    // @vitejs/plugin-react v6 no longer dedupes these automatically.
    dedupe: ["react", "react-dom"],
  },
});
