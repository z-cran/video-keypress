# Architecture summary

Video Keypress is a static single-page app. There is no backend; everything lives in the browser tab and `localStorage`.

## Screen

- **Empty state:** a drop zone ("Drop a video here, or choose one").
- **Workspace** (after a video loads):
  - Left (md: 8 of 12 columns): the video and its controls (play, scrubber, time, ±5 s, frame step, speed, mute).
  - Right (md: 4 of 12): the trigger pad (one button per behavior, with live count, total and elapsed time) and the tally table.
  - Below, full width: the timeline (one lane per behavior, click to seek), then the episode list.
- **Header:** file name, Open video, Import, Export, Behaviors (settings), Shortcuts.
- **Footer:** privacy note, version, GitHub link, license.

## Features

| Folder               | Pure modules                                                                                                               | Stateful / UI                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `features/player`    | `playback.ts`: speed steps (0.25 to 2.0), seek clamping, frame step                                                        | `playerStore.ts`, `VideoPlayer`, `PlayerControls`, `SpeedControl`, `VideoDropZone`               |
| `features/behaviors` | `hotkeys.ts`: allowed and reserved codes, `resolveKey`. `behaviors.ts`: defaults, validation, list edits, legacy migration | `behaviorsStore.ts` (persisted), `BehaviorSettingsDialog`, `BehaviorEditor`, `HotkeyField`       |
| `features/recording` | `recorder.ts`: press/release state machine. `tally.ts`: per-behavior stats, overlaps                                       | `sessionStore.ts`, `useGlobalKeys.ts`, `TriggerPad`, `TriggerButton`, `TallyTable`               |
| `features/timeline`  | `timelineScale.ts`: time to px, ticks, hit testing. `timelineSvg.ts`: export SVG                                           | `Timeline`, `EpisodeList`                                                                        |
| `features/session`   | `session.ts`: types and helpers. `sessionFormat.ts`: JSON and CSV in and out. `savedSessions.ts`: storage repository       | `useAutosave.ts`, `useOpenVideo.ts`, `useImportSession.ts`, `RestoreSessionDialog`, `ExportMenu` |

## Stores

- **`usePlayerStore`**: the `<video>` element, load state, `paused`, `duration`, `currentTime` (updated about 10 times a second for display), `rate`, `muted`. Actions wrap the element: `play`, `pause`, `toggle`, `seek`, `seekBy`, `step`, `setRate`. `getTime()` reads `el.currentTime` directly for recording. `rate` and `muted` persist.
- **`useBehaviorsStore`**: the behavior list. Persisted with a versioned migration from the v1 `keybinds` key.
- **`useSessionStore`**: the current `Session`, active recordings, selected episode and the last deletion (for undo). `press` and `release` read time from the player store and run `recorder.ts`.

## Data flow: recording a hold

1. `useGlobalKeys` (capture-phase `keydown` on window) builds a `KeyLike` and calls `resolveKey`.
2. A behavior match calls `sessionStore.press(behavior, "key")`. It reads `getTime()` and the paused state, then runs `recorder.press`.
3. `keyup` calls `sessionStore.release(behaviorId, "key")`. The recorder commits an `Episode` when no holders remain.
4. The session changes; `useAutosave` writes it to `localStorage`. The tally, trigger buttons, timeline and episode list re-render from the store.

Pointer holds follow the same path from `TriggerButton` with holder `pointer:<id>`.

## Timeline

An HTML label column sits beside a horizontally scrolling SVG. Its width comes from a `ResizeObserver` and the zoom level. The playhead moves through a ref on each video frame (`requestVideoFrameCallback`, falling back to `requestAnimationFrame`) without re-rendering bars. Clicking the background seeks; clicking a bar selects it and seeks to its start.
