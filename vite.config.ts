import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

export default defineConfig({
  base: isElectronBuild ? "./" : "/Contribution-Arc/",
  plugins: [react(), tailwindcss()],
  resolve: {
    // @vitejs/plugin-react v6 no longer dedupes these automatically.
    dedupe: ["react", "react-dom"],
  },
});
