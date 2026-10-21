# Architectural Decision Records

Newest decisions at the bottom. When a decision is reversed, add a new ADR and mark the old one `Superseded by ADR-NNN`.

## ADR-001: Lean context engineering

**Decision:** Use `AGENTS.md` as the single source of agent instructions (copied to `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` by `.githooks/pre-commit`), plus this `.ai-context/` wiki, `planning/` and one Claude skill. No code graph MCP and no wiki automation.

**Rationale:** Mirrors the remoteiq-frontend setup at a size that fits a ~30-file app. A structural graph adds tooling every contributor must install for little gain at this scale.

## ADR-002: Zero AI attribution

**Decision:** Commits and PR descriptions read as human-written. No `Co-Authored-By` AI trailers or "generated with" lines. `.githooks/commit-msg` rejects them.

**Rationale:** Same policy as remoteiq-frontend, chosen by the repo owner.

## ADR-003: Vite, React 19, TypeScript 6

**Decision:** Replace Create React App with Vite 8 and React 19. Pin TypeScript `~6.0`, with `erasableSyntaxOnly` (no enums or namespaces).

**Rationale:** CRA is unmaintained. TypeScript 7 (the native port) is out, but typescript-eslint 8 supports only TS below 6.1. `erasableSyntaxOnly` keeps the code ready for TS 7. Revisit when typescript-eslint supports it.

## ADR-004: MUI 9 with leaf imports and `sx`

**Decision:** MUI 9 with Emotion. Import leaf paths only (ESLint enforces). Style with `sx` or `styled`. No system props.

**Rationale:** v1 failed to move from MUI 4 to 5 because of JSS `makeStyles`. `sx` avoids that class of migration. Leaf imports keep test start-up fast.

## ADR-005: Zustand for state

**Decision:** Three small Zustand stores: `playerStore` (media state, prefs persisted), `behaviorsStore` (persisted), `sessionStore` (episodes, active recordings, selection).

**Rationale:** Event handlers need the latest state outside React render (`getState()`), which Zustand gives without context plumbing. `persist` handles localStorage with versioned migration. Redux Toolkit is heavier than this app needs.

## ADR-006: Native `<video>` instead of react-player

**Decision:** Use a plain `<video>` element with custom MUI controls.

**Rationale:** Only local files are played. react-player adds an abstraction whose progress callback caused v1's timing error, and hides `currentTime`, `playbackRate` and `requestVideoFrameCallback`.

## ADR-007: Custom SVG timeline instead of Google Charts

**Decision:** Draw the timeline as SVG from session data, with HTML lane labels.

**Rationale:** Google Charts loads code from Google's CDN at runtime (the app should work offline and send nothing anywhere), cannot seek on click, and its export depended on scraping its DOM. A custom SVG gives click-to-seek, a live playhead and a clean export.

## ADR-008: Pure modules with injected time and ids

**Decision:** Domain logic (`recorder`, `tally`, `hotkeys`, `behaviors`, `playback`, `timelineScale`, `sessionFormat`, `savedSessions`) lives in `.ts` modules with no React, MUI, store or DOM imports. Time, ids and `Storage` are passed in.

**Rationale:** These are the parts most likely to be wrong and the easiest to test thoroughly without rendering.

## ADR-009: Episode time comes from `video.currentTime`

**Decision:** Read `video.currentTime` inside the key or pointer handler and round to milliseconds.

**Rationale:** v1 used a 1 Hz progress tick, so times were up to a second late. Reading the element at event time is exact while paused and within about one frame while playing.

## ADR-010: Hotkeys match `event.code`; player keys are reserved

**Decision:** Behavior hotkeys are A to Z, 0 to 9 and Numpad 0 to 9, matched by `event.code`, ignoring Shift. Space, arrows, comma and period belong to the player and cannot be bound. Events with Ctrl, Meta or Alt, repeats, IME composition and events inside editable fields or dialogs are ignored. One capture-phase window listener handles all keys and stops reserved keys from also activating a focused button.

**Rationale:** Matching `event.key` broke when Shift changed the character between keydown and keyup (v1 bug). MUI 9 buttons turn Space into a bubbling click, so without the capture-phase stop, Space on a focused trigger would both click it and toggle playback.

## ADR-011: Recording rules

**Decision:**

- Each behavior is **hold** (default) or **toggle**, for both its hotkey and its trigger button.
- Hold needs a playing video; a paused press shows a hint. Toggle works while paused, so a researcher can step frames between start and stop.
- A hold ends when its last holder (the key or any pointer) releases.
- An episode stores `start = min`, `end = max` of its two times, so seeking back during an episode extends it instead of producing negative durations. Episodes are never split.
- Zero-length episodes are kept as point events.
- Key holds are released on window blur, on the tab being hidden, on Meta keydown and when a dialog opens.
- Active episodes are not persisted; a reload discards them.

**Rationale:** Keyups are lost in all of those focus cases, and macOS drops keyups while Cmd is held. Keeping min/max supports "toggle on, scrub back to the onset, toggle off".

## ADR-012: Export v2 stays readable by v1 tools

**Decision:** The v2 JSON export keeps v1's `metadata` and `events[].{id, key, behavior, order, start, end}` fields and adds `version`, `behaviors`, `behaviorId` and `duration`. Import accepts v1 and v2. CSV exports use a UTF-8 BOM, CRLF and formula-injection guarding.

**Rationale:** Researchers have v1 files and scripts that read them.

## ADR-013: Autosave per video, namespaced storage

**Decision:** Write the session to `localStorage` on every change, keyed by `name|size|lastModified` of the video. All keys start with `video-keypress:`. On quota errors, evict the oldest other sessions, then warn and guard unload.

**Rationale:** v1 lost everything on refresh. All of the account's `github.io` projects share one origin, so keys must be namespaced. Sessions are small (thousands of episodes are a few hundred kB), so write-through is simple and fast enough.

## ADR-014: Sessions carry a behavior snapshot

**Decision:** A saved or exported session includes the behaviors its episodes use. Loading a session (restore or import) adds any missing behaviors to the behaviors list, matched by id and then by name. Deleting a behavior deletes its episodes in the current session after a confirmation.

**Rationale:** Every episode then always points at a behavior in the list, so the tally, timeline and exports never need an "unknown behavior" path.

## ADR-015: GitHub Pages via Actions; Node 22

**Decision:** One workflow runs checks on every push and PR and deploys `dist/` to Pages on push to `main`. Node 22 (`.nvmrc`) with jsdom 29.

**Rationale:** v1 deployed by hand with `gh-pages` from a laptop. jsdom 30 needs Node 22.22.2 or 24; upgrade both together later.
