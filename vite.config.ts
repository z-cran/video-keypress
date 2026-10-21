import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

// GitHub Pages serves this repo under /video-keypress/.
export default defineConfig({
  base: "/video-keypress/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  build: {
    // One ~200 kB (gzip) chunk, mostly MUI. Splitting it gains nothing for a
    // single-page tool that loads once.
    chunkSizeWarningLimit: 800
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    css: false,
    silent: "passed-only"
  }
});
