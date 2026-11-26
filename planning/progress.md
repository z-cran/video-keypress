# Progress

Track implementation as Work Units. Each Work Unit maps to a plan in `planning/`. Newest work first.

## Large video playback: 2026-11-26

Plan: `planning/large-video-playback.md`. Approved 2026-11-26. Branch `large-video-playback`.

Deviations from the plan:

- `MAX_RANGE_BYTES` is 4 MiB, not 8 MiB. In the production build on the iPadOS simulator, with the 4 GB, 45 Mbps file, a seek to 10:00 took 0.5 s at 4 MiB and 8.6 s at 8 MiB (one run each). Playback stayed 5 to 8 s ahead at 4 MiB.

- [x] WU1: `videoStream.ts`: range planning, headers, URLs and messages, with Node tests.
- [x] WU2: `videoWorker.ts` and the `video-sw.js` build entry, with fake-scope tests.
- [x] WU3: Page side: registration, `openVideoStream`, player store, diagnostics source, media check choice.
- [x] WU4: Docs (ADR-017, SUMMARY, PATTERNS, AGENTS.md, README) and the simulator check of the production build. Fresh iPad simulator: the app registered the worker, played the 4 GB file from `__video/` with no stalls, and seeked to 10:00 in 0.5 s.
- [ ] WU5: The reporter confirms on a real iPad with `GX010969.mp4`.

## iPad video stall: 2026-11-26

Plan: `planning/ipad-video-stall.md`. Approved 2026-11-26. Branch `video-freezing`.

Deviations from the plan:

- The pure module is `mediaReport.ts` (not `mediaDiagnostics.ts`), so it does not differ from `MediaDiagnostics.tsx` only by case on macOS.
- The storage wrapper is `skipUnchangedWrites` (not `dedupeStorage`). It compares with the stored value, not a cache, so it cannot go stale.
- The report includes `navigator.maxTouchPoints`, because iPad Safari sends a Mac user agent.

- [x] WU1: Media diagnostics (`?debug=media`) and the bare media check page (`?mediacheck`). Checked in the iPadOS 18.4 simulator.
- [x] WU2: Stop rewriting unchanged player prefs to localStorage on every player update. Simulator harness: 0 writes during playback (was about 14 a second).
- [x] WU3: Reporters run the on-device protocol on an iPad with a Photos video; attach both reports. Both stalled on a 4.0 GB GoPro chapter (app at 0:07.3, bare player at 0:04.5): WebKit, not the app.
- [x] WU4: Write the fix plan from the reports: `planning/large-video-playback.md`.

## v2 rebuild: 2026-10-20

Plan: `planning/v2-rebuild.md`. Approved 2026-10-20. Branch `v2-rebuild`. One commit per Work Unit; not pushed.

Deviations from the plan:

- Sessions carry a behavior snapshot, and loading a session re-adds missing behaviors, instead of keeping orphaned timeline lanes (ADR-014). Deleting a behavior with episodes asks first and deletes them.
- Autosave starts off for a newly opened video and turns on after the restore offer (ADR-016), so the empty new session cannot overwrite the saved one.
- No separate `sessions` index key in localStorage; the repository scans keys with the session prefix.
- No PostToolUse evaluator; `.claude/hooks/lint-edited-file.sh` formats and lints edited source files instead.
- Added: a theme toggle (system, light, dark), a keyboard shortcuts dialog, and `Root.tsx` so tests render the real theme.

- [x] WU1: Toolchain. Vite 8, React 19, TS 6, MUI 9, ESLint 10, Prettier, Vitest 5 with jsdom 29. CRA files and unused dependencies removed.
- [x] WU2: AI scaffolding. AGENTS.md and copies, `.githooks/`, `.ai-context/`, `planning/`, `.claude/`, README-AI.md.
- [x] WU3: CI and Pages workflow, README URLs.
- [x] WU4: Domain core: `time`, `playback`, `hotkeys`, `behaviors`, `recorder`, `tally` with tests.
- [x] WU5: Player: store, drop zone, video, controls, speed, player keys.
- [x] WU6: Behavior settings: persisted store with legacy migration, dialog, hotkey field, color picker.
- [x] WU7: Recording UI: session store, hotkey recording, trigger pad, tally table, confirm on behavior removal.
- [x] WU8: Timeline and episode list: seek, scrub, select, delete with undo, overlap flags.
- [x] WU9: Autosave and restore, quota eviction and full-storage warning.
- [x] WU10: Import and export (JSON v1/v2, CSV, SVG), read-only view, attach to next video.
- [x] WU11: Polish: shortcuts dialog, theme toggle, copy pass, README v2, TODO.md, wiki updates.
- [x] Headless Chrome check with a generated H.264 video: load, play, hold 1, Space, Shift+., timeline click to seek, Behaviors dialog, dark mode, 390 px width. No console errors. Fixed tally wrapping and the phone timeline header.
- [ ] Manual check in Firefox and Safari, and on a touch screen (Cmd during a hold, WebM with unknown duration, holding a trigger by touch).
- [ ] Set GitHub Pages source to "GitHub Actions" before the first deploy from `main`.
