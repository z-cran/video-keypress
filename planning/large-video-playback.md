---
status: APPROVED 2026-11-26
branch: large-video-playback
---

# Play large videos on iPad through a service worker

## Context

Large videos stall on iPad 4 to 8 seconds in, in Safari and Chrome. Both use WebKit. See `planning/ipad-video-stall.md` and `.ai-context/EXPLORATIONS/2026-11-26-ipad-video-stall.md`.

The reporter's two diagnostics reports settled the cause. Both used the same 4.0 GB GoPro chapter, `GX010969.mp4`: HEVC, 11:48 long, about 45 Mbps.

- **App (`?debug=media`):** data stopped at 0:07.3, followed by `stalled` and then `waiting`. The network state stayed loading, with no error.
- **Bare player (`?mediacheck`):** the same pattern, stopping at 0:04.5. The app's code is not involved.

Researchers want to score long recordings, over 30 minutes. GoPro writes those as a series of chapter files of about 4 GB each.

### Root cause, from the iPadOS 18.4 simulator

- After a 2-byte probe, the iPad's player (AVFoundation) requests the rest of the file in one go: `Range: bytes=0-4066491438`.
- WebKit's `blob:` loader tries to fill that whole range. With a 4 GB file it falls behind or never finishes.
- A service worker that answered the same open-ended range with the whole remainder also hung.

### The fix, measured

Answer each range request with at most a few megabytes, as a `206 Partial Content`. The player accepts the partial answer and asks for the next range.

Tested with a 4.07 GB, 12 min, 45 Mbps file:

| Source                          | Metadata   | Playback                 | Seek to 10:00 (about 3.4 GB in) |
| ------------------------------- | ---------- | ------------------------ | ------------------------------- |
| `blob:` URL (today)             | about 12 s | stalls at 12 s           |                                 |
| Service worker, full ranges     | about 10 s | never starts             |                                 |
| Service worker, 4 MB per answer | 0.1 s      | steady 30 fps, no stalls | 1.4 s, then smooth              |

## Approach

The picked `File` stays in the browser. A service worker in the app's scope serves it to the `<video>` at `/video-keypress/__video/<id>`, one capped byte range at a time. Where no worker controls the page, the app falls back to a `blob:` URL as today. That covers the dev server, plain HTTP on the LAN, tests, and a blocked registration.

### 1. Pure module `src/features/player/videoStream.ts` (tested in Node)

- `MAX_RANGE_BYTES = 8 MiB`. 4 MB worked in the simulator but kept only 3 to 5 s buffered at 45 Mbps. Tune on a real iPad.
- `planRange(rangeHeader, size, maxBytes)`:
  - Returns `{ status: 200 | 206 | 416, start, end }`.
  - Single ranges: `a-b`, `a-` and the suffix form `-n`.
  - `end` is clamped to the size, and open or long ranges are capped to `maxBytes`.
  - A start past the end returns 416.
  - Malformed and multi-range headers are ignored, which gives 200 per RFC 9110.
  - Offsets beyond 2³² must work.
- `rangeHeaders(plan, size, type)`:
  - Sets `Content-Range`, `Content-Length`, `Accept-Ranges` and `Cache-Control: no-store`.
  - Sends `Content-Type` only when the file has one; with no type, WebKit sniffs.
- `videoUrl(base, id)` and `videoIdFromUrl(url, scope)` build and parse the URL.
- The page and worker exchange `put`, `forget`, `need-file` and `file` messages, each with a type guard.

### 2. Worker logic `src/features/player/videoWorker.ts`, plus entry `videoServiceWorker.ts`

- `installVideoWorker(scope, options)` takes a structural scope type, not the WebWorker lib, so it type-checks with the app and runs in tests with a fake scope.
- **Lifecycle:** `install` calls `skipWaiting`. `activate` calls `clients.claim()`, so the first visit is controlled without a reload.
- **Messages:** `message` stores or forgets a file by id.
- **`fetch`:**
  - Only `__video/<id>` URLs are handled. Everything else passes through untouched: no caching, so no stale app.
  - `GET` answers with `file.slice(start, end + 1)`. `HEAD` answers with the headers only.
  - Browsers stop idle workers. If the file is missing, the worker asks the page for it over a `MessageChannel`, first the requesting client, then all windows, with a 3 s timeout.
  - If no page has the file, the answer is a 404 with a gentle message.
- `videoServiceWorker.ts` only calls `installVideoWorker(globalThis as …)`.

### 3. Build: emit `/video-keypress/video-sw.js`

- A worker can only control paths at or under its own URL, and Vite puts scripts in `/assets/`. So a plugin in `vite.config.ts` runs a second Vite build in `closeBundle`: lib mode, one IIFE, `dist/video-sw.js`.
- `npm run build`, CI and `npm run preview` all get the worker. `npm run dev` does not, and falls back to `blob:`.

### 4. Page side `src/features/player/videoStreamClient.ts`

- `registerVideoServiceWorker()` is called from `main.tsx`. It skips dev and missing support, and catches registration errors.
- `openVideoStream(file, { preferBlob })` returns `{ url, via, release }`:
  - With a controller, it posts the file to the worker and returns the worker URL. `release` sends `forget`.
  - Otherwise it uses a `blob:` URL, and `release` revokes it.
  - It answers the worker's `need-file` requests from its own map of open files.
- `playerStore.openFile` and `closeVideo` use it. `VideoSource` gains `via` and `release`, replacing the direct `createObjectURL` and `revokeObjectURL` calls.

### 5. Diagnostics

- The report gains `Source: service worker` or `Source: blob URL`.
- `?mediacheck` gets a "Load with" choice: service worker when available, or blob URL. The reporter can then compare both on the same iPad.

### 6. Docs

- `DECISIONS.md`: ADR-017.
- `SUMMARY.md`: player feature, flow, and the debug pages.
- `PATTERNS.md`: the capped-range rule.
- `AGENTS.md`: the Video line.
- README privacy note: the worker serves the file locally; nothing is uploaded.
- `planning/progress.md`.

## Out of scope

- Opening several GoPro chapters as one timeline. That is a separate feature, if researchers want it.
- Media Source Extensions remuxing. Only needed if the capped ranges fail on real devices.

## Verification

- `npm run check`.
- **Unit tests** (Node), following the testing principles:
  - `planRange` and `rangeHeaders`: open, suffix and clamped ranges; offsets over 2³²; size 0; malformed; multi-range; a cap of 0 or NaN.
  - URL helpers and message guards.
  - `installVideoWorker` with a fake scope and real `Request`, `Response` and `Blob`:
    - serves a ranged slice byte for byte, and caps an open range;
    - returns 416, answers `HEAD`, and ignores other URLs;
    - asks the page after a restart, and returns 404 when no page answers (fake timers);
    - `forget` works, and `install` and `activate` call `skipWaiting` and `claim`.
- **Integration tests** (jsdom, fake `navigator.serviceWorker`):
  - The app uses the worker URL and posts the file.
  - It answers `need-file`.
  - It forgets the old file when another video opens.
  - It falls back to `blob:` without a worker.
  - The report shows the source.
  - `?mediacheck` honors the blob choice.
- **Build:** `npm run build` emits `dist/video-sw.js` as one file with no `import`.
- **Simulator:** run the production build with the 4 GB file, in the app and in `?mediacheck`, including a seek past 2 GiB.
- **Real iPad:** the reporter plays `GX010969.mp4` in the app with `?debug=media`. Expect `Source: service worker` and no stall.
