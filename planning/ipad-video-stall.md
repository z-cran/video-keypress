---
status: APPROVED 2026-11-26
branch: video-freezing
---

# iPad video stall: diagnose on device, then fix

## Context

Researchers report that the v2 app (branch `v2-rebuild`) stops playing a video after 4 to 8 seconds on iPad, in both Safari and Chrome. Chrome on iPad uses the same WebKit engine as Safari. When it happens, the picture and the clock both stop while the button still shows Pause, so the `<video>` is stuck waiting for data. Their videos are long or large and come from the Photos library. MacBook browsers are fine.

### What the investigation found (2026-11-26)

- **The app does not stop the video itself.** I read every file that touches the player: `VideoPlayer.tsx`, `playerStore.ts`, `PlayerControls.tsx`, `Timeline.tsx`, `EpisodeList.tsx`, `sessionStore.ts`, `useAutosave.ts`, `restoreSession.ts`, `useGlobalKeys.ts`, `App.tsx`. Nothing pauses, seeks, reloads or remounts the video during playback. In headless Chrome I wrapped the `currentTime` setter and `pause()` on a production build. Over 12 s there were no programmatic seeks or pauses and no long tasks, and it held a steady 30 fps.
- **The iPadOS 18.4 simulator does not reproduce it.** The app build plays a 12 MB clip and a 1.4 GB, one-hour MP4 through a blob URL without stalling, and screenshots show the picture advancing. A bare `<video>` page behaves the same. The harness is in the session scratchpad (`harness.js`, `serve.mjs`, `control.html`).
- **What the simulator could not copy**, so one of these is the trigger:
  - the file-backed temporary copy the Photos picker hands over (often HEVC `.MOV`, sometimes transcoded);
  - real iPad memory limits;
  - sound on (the harness ran muted);
  - touch input.
- **Where the bytes come from.** On iPadOS, AVFoundation pulls a `blob:` URL's bytes through WebKit's resource loader, not straight from disk. When those requests stop, playback stops at the end of the first buffered stretch, which is a few seconds.
- **No known WebKit bug matches.** Bug 228683 (picked temp file deleted after 60 s) and bugs 232076, 232195 and 238170 (blob Range headers on iOS 15) are all fixed, and their timing doesn't fit.
- **Side finding, measured.** The persisted player store writes `video-keypress:prefs` to localStorage about 14 times a second during playback. Zustand's `persist` writes on every `setState`, including the 10 Hz `currentTime` tick, even though only `rate` and `muted` are persisted. That doesn't cause the stall on desktop or in the simulator, but it is pointless main-thread work on an iPad.

The root cause needs evidence from a real iPad. The plan adds a way to capture that evidence, lets us compare the app with a bare player using the same file, and removes the write churn.

## Recommended approach

### 1. Media diagnostics, opt in with `?debug=media`

- **New `src/features/player/mediaDiagnostics.ts`**, a pure module:
  - `describeMedia(snapshot)` turns `readyState` and `networkState` into names, lists buffered ranges as text, and handles `NaN` and `Infinity`, an empty buffer and a null error.
  - `appendEvent(log, entry, max)` keeps a bounded event log and returns a new array.
  - `formatReport(file, snapshot, log, userAgent)` builds the text a researcher copies into a bug report, including the file's name, type and size.
  - Takes plain objects, not DOM elements, and gets a sibling `mediaDiagnostics.test.ts`.
- **New `src/features/player/MediaDiagnostics.tsx`**, a small panel under `PlayerControls`:
  - Shown only when the URL has `debug=media`.
  - Listens on the store's `el` for `waiting`, `stalled`, `suspend`, `progress`, `error`, `abort`, `emptied`, `playing`, `pause`, `seeking`, `seeked`.
  - Shows the live snapshot and the last 30 events, plus a Copy report button (`navigator.clipboard.writeText`).
  - Reads the element only in effects and handlers, to satisfy the React Compiler rules.
- **New `src/features/player/MediaCheck.tsx`**, a bare comparison page selected in `Root.tsx` by `?mediacheck`:
  - Contains only a file input, a plain `<video controls playsInline>` and the same diagnostics panel. No stores, no 10 Hz re-render, no timeline.
  - Keeps the input mounted and its value set, unlike `VideoFileButton`, which clears the value and unmounts with the drop zone.
  - Purpose: the same Photos file on the same iPad tells us whether WebKit or the app is at fault.
- Copy follows AGENTS.md: gentle wording, `·` separators, no exclamation marks.

### 2. Stop per-tick localStorage writes

- Add `dedupeStorage(storage)` in `src/lib/` (pure, with tests). It wraps a `Storage`-like object and skips `setItem` when the value matches the last one written for that key.
- Use it in `playerStore.ts`: `createJSONStorage(() => dedupeStorage(localStorage))`.
- The prefs then hit storage only when `rate` or `muted` changes. Check `resetData.ts` (`setRate(1)`, `setMuted(false)`), which must still write.

### 3. On-device test protocol for the reporters

Write this into `planning/ipad-video-stall.md`. Use the same Photos video both times and note the iPadOS version.

1. Open the app with `?debug=media`, open the video from Photos, press Play, wait for the stall, then tap Copy report.
2. Open `?mediacheck`, pick the same video, press Play, then Copy report.
3. Optional: connect the iPad to the MacBook, turn on Settings > Apps > Safari > Advanced > Web Inspector, and use Safari's Develop menu to watch the blob range requests in the Network tab.

### 4. Choose the fix from the reports

Per the planning convention, the fix gets its own plan once the evidence is in:

- **Both pages stall:** WebKit cannot stream this Photos file through a blob URL. The leading fix is a service worker that answers the video's range requests from `file.slice()`; it needs HTTPS, which GitHub Pages has. The fallback is `video.srcObject = file` where supported.
- **Only the app stalls:** the app's handling of the picked file or its main-thread load is to blame. Bisect by keeping the picked file's input mounted and its value intact, using step 2's write reduction, and pausing the Timeline's animation-frame loop while the video is paused.
- **An `error` event with a code:** map it in `mediaErrorMessage` (`playback.ts`) to a clear next step, for example converting HEVC to H.264.

### Housekeeping (project conventions)

- Save this plan as `planning/ipad-video-stall.md` and add a work unit to `planning/progress.md`.
- Save the investigation as `.ai-context/EXPLORATIONS/2026-11-26-ipad-video-stall.md` and add it to the index.
- Note the `?debug=media` and `?mediacheck` flags in `.ai-context/PATTERNS.md` or `SUMMARY.md`.

## Files

- **New:**
  - `src/features/player/mediaDiagnostics.ts` and `mediaDiagnostics.test.ts`
  - `src/features/player/MediaDiagnostics.tsx`
  - `src/features/player/MediaCheck.tsx`
  - `src/lib/dedupeStorage.ts` and `dedupeStorage.test.ts`
- **Changed:**
  - `src/Root.tsx`: route `?mediacheck`.
  - `src/App.tsx` (`PlayerColumn`): mount the panel when `debug=media`.
  - `src/features/player/playerStore.ts`: deduped storage.
- **Reuse:**
  - `mediaErrorMessage` in `playback.ts`
  - `formatClock` in `src/lib/time.ts`
  - `notify` from `src/lib/noticeStore.ts` for "Report copied."
  - `installMediaFakes` and the helpers in `src/test/fakeMedia.ts` for the component tests.

## Verification

- `npm run check` (format, lint, typecheck, tests).
- **Unit tests** (testing principles): `describeMedia` with `NaN`, `Infinity`, an empty buffer, out-of-range state codes and a null error. `appendEvent` at the cap and with `max` of 0. `dedupeStorage`: the same value is skipped, a changed value is written, separate keys are tracked independently, and a throwing `setItem` still throws, because autosave's full-storage path depends on that.
- **Component tests** with `fakeMedia`:
  - Without `debug=media`, no panel renders.
  - With it, dispatching `waiting` on the video adds a row and Copy report writes the report text.
  - `?mediacheck` renders the bare player without the workspace.
  - A test that plays for many ticks and checks that `localStorage.setItem` is not called for the prefs key, and is called after `setRate`.
- **Simulator harness re-run.** Use the scratchpad harness on an iPad simulator. It should show `lsWrites` near 0 during playback, the panel rendering, and `?mediacheck` playing.
- **Real iPad:** the reporters run step 3, and their two reports drive step 4.
