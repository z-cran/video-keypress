import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

/**
 * Build the video service worker on its own, after the app, as one file at
 * dist/video-sw.js. A worker only controls URLs at or below its own path, and
 * Vite puts scripts under assets/, so the app build cannot emit it (ADR-017).
 * `npm run dev` does not serve it; the app falls back to blob URLs there.
 */
function videoServiceWorker(): Plugin {
  let root = process.cwd();
  let outDir = "dist";
  return {
    name: "video-keypress:service-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await build({
        configFile: false,
        root,
        logLevel: "warn",
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          lib: {
            entry: "src/features/player/videoServiceWorker.ts",
            formats: ["iife"],
            name: "videoKeypressServiceWorker",
            fileName: () => "video-sw.js"
          }
        }
      });
    }
  };
}

// GitHub Pages serves this repo under /video-keypress/.
export default defineConfig({
  base: "/video-keypress/",
  plugins: [react(), videoServiceWorker()],
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
