---
status: APPROVED 2026-10-20
branch: v2-rebuild
---

# Video Keypress v2: modernize, rebuild on MUI, add AI scaffolding

## Context

Video Keypress is a client-side tool for researchers. They load a local video of mice and press hotkeys while a behavior (e.g. scratching) is happening, and the app records when and for how long. The code was last touched in Feb 2022. It is a Create React App in plain JS on React 17 and MUI v4, with reactn global state, react-player and a Google Charts timeline loaded from Google's CDN. Nearly all of it sits in `src/App.js` (822 lines) and `src/Chart.js` (400 lines).

Problems that bear on the core features:

- **Imprecise timestamps.** They come from react-player's `onProgress` tick, which fires once per second, so each event can be off by up to 1s.
- **Space play/pause is shown in the UI but disabled.** Speeds are limited to 0.5/1/1.5/2.
- **State is mutated in place.** The timeline code also changes stored event times, and those changes leak into exports.
- **Imported data is read-only.** There is no way to resume scoring a video.
- **A page refresh loses everything.**
- **Dead weight:** 11 unused dependencies, a broken test, and a committed `.eslintcache`.

The goal is a clean v2.0.0 on the current stack: Vite, React 19, TypeScript and MUI 9. It covers the requested features: local video player, speed in 0.25 steps up to 2x, configurable hotkeys saved to localStorage, configurable click triggers, a live tally, and a clickable timeline. It also adds AI scaffolding modeled on `remoteiq-frontend`.

## Decisions

**From the user:**

- Per-behavior trigger mode. **Hold** (default): the episode lasts while the key or mouse button is held. **Toggle**: press to start, press again to stop.
- Autosave per video.
- Lean, adapted AI scaffolding: no code-review-graph and no internal test-principles evaluator.
- Mirror remoteiq's zero-AI-attribution rule, enforced by a commit-msg hook.

**Defaults I picked:**

- MUI **9.5**, the latest, rather than remoteiq's 7.3.
- TypeScript **~6.0.3**. typescript-eslint 8.72 requires TS below 6.1, so TS 7 is out for now.
- Zustand for state.
- Native `<video>` replaces react-player.
- A custom SVG timeline replaces Google Charts.
- Stay on npm.
- `.nvmrc` = 22, since local Node 22.21 comes from Homebrew. jsdom is pinned to `^29.1.1`, because jsdom 30 needs Node 22.22.2 or newer. Moving to Node 24 and jsdom 30 is a follow-up.
- `license: GPL-3.0-only`.
- Deploy to GitHub Pages through Actions at `z-cran.github.io/video-keypress/`. The account was renamed from `zacran`, and the old site is gone because there is no `gh-pages` branch.

## Stack (resolved with `npm view` on 2026-10-20)

**Runtime:**

- react / react-dom ^19.3.1
- @mui/material and @mui/icons-material ^9.5.0
- @emotion/react ^11.14.0, @emotion/styled ^11.14.1
- @fontsource/roboto ^5.3.0
- zustand ^5.0.15

**Dev:**

- vite ^8.3.4, @vitejs/plugin-react ^6.1.2
- typescript ~6.0.3, @types/react and @types/react-dom ^19.3.0, @types/node ^24
- vitest and @vitest/coverage-v8 5.0.5 (kept in lockstep), jsdom ^29.1.1
- @testing-library: react ^16.3.3, dom ^10.4.2, user-event ^14.6.8, jest-dom ^7.0.1
- eslint ^10.13, @eslint/js, typescript-eslint ^8.72, eslint-plugin-react-hooks ^7.1.1, eslint-plugin-react-refresh ^0.5.7, globals ^17
- prettier ^3.9.10, prettier-plugin-organize-imports ^4.3.0

**Removed:** every `@material-ui/*` and `@fortawesome/*` package, reactn, react-player, react-google-charts, react-gantt-timeline, react-color, react-sizeme, @use-it/event-listener, css-layout, fontsource-roboto, node-fetch, postcss, web-vitals, gh-pages and react-scripts.

**Scripts:**

- `dev`, `build` (`tsc -b && vite build`), `preview`
- `lint`, `typecheck`, `format`, `format:check`
- `test`, `test:watch`, `coverage`
- `check`: format:check, then lint, typecheck and test
- `prepare`: `git config core.hooksPath .githooks || true`

**Config:**

- **`vite.config.ts`:** `base: '/video-keypress/'`, `define: { __APP_VERSION__ }`, and Vitest set to jsdom with `src/test/setup.ts`, `restoreMocks` and explicit imports (no globals).
- **ESLint:** flat config with `recommendedTypeChecked`, mainly for `no-floating-promises` since `video.play()` returns a promise, plus react-hooks 7 (includes the compiler rules) and react-refresh. `no-restricted-imports` bans the barrel imports of `@mui/material` and `@mui/icons-material`.
- **`.prettierrc`:** the remoteiq settings minus the two trivago-only keys.

**MUI 9 rules for AGENTS.md** (agents trained on older MUI get these wrong):

- `Grid size={{xs, md}}`; there is no `item`.
- No system props; use `sx`.
- `slots`/`slotProps` instead of the old prop names.
- Use `*Outlined` icons; the `*Outline` exports are gone.
- ButtonBase Enter/Space now produce a bubbling `click`.

## Domain model and recording rules

The data shapes and the full v2 export schema go in `.ai-context/DATA-MODEL.md`. The rules go in DECISIONS.md.

**Types:**

- `Behavior { id, name, color, hotkey: {code,label} | null, mode: 'hold'|'toggle' }`. Order is the array position. Names must be unique (trimmed, case-insensitive). Default colors come from the Okabe-Ito colorblind-safe palette.
- `Episode { id, behaviorId, start, end }`. Times are in seconds, rounded to ms when captured.
- `ActiveEpisode { behaviorId, start, holders }`. A holder is `'key'` or `` `pointer:${id}` ``. A hold commits when the last holder lets go, which covers key and mouse at once and multi-touch. Active episodes are never persisted.
- `Session { version: 2, fingerprint, video {fileName,size,lastModified,duration}, createdAt, updatedAt, behaviors: snapshot[], episodes }`. The snapshot keeps a timeline lane when a behavior is renamed or deleted.

**Timing:**

- **Time source:** `video.currentTime`, read at the moment the key or pointer event fires, through `playerStore.getTime()`.
- **Hold needs a playing video.** If it's paused, show a gentle hint once ("Press play first, or switch this behavior to toggle mode"). Toggle works while paused or frame stepping.
- **Seeking during an episode** closes it with start = min and end = max. It never splits the episode. That lets someone "toggle on, scrub back to the onset, toggle off".
- **Zero-length episodes** are kept as point events and drawn with a minimum width.
- **Overlaps:**
  - Different behaviors may overlap.
  - Same-behavior overlap only happens through seek-back or import. The total is a plain sum, as before, and overlaps are flagged in the episode list.
- **Switching videos** commits active episodes. A reload discards them.

**Keyboard** (one window listener, capture phase, in `useGlobalKeys`):

- Match on `event.code`, so Shift changing `1` into `!` doesn't break the keyup.
- **Allowed hotkeys:** A–Z, 0–9 and Numpad 0–9.
- **Reserved player keys:**

  | Key             | Action                            |
  | --------------- | --------------------------------- |
  | Space           | play/pause                        |
  | ←/→             | ±5s                               |
  | Shift+←/→       | ±1s                               |
  | `,` / `.`       | frame step (≈1/30s, pauses first) |
  | Shift+`,` / `.` | speed −/+ 0.25                    |

  For reserved keys, call preventDefault and stopPropagation on both keydown and keyup. Otherwise a focused button would also click.

- **Ignore:**
  - `repeat`, IME composition, `Process` and `Dead` keys.
  - Ctrl, Meta and Alt combinations.
  - Editable targets.
  - Anything inside `[role=dialog|menu|listbox]`.
- **Release all key holds** on window `blur`, on `visibilitychange` to hidden, on Meta keydown (macOS drops other keyups while Cmd is held), and when a dialog or menu opens.

**Pointer** (trigger buttons):

- Hold: `pointerdown` with `setPointerCapture`. End on `pointerup`, `pointercancel` and `lostpointercapture`. Primary button only. Set `touch-action: none` and suppress `contextmenu`.
- Toggle: `onClick`.

**Files:**

- Drag-and-drop or the file picker (`accept="video/*"`). Validate through the `loadedmetadata` and `error` events, not the file extension.
- Prevent default on window-level `dragover`/`drop`, so a drop that misses the zone doesn't navigate away.
- Reset `input.value` after each pick so the same file can be chosen again.
- Revoke object URLs.
- Handle `duration === Infinity` (WebM from MediaRecorder) by seeking to the end to discover the real duration.
- `play()` rejection shows a snackbar.

**Storage** (namespaced, because every z-cran Pages project shares the `z-cran.github.io` origin):

- **Keys:**
  - `video-keypress:behaviors`: zustand persist, with a one-time migration from the legacy `keybinds` key.
  - `video-keypress:prefs`: rate and muted.
  - `video-keypress:session:<fp>`, plus a `video-keypress:sessions` index.
- **Autosave:** write-through on each change, no debounce.
- **Fingerprint:** `name|size|lastModified`. The restore prompt also requires the saved duration to be within 0.5s.
- **Restore prompt:** "Continue where you left off" or "Start over". Start over asks for confirmation.
- **Quota exceeded:** evict the oldest other sessions and retry. If it still fails, show a persistent notice to export and arm a `beforeunload` guard.

**Import and export:**

- **Export:**
  - JSON v2 is backward compatible. Events keep the v1 field names `id, key, behavior, order, start, end`, adding `behaviorId` and `duration`. The file also carries `version`, `behaviors` and extra metadata.
  - Episodes CSV and summary CSV: UTF-8 BOM, CRLF, RFC 4180 quoting, and a guard against formula injection.
  - Timeline SVG, built from the data rather than the DOM.
- **Import:**
  - Accepts v1 and v2 JSON.
  - Shows a gentle error for bad JSON, the wrong shape, non-finite or negative times, or files over 10MB. Swapped start/end is fixed.
  - Behaviors in v1 files are matched by name.
  - With no video loaded: read-only view (tally, timeline and export work).
  - With a video loaded: attach the data, with a warning if the filename differs. If episodes already exist, ask whether to Replace or Add.
- **v1 caveat:** v1 exports contain timeline display nudges, because the old Chart.js changed the stored times. This goes in DATA-MODEL.md, and the new timeline applies minimum widths only when drawing.

## `src/` layout

Pure `.ts` modules have no React or MUI imports and take their clock and id generator as arguments. Each sits beside the feature it serves and has a sibling `*.test.ts`.

```
main.tsx, App.tsx, theme.ts (primary #469FAE), vite-env.d.ts
components/   AppHeader, AppFooter, ConfirmDialog, ShortcutsDialog
lib/          time.ts* (roundMs, clamp, formatClock, formatDuration), download.ts
features/player/     playback.ts* (RATES 0.25..2, stepRate, seekBy, FRAME_STEP), playerStore.ts,
                     VideoDropZone, VideoPlayer, PlayerControls, SpeedControl
features/behaviors/  hotkeys.ts* (RESERVED_CODES, isAllowedHotkey, resolveKey(KeyLike, behaviors)),
                     behaviors.ts* (defaults, validate, add/update/remove/move, migrateLegacyKeybinds),
                     behaviorsStore.ts (persist), BehaviorSettingsDialog, BehaviorEditor, HotkeyField
features/recording/  recorder.ts* (canStart, press, release, releaseWhere, close), tally.ts* (summarize, findOverlaps),
                     sessionStore.ts, useGlobalKeys.ts, TriggerPad, TriggerButton, TallyTable
features/timeline/   timelineScale.ts* (makeScale, niceTicks, layoutLanes, hitTest), timelineSvg.ts*,
                     Timeline, EpisodeList
features/session/    sessionFormat.ts* (toJsonV2, parseSessionFile v1/v2, toEpisodesCsv, toSummaryCsv),
                     savedSessions.ts* (createSessionRepo(storage, now)), useAutosave.ts,
                     RestoreSessionDialog, ExportMenu, useImportSession.ts
test/         setup.ts, fakeMedia.ts
```

(`*` marks the pure modules that get tests.)

**UI layout.** With no video loaded, the empty state is a drop zone. Once a video is loaded:

- On md and wider, the player and its controls take the left 8 columns, and the trigger pad and tally the right 4.
- Below them, the full-width timeline, then the episode list in an Accordion.
- The header holds the file chip, Open video, Import, Export menu, Behaviors (settings) and Shortcuts.
- The footer says "Everything stays in your browser." and shows the version, GPL and the GitHub link.

**Feature details:**

- **SpeedControl:** − / value / + buttons in 0.25 steps, clamped to 0.25–2.0, disabled at the ends. Shift+`,`/`.` also change it. The rate persists in prefs.
- **TriggerButton:** shows the behavior color, name and hotkey chip, plus live **count, total and elapsed time while active**, with `aria-pressed`. TallyTable shows count, total, mean and % of video per behavior.
- **Timeline:**
  - Layout: a sticky HTML label column next to a horizontally scrolling SVG with one lane per behavior. Width is measured with ResizeObserver, and there are zoom −/+/fit controls.
  - Playhead: driven by requestVideoFrameCallback, falling back to rAF, and written straight to a ref so the bars don't re-render.
  - Clicks: clicking the background seeks, and dragging scrubs. Clicking a bar (moved 3px or less) selects it and seeks to its start. Hit-testing uses a ~6px tolerance.
  - Selection: details and Delete, with an undo snackbar.
  - Active episodes grow on screen in real time.
  - Auto-follow pauses when the user scrolls.

## AI scaffolding (adapted from remoteiq-frontend)

**Source of truth and copies:**

- `AGENTS.md` is the source of truth, about 2k tokens. Sections:
  - Overview, stack (with the MUI 9 rules), structure and commands.
  - Conventions:
    - Pure modules (the ADR-014 analogue).
    - Leaf MUI imports and `sx`.
    - Zustand selectors return primitives or use `useShallow`.
    - Never read refs or the clock during render.
    - Gentle UI copy with no em dashes.
  - The 12 testing principles.
  - Planning convention.
  - Exploration outputs.
  - AI context.
  - Git commits: **zero AI attribution**, subject under 72 characters.
- `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` are identical copies.

**Git hooks:**

- `.githooks/pre-commit` syncs AGENTS.md into the copies.
- `.githooks/commit-msg` rejects AI attribution. It is adapted from remoteiq's.
- Both get chmod +x. The `prepare` script turns them on.

**`.ai-context/`:**

- `README.md`, `index.md`, `SUMMARY.md` (architecture)
- `PATTERNS.md`
- `DECISIONS.md`, with these ADRs:
  - The 3-layer-lite setup.
  - Zero attribution.
  - Vite / React 19 / TS 6 (revisit TS 7 later).
  - MUI 9.
  - Zustand.
  - Native video.
  - SVG timeline.
  - Pure modules.
  - Hotkeys by code, with reserved keys.
  - The recording rules.
  - Autosave and the storage namespace.
  - Export v2 compatibility.
  - Pages via Actions.
- `TESTING-PRINCIPLES.md` (the generic 12, with DO/DON'T)
- `DATA-MODEL.md` (replaces API-MAP)
- `EXPLORATIONS/README.md` (template), `EXPLORATIONS/index.md`
- `EXPLORATIONS/2026-10-20-legacy-v1-audit.md`, recording what the v1 app did and its bugs, such as the timestamp imprecision and the export mutation.

Not copied: STRATEGY.md (an internal CopilotIQ doc), manifest and log (only used by central automation), and code-review-graph.

**Planning:**

- `planning/v2-rebuild.md` is a frozen copy of this plan.
- `planning/progress.md` tracks Work Units with checkboxes.

**`.claude/`:**

- `settings.json`:
  - Allows `npm run lint|typecheck|test|build|check|format` and `npx vitest *`.
  - A PostToolUse hook on Edit|Write runs `.claude/hooks/lint-edited-file.sh`. The script runs prettier and eslint on the edited `src/**/*.{ts,tsx}` file and reports remaining errors back. It always exits 0, following the pattern of remoteiq's evaluate hook.
- `.claude/skills/write-tests/SKILL.md` is adapted:
  - Vitest and RTL, with the media stubs from `test/fakeMedia.ts`.
  - Set `video.currentTime` between key events rather than using timers.
  - No `waitFor` around synchronous asserts.
  - Node environment for pure tests.
  - The 12-principle checklist.
  - No MSW (there is no network) and no evaluator.

**Other files:**

- `README-AI.md`: one-time `git config core.hooksPath .githooks`, then the day-to-day workflow.
- `.github/PULL_REQUEST_TEMPLATE.md`, kept light.
- `.gitignore`: add `dist`, `coverage`, `.eslintcache`, plus remoteiq's AI-tool ignores.

## Work units (branch `v2-rebuild`; each WU ends with `npm run check && npm run build` green)

I'll commit at each WU boundary using plain human-style messages with no AI trailer, as the new commit-msg hook requires. Nothing is pushed.

1. **WU1: Toolchain.**
   - Remove the CRA files: `src/*.js|css`, the CRA logos and manifest, and the tracked `.eslintcache`.
   - Add the root `index.html` and the configs: Vite, TS project refs, ESLint, Prettier, Vitest, `.nvmrc`.
   - `package.json`: v2.0.0, `type: module`, engines, repository and license; drop `homepage`. Regenerate the lockfile.
   - A minimal MUI shell with a smoke test.
2. **WU2: AI scaffolding** (everything in the section above).
3. **WU3: CI and Pages.**
   - One `.github/workflows/ci.yml`:
     - `verify` job on push and PR.
     - `deploy` job only on pushes to main, after `verify`, using configure-pages, upload-pages-artifact and deploy-pages.
   - Fix the URLs in the README to point at z-cran.
4. **WU4: Domain core.** `time`, `playback`, `hotkeys`, `behaviors`, `recorder` and `tally`, each with tests. No UI.
5. **WU5: Player.** playerStore, drop zone, player, controls, SpeedControl and the player branch of `useGlobalKeys`.
6. **WU6: Behavior settings.** The persisted store with the legacy migration, the dialog, the editor and HotkeyField.
7. **WU7: Recording UI.** sessionStore, the hotkey branch, TriggerPad and TriggerButton, TallyTable and the paused-hold hint.
8. **WU8: Timeline.** timelineScale, Timeline and EpisodeList, with select, delete and undo, and seek on click.
9. **WU9: Persistence.** savedSessions, useAutosave, the restore dialog and the quota notice.
10. **WU10: Import and export.** sessionFormat, timelineSvg, ExportMenu, the import flow and the read-only view.
11. **WU11: Polish.**
    - ShortcutsDialog, an a11y pass, and a copy pass.
    - README v2 covering the data format, the CSV columns and the v1 caveat.
    - Replace `TODO.md` with its open items.

## Tests

**Pure modules** (run in the node environment):

- `recorder`:
  - Hold start and commit.
  - Key plus pointer on one behavior commits once.
  - Toggle while paused.
  - Seek-back normalization.
  - Zero-length episodes kept.
  - `releaseWhere` affects key holds only.
  - `canStart` reasons.
- `hotkeys.resolveKey`:
  - Reserved keys take priority.
  - Ignore rules.
  - Shift+Digit1 still maps to Digit1.
  - Shift+Comma means speed.
  - Numpad and Digit stay distinct.
- `behaviors` validation and legacy migration, including null, malformed and duplicate input.
- `tally`: empty input, point events only, active elapsed time, duration 0/NaN/Infinity, `findOverlaps`.
- `playback`: clamping and snapping of off-grid rates.
- `time`: formatting edge cases.
- `timelineScale`: round-trip, tick spacing for a 5s and a 2h video, `hitTest` tolerance.
- `sessionFormat`:
  - v2 round-trip.
  - A real v1 file.
  - Malformed input gives a gentle message.
  - CSV quoting, BOM, CRLF and the formula guard.
- `savedSessions` with a fake Storage: quota eviction, then `'full'`, plus corrupt JSON.
- `timelineSvg`: parses with xmlns, one rect per episode, names escaped.

**RTL integration**, with `test/setup.ts` stubbing HTMLMediaElement `play`/`pause`/`paused`/`duration`/`readyState`, ResizeObserver, pointer capture and object URLs:

1. Hotkey hold from 2.0s to 3.5s: the tally shows 1 and 1.5s, the episode appears in the list and timeline, and the session is in localStorage.
2. Typing "1" in a text field records nothing.
3. Space while a trigger button has focus toggles playback once and records nothing.
4. Toggle while paused with 3 frame steps produces one episode.
5. Pointer hold, including pointercancel.
6. Window blur during a hold commits the episode.
7. SpeedControl steps and bounds, and `video.playbackRate` is set.
8. HotkeyField rejects Space and duplicates; a new key persists and records.
9. Timeline: clicking empty space seeks, clicking a bar selects and seeks, and delete can be undone.
10. The restore prompt for a matching fingerprint; continue and start over.
11. Importing a v1 file with no video shows the read-only tally.

## Verification

- `npm run check && npm run build` pass, and `npm run preview` serves the app under `/video-keypress/`.
- `run` skill / manual QA in Chrome on a real mp4:
  - Load by drag and by picker.
  - Step the speed from 0.25 to 2.0.
  - Hold `1` while playing and confirm the bar grows live and the tally updates.
  - Toggle a behavior while paused and frame stepping.
  - Hold with the mouse on a trigger button.
  - Click the timeline and a bar to confirm seeking.
  - Delete and undo.
  - Refresh and restore.
  - Export JSON, CSV and SVG, then re-import the JSON.
  - Change hotkeys and confirm they persist across a reload.
- Also check in Firefox and Safari: Cmd held during a hold, and a WebM with Infinity duration.
- Hooks: a commit with `Co-Authored-By: Claude` is rejected, and editing AGENTS.md and committing updates the 3 copies.
- CI goes green on the first push. You need to set **Settings → Pages → Source = GitHub Actions** once by hand.

## Follow-ups (out of scope)

- Node 24 with jsdom 30.
- TS 7 once typescript-eslint supports it.
- A reaction-time offset setting.
- Interval and bucket summaries (from TODO.md).
- Merging autorepeat on Linux.
- IndexedDB if sessions outgrow localStorage.
