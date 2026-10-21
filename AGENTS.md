# AGENTS.md

This file guides AI agents (Claude Code, GitHub Copilot, Cursor, Gemini CLI, etc.) working in this repository. It is the single source of truth for agent instructions. The `.githooks/pre-commit` hook copies it to `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` on commit. Edit only `AGENTS.md`.

## Project Overview

- **Repo:** video-keypress
- **Purpose:** Single-page web app for behavioral research. A researcher loads a local video (for example, mice), presses hotkeys or holds on-screen trigger buttons while a behavior happens (for example, scratching), and gets episodes with start, end and duration. Episodes show as a live tally and a timeline; clicking the timeline seeks the video.
- **Privacy:** Everything runs in the browser. Videos and scores are never uploaded. There is no backend.
- **Languages:** TypeScript (all app code and tests).
- **Deploy:** GitHub Pages at `https://z-cran.github.io/video-keypress/` via `.github/workflows/ci.yml` on push to `main`.
- **Git hooks:** Committed in `.githooks/`. `npm install` enables them (`prepare` script); otherwise run `git config core.hooksPath .githooks`.

## Technology Stack

- **Runtime:** Node 22 (`.nvmrc`), npm.
- **App:** React 19, Vite 8, TypeScript 6 (`erasableSyntaxOnly`: no enums or namespaces), MUI 9 with Emotion, Zustand 5 for state.
- **Video:** native `<video>` with custom MUI controls. No player library.
- **Timeline:** custom SVG. No chart library.
- **Testing:** Vitest 5, Testing Library (react, user-event, jest-dom), jsdom.
- **Linting:** ESLint 10 flat config (typescript-eslint type-checked, react-hooks 7 with the React Compiler rules, react-refresh), Prettier with `prettier-plugin-organize-imports`.

### MUI 9 rules (older examples online are wrong)

- `Grid` takes `size={{ xs: 12, md: 8 }}`. There is no `item` prop.
- No system props on `Box`, `Typography` or `Stack` (`<Typography mt={2}>` is dead). Use `sx`.
- Use `slots` / `slotProps`, never `components`, `componentsProps`, `inputProps`, `InputProps`, `PaperProps` or `TransitionProps`.
- Icons ending in `Outline` were removed; use `Outlined`.
- Import leaf paths: `@mui/material/Button`, `@mui/icons-material/PlayArrow`. ESLint rejects the barrels.

## Project Structure

| Path                      | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `src/features/player/`    | Video element, controls, speed, player store                         |
| `src/features/behaviors/` | Behavior definitions, hotkey rules, settings dialog, persisted store |
| `src/features/recording/` | Recorder state machine, tally, global key handling, trigger pad      |
| `src/features/timeline/`  | Timeline scale math, SVG timeline, episode list                      |
| `src/features/session/`   | Import/export formats, autosave repository, restore flow             |
| `src/components/`         | App shell (header, footer, shared dialogs)                           |
| `src/lib/`                | Small pure helpers (time formatting, downloads)                      |
| `src/test/`               | Vitest setup and media element fakes                                 |
| `.ai-context/`            | Repo wiki for AI agents                                              |
| `planning/`               | Implementation plans and progress tracking                           |

## Common Commands

```bash
npm install            # also enables .githooks
npm run dev            # Vite dev server at http://localhost:5173/video-keypress/
npm run build          # tsc -b && vite build -> dist/
npm run preview        # serve dist/
npm run check          # format:check + lint + typecheck + test (run before every commit)
npm test               # vitest run
npx vitest run src/features/recording/recorder.test.ts   # one file
npm run format         # prettier --write .
```

## Coding Conventions

- **Pure modules beside the feature.** Domain logic lives in camelCase `.ts` files (`recorder.ts`, `tally.ts`, `hotkeys.ts`) with no React, MUI, store or DOM imports. Pass time, ids and storage in as arguments. Each has a sibling `*.test.ts`. Components and stores stay thin.
- **Time comes from the video.** Episode times are `video.currentTime` read inside the key or pointer handler (via `usePlayerStore.getState().getTime()`), rounded to ms with `roundMs`. Never use a progress tick or `Date.now()` for episode times.
- **Never mutate state.** Store actions return new objects. Never change a stored episode to make the timeline look right; adjust only when drawing.
- **Zustand selectors return primitives or stable references.** A selector that builds a new array or object each call loops forever. Use `useShallow` or derive with `useMemo`.
- **React Compiler lint rules are on.** Do not read refs, `video.currentTime` or `Date.now()` during render. Read them in handlers and effects.
- **Promises.** `video.play()` returns a promise. Handle it (`no-floating-promises` is an error).
- **Storage keys** are namespaced `video-keypress:*`. All `*.github.io` projects for this account share one origin.
- **UI copy** is gentle: state the situation and the next step. No "Invalid" or "You must", no exclamation marks, no em dashes. Use `·` between side-by-side facts.
- **Comments** explain why, and name the bug they prevent.
- **Tests:** follow the 12 testing principles below.

## Testing Principles (Mandatory)

1. **Behavioral, not structural:** assert what the user sees or what a function returns, not internal calls.
2. **Adversarial inputs required:** nulls, empty strings, NaN, Infinity, boundary values, malformed files.
3. **Negative paths must be proven:** every guard clause gets a test that violates it.
4. **Readable as documentation:** test names describe behavior.
5. **Self-contained (DAMP over DRY):** each test holds what it needs to be understood.
6. **Deterministic:** no wall clock, no random, no network, no order dependence. Inject `now` and id factories.
7. **Fast:** unit tests under 100ms. Pure modules run without rendering.
8. **One behavior per test:** parameterize variations with `it.each`.
9. **Meaningful assertions only:** every assertion answers "what bug would this catch?"
10. **Post-condition invariants:** after a state change, check the downstream state (tally, list, storage).
11. **Integration tests use real paths:** render real components and stores; fake only the media element.
12. **Coverage is a trailing indicator:** never write a test to move a number.

AI-generated tests must be reviewed against all 12 before committing. Full DO/DON'T in `.ai-context/TESTING-PRINCIPLES.md`. Test-writing guide: `.claude/skills/write-tests/SKILL.md`.

## Planning Convention

1. Save plans to `planning/<slug>.md` (or `planning/<TICKET-ID>.md`).
2. Plans are frozen snapshots. **Never overwrite an existing plan.** If scope changes, write a new plan and add `superseded_by:` to the old one.
3. Track implementation in `planning/progress.md` as Work Units with checkboxes.
4. Before implementing, check `planning/` for an existing plan and read it.
5. **Plans must be explicitly approved by the human before execution.**

## Exploration Outputs

When a session produces analysis worth keeping (an investigation over 15 minutes, a design comparison, a root cause, a surprising discovery), offer to save it to `.ai-context/EXPLORATIONS/YYYY-MM-DD-slug.md` and add it to `EXPLORATIONS/index.md`. Do not save code changes, plans or trivial answers there. Before investigating, check the index for a prior answer.

## AI Context

- `.ai-context/index.md` catalogs the wiki: `SUMMARY.md` (architecture), `PATTERNS.md`, `DATA-MODEL.md` (types, storage keys, export formats), `DECISIONS.md` (ADRs), `TESTING-PRINCIPLES.md`, `EXPLORATIONS/`.
- Read pages on demand. Update `SUMMARY.md`, `PATTERNS.md`, `DATA-MODEL.md` and `DECISIONS.md` in the same change that makes them stale.

## Git Commits and Pull Requests

**ZERO AI ATTRIBUTION: MANDATORY, NON-NEGOTIABLE.**

- Commit messages and PR descriptions must read as written by a human developer.
- Forbidden: "Co-Authored-By: Claude", "Generated with Claude Code", "AI-assisted", or any variation. `.githooks/commit-msg` rejects them.
- Describe the technical change, not how it was produced.
- Subject line: imperative, under 72 characters. Optional ticket or work-unit prefix (`[WU7] Add trigger pad`).
- Run `npm run check` before committing.
