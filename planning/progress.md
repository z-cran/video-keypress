# Progress

Track implementation as Work Units. Each Work Unit maps to a plan in `planning/`. Newest work first.

## v2 rebuild: 2026-10-20

Plan: `planning/v2-rebuild.md`. Approved 2026-10-20. Branch `v2-rebuild`.

Deviation from the plan: sessions carry a behavior snapshot, and loading a session re-adds missing behaviors, instead of keeping orphaned timeline lanes (ADR-014).

- [x] WU1: Toolchain. Vite 8, React 19, TS 6, MUI 9, ESLint 10, Prettier, Vitest 5 with jsdom 29. CRA files and unused dependencies removed.
- [x] WU2: AI scaffolding. AGENTS.md and copies, `.githooks/`, `.ai-context/`, `planning/`, `.claude/`, README-AI.md.
- [ ] WU3: CI and Pages workflow, README URLs.
- [ ] WU4: Domain core: `time`, `playback`, `hotkeys`, `behaviors`, `recorder`, `tally` with tests.
- [ ] WU5: Player: store, drop zone, video, controls, speed, player keys.
- [ ] WU6: Behavior settings: persisted store with legacy migration, dialog, editor, hotkey field.
- [ ] WU7: Recording UI: session store, hotkey recording, trigger pad, tally table.
- [ ] WU8: Timeline and episode list: seek, select, delete with undo.
- [ ] WU9: Autosave and restore.
- [ ] WU10: Import and export (JSON v1/v2, CSV, SVG), read-only view.
- [ ] WU11: Polish: shortcuts dialog, a11y and copy pass, README v2, TODO.md.
- [ ] Manual check in the browser with a real video.
