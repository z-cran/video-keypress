# Progress

Track implementation as Work Units. Each Work Unit maps to a plan in `planning/`. Newest work first.

## iPad video stall: 2026-11-26

Plan: `planning/ipad-video-stall.md`. Approved 2026-11-26. Branch `video-freezing`.

Deviations from the plan:

- The pure module is `mediaReport.ts` (not `mediaDiagnostics.ts`), so it does not differ from `MediaDiagnostics.tsx` only by case on macOS.
- The storage wrapper is `skipUnchangedWrites` (not `dedupeStorage`). It compares with the stored value, not a cache, so it cannot go stale.
- The report includes `navigator.maxTouchPoints`, because iPad Safari sends a Mac user agent.

- [x] WU1: Media diagnostics (`?debug=media`) and the bare media check page (`?mediacheck`). Checked in the iPadOS 18.4 simulator.
- [x] WU2: Stop rewriting unchanged player prefs to localStorage on every player update. Simulator harness: 0 writes during playback (was about 14 a second).
- [ ] WU3: Reporters run the on-device protocol on an iPad with a Photos video; attach both reports.
- [ ] WU4: Write the fix plan from the reports.

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
