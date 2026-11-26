/*
 * Service worker entry. vite.config.ts builds this on its own into
 * /video-keypress/video-sw.js, so its scope covers the whole app.
 */
import { installVideoWorker, type WorkerScope } from "./videoWorker.ts";

installVideoWorker(globalThis as unknown as WorkerScope);
