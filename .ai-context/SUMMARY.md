# Architecture summary

Video Keypress is a static single-page app. There is no backend; everything lives in the browser tab and `localStorage`.

## Screen

- **Empty state:** a drop zone ("Drop a video here"), with a second button to open saved scores (JSON).
- **Workspace** (after a video loads, or after scores are imported):
  - Left (md: 8 of 12 columns): the video and its controls (play, scrubber, time, ±5 s, frame step, speed, mute). With imported scores and no video, an info banner with "Open video" takes its place.
  - Right (md: 4 of 12): the trigger pad (one button per behavior, with count, total and live elapsed time) and the tally table.
  - Below, full width: the timeline (one lane per behavior, click to seek), then the episode list.
- **Header:** file chip, Behaviors, Import, Export, Open video, Keyboard shortcuts, theme (system, light, dark).
- **Footer:** privacy note, version, GitHub link, license.

## Features

| Folder               | Pure modules (tested without a DOM)                                                                                                                          | Stateful and UI                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/player`    | `playback.ts`: speed steps (0.25 to 2.0), seek clamping, frame step, file and media error messages                                                           | `playerStore.ts`, `VideoPlayer`, `PlayerControls`, `SpeedControl`, `VideoDropZone`, `VideoFileButton`                                                                                                          |
| `features/behaviors` | `hotkeys.ts`: allowed and reserved codes, `resolveKey`. `behaviors.ts`: defaults, validation, list edits, sanitizing, merging, v1 migration                  | `behaviorsStore.ts` (persisted), `settingsDialogStore.ts`, `BehaviorSettingsDialog`, `HotkeyField`, `ColorPicker`, `confirmBehaviorRemoval.ts`                                                                 |
| `features/recording` | `recorder.ts`: press and release state machine. `tally.ts`: per-behavior stats, overlaps                                                                     | `sessionStore.ts`, `useGlobalKeys.ts`, `useTally.ts`, `TriggerPad`, `TriggerButton`, `TallyTable`                                                                                                              |
| `features/timeline`  | `timelineScale.ts`: time to px, ticks, lanes, hit testing. `timelineSvg.ts`: SVG export                                                                      | `Timeline`, `EpisodeList`                                                                                                                                                                                      |
| `features/session`   | `session.ts`: types, fingerprint, behavior snapshot. `sessionFormat.ts`: JSON and CSV in and out. `savedSessions.ts`: storage repository with quota eviction | `openVideo.ts` (open, attach, route files), `importScores.ts`, `adoptSession.ts`, `restoreSession.ts`, `useAutosave.ts`, `ExportMenu`, `CsvColumnsDialog`, `exportPrefsStore.ts` (persisted CSV column choice) |

Shared: `lib/` (`time.ts`, `id.ts`, `download.ts`, `noticeStore.ts` for snackbars, `confirmStore.ts` for promise-based confirm dialogs) and `components/` (header, footer, `Notices`, `ConfirmDialog`, `ShortcutsDialog`, `ColorModeButton`, `ControlButton`). `Root.tsx` wraps `App` in the theme; tests render `Root`.

## Stores

- **`usePlayerStore`**: the `<video>` element, load state, `paused`, `duration`, `currentTime` (updated about 10 times a second for display), `rate`, `muted`, `error`. Actions wrap the element. `getTime()` reads `el.currentTime` directly for recording. `rate` and `muted` persist.
- **`useBehaviorsStore`**: the behavior list, persisted, with a one-time migration from the v1 `keybinds` key. `mergeIn` adds behaviors from a session.
- **`useSessionStore`**: the current `Session` (null before anything is opened), active recordings, the selected episode and the `autosave` flag. `press` and `release` read time from the player store and run `recorder.ts`.

## Flows

**Recording a hold.** `useGlobalKeys` (capture-phase `keydown` on window) builds a `KeyLike` and calls `resolveKey`. A behavior match calls `sessionStore.press(behavior, "key")`, which reads `getTime()` and runs `recorder.press`. `keyup` calls `release`; the recorder commits an `Episode` when no holders remain. Pointer holds follow the same path from `TriggerButton` with holder `pointer:<id>`.

**Opening a video.** `openFiles` routes JSON to `importScores` and anything else to `openVideo`. `openVideo` commits active episodes, asks whether to attach read-only imported scores (if any), loads the file and starts a session with autosave off. When the duration is known, `useAutosave` calls `offerRestore`, which offers a saved session for the same fingerprint and then turns autosave on. Autosave starts off so the new, empty session cannot overwrite the saved one first.

**Autosave.** `useAutosave` subscribes to the session and behaviors stores and writes `{ ...session, behaviors: snapshot }` through `savedSessions`. An empty session removes the saved entry. Quota errors evict the oldest other sessions, then show a sticky warning and arm `beforeunload`.

**Importing.** With no video open, the file becomes a read-only session (`fingerprint: null`): tally, timeline and export work; recording and seeking do not. With a video open, `importScores` asks to add or replace and warns when the file names differ. Both go through `adoptSession`, which merges behaviors and re-points episodes.

## Timeline

An HTML label column sits beside a horizontally scrolling SVG. Its width comes from a `ResizeObserver` and the zoom level (1x to 128x). A `requestAnimationFrame` loop moves the playhead through a ref and keeps it in view while playing, without re-rendering the bars. Episodes being recorded render in `ActiveBars`, which re-renders with the display clock. Clicking the background seeks and dragging scrubs; clicking a bar (moved 3 px or less) selects it and seeks to its start. Bars narrower than 2 px are drawn at 2 px and hit-tested with a 6 px tolerance.
