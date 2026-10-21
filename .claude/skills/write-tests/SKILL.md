---
name: write-tests
description: Write or change unit and component tests (Vitest, Testing Library) for video-keypress so they follow the 12 testing principles and stay fast and deterministic. Use when you create or edit a *.test.ts or *.test.tsx file, add a pure module, or review test quality.
---

# Write tests

Write tests that follow the 12 testing principles in `AGENTS.md`. Full DO and DON'T examples: `.ai-context/TESTING-PRINCIPLES.md`.

## Where tests go

- A pure module `foo.ts` gets `foo.test.ts` beside it. Most bugs are caught here: recorder, tally, hotkeys, behaviors, playback, timeline scale, session formats, saved sessions.
- A component gets `Foo.test.tsx` beside it only when the behavior needs the DOM: key and pointer handling, dialogs, the timeline click path, the restore and import flows.
- Prefer one integration test through `App` over many shallow component tests when the behavior crosses stores (record a hold, then check the tally, list and storage).

## Pure module tests

1. Put `// @vitest-environment node` on line 1 when the test does not touch the DOM. It starts faster.
2. Import from `vitest` explicitly: `import { describe, expect, it } from "vitest";` (globals are off).
3. Pass time and ids in. Modules take `now`, `t` or an id factory; tests pass literals:

   ```ts
   const ids = (() => {
     let n = 0;
     return () => `e${++n}`;
   })();
   const { state, committed } = press(empty, hold("b1"), "key", 2, ids);
   ```

4. Cover the edges the module promises to handle: `NaN`, `Infinity`, negative and zero times, empty lists, duplicate names, malformed JSON. Use `it.each` for variations of one boundary.

## Component and integration tests

jsdom cannot play media. `src/test/setup.ts` patches `HTMLMediaElement.prototype` so `play()` and `pause()` flip `paused` and fire events, and `duration` and `readyState` are settable. Helpers in `src/test/fakeMedia.ts`:

- `loadMetadata(video, { duration })` fires `loadedmetadata`, `durationchange` and `canplay`.
- `setTime(video, t)` sets `currentTime` and fires `timeupdate`.
- `failToLoad(video, code)` sets `error` and fires `error`.

Helpers in `src/test/renderApp.tsx`:

- `renderAppWithVideo({ duration, name, size, lastModified })` renders `<Root />` (the app with its theme), uploads a fake file through "Choose a video" and loads its metadata. It returns `{ user, video, file }`.
- `videoFile({ name, size, lastModified })` builds a `File` for `user.upload`.

Recording reads `video.currentTime` at the event, so a test sets the time between key events. No timers needed. The default behaviors are Scratching (1), Grooming (2) and Rearing (3):

```tsx
const { user, video } = await renderAppWithVideo({ duration: 60 });
await user.click(screen.getByRole("button", { name: "Play" }));
setTime(video, 2);
await user.keyboard("[Digit1>]");
setTime(video, 3.5);
await user.keyboard("[/Digit1]");
const row = screen.getByTestId("tally-Scratching");
expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("1");
```

Lessons from this codebase:

- **Name physical keys.** `user.keyboard(".")` does not produce `code: "Period"`; write `[Period]`, `[Space]`, `[Digit1>]` (hold) and `[/Digit1]` (release).
- **A dialog behind a closing dialog** stays hidden from queries during the exit transition. Use `await screen.findByRole("dialog", ...)` for it.
- **Simulate a reload** for autosave tests with `cleanup()`, `resetStores()` from `src/test/resetStores.ts` (keep `localStorage`), then `await useBehaviorsStore.persist.rehydrate()`. See `src/features/session/autosave.test.tsx`.
- **Capture downloads** by spying on `URL.createObjectURL` (keep the `Blob`) and `HTMLAnchorElement.prototype.click` (read `this.download`). See `importExport.test.tsx`. `Blob.text()` strips a leading BOM; decode with `new TextDecoder("utf-8", { ignoreBOM: true })` to check it.
- **Prove the test can fail.** For a guard such as "Space on a focused button toggles once", break the guard locally and watch the test fail before trusting it.

Rules:

1. **No `waitFor` around synchronous asserts.** `user.*` calls finish their state updates before they resolve. Use one `await screen.findBy...` for things that appear later.
2. **No sleeps.** Never `await new Promise((r) => setTimeout(r, n))`. If code under test uses timers, use `vi.useFakeTimers()` in that test and `vi.advanceTimersByTime(ms)`.
3. **Query by role and name** (`getByRole("button", { name: "Play" })`). Use `data-testid` only for values with no accessible name, such as tally numbers.
4. **Stores reset between tests.** `setup.ts` clears `localStorage` and calls `resetStores()`, so a test never sees another test's episodes. Add any new store to `src/test/resetStores.ts`.
5. **An act warning is a bug** in the test: an update you did not wait for. Await the end state.
6. **Assert the post-condition.** After a recording, check what the user sees (tally, list) and what was saved (`localStorage`), not that a function ran.

## Check before you finish

```bash
npx vitest run src/path/to/file.test.ts   # the files you changed
npm run check                              # format, lint, typecheck, all tests
```

Then read each new test against the 12 principles. AI-written tests need human review before commit.
