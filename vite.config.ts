import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

export default defineConfig({
  base: isElectronBuild ? "./" : "/Contribution-Arc/",
  plugins: [react(), tailwindcss()],
});
