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
- `renderAppWithVideo({ duration })` renders `<App />`, uploads a fake file and loads its metadata. It returns `{ user, video }`.

Recording reads `video.currentTime` at the event, so a test sets the time between key events. No timers needed:

```tsx
const { user, video } = await renderAppWithVideo({ duration: 60 });
await user.click(screen.getByRole("button", { name: "Play" }));
setTime(video, 2);
await user.keyboard("[Digit1>]");
setTime(video, 3.5);
await user.keyboard("[/Digit1]");
expect(screen.getByTestId("tally-count-Behavior 1")).toHaveTextContent("1");
```

Rules:

1. **No `waitFor` around synchronous asserts.** `user.*` calls finish their state updates before they resolve. Use one `await screen.findBy...` for things that appear later.
2. **No sleeps.** Never `await new Promise((r) => setTimeout(r, n))`. If code under test uses timers, use `vi.useFakeTimers()` in that test and `vi.advanceTimersByTime(ms)`.
3. **Query by role and name** (`getByRole("button", { name: "Play" })`). Use `data-testid` only for values with no accessible name, such as tally numbers.
4. **Stores reset between tests.** `setup.ts` clears `localStorage` and resets every Zustand store, so a test never sees another test's episodes.
5. **An act warning is a bug** in the test: an update you did not wait for. Await the end state.
6. **Assert the post-condition.** After a recording, check what the user sees (tally, list) and what was saved (`localStorage`), not that a function ran.

## Check before you finish

```bash
npx vitest run src/path/to/file.test.ts   # the files you changed
npm run check                              # format, lint, typecheck, all tests
```

Then read each new test against the 12 principles. AI-written tests need human review before commit.
