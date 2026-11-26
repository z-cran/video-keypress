# Patterns

Each pattern names the bug it prevents. Follow them in new code; change this page when a pattern changes.

## Pure modules beside the thing they serve

Logic that can be wrong in interesting ways (recording, stats, hotkeys, file formats, timeline math) lives in a camelCase `.ts` file next to its components, with a sibling `*.test.ts`. It imports nothing from React, MUI, the stores or the DOM. Clocks, id factories and `Storage` are arguments.

- Prevents: logic that can only be tested by rendering, and tests that depend on the wall clock.

## Read the media element in handlers, never in render

`usePlayerStore.getState().getTime()` reads `video.currentTime` at the moment of the event. Components display `currentTime` from the store (throttled), not from the element. The playhead writes its `transform` through a ref inside a frame callback.

- Prevents: v1's late timestamps, React Compiler lint errors (`react-hooks/refs`, `purity`) and re-rendering every bar 60 times a second.

## Play local videos through the worker, never one huge range

Load the picked file with `openVideoStream(file)` and keep the `release` it returns. Do not call `URL.createObjectURL` for a video. The service worker answers each `Range` request with at most `MAX_RANGE_BYTES`. When no worker controls the page, `openVideoStream` falls back to a blob URL by itself.

- Prevents: large videos stalling on iPad 4 to 8 seconds in. WebKit asks for the whole rest of the file in one request, and a `blob:` URL tries to fill it (ADR-017).

## Persisted stores that update often write only on change

zustand's `persist` writes to storage on every `set()`, even when the persisted fields did not change. A persisted store that also holds fast-moving state, as the player store holds `currentTime`, wraps its storage: `createJSONStorage(() => skipUnchangedWrites(localStorage))`. The wrapper compares the new value with what is stored, not with its own last write, so a reset or another tab cannot leave it stale.

- Prevents: rewriting the unchanged speed and mute prefs to localStorage about 14 times a second during playback, measured on iPadOS WebKit.

## Store selectors return primitives or stable references

```ts
const episodes = useSessionStore((s) => s.session?.episodes);   // stable reference
const count = useSessionStore((s) => s.session?.episodes.length ?? 0);
const tally = useMemo(() => summarize(episodes ?? [], ...), [episodes, ...]);
```

Never `useStore((s) => s.items.filter(...))`. Use `useShallow` when picking several fields.

- Prevents: Zustand 5's infinite render loop when a selector returns a new object each call.

## Never mutate stored data to fix the display

Minimum bar widths, label truncation and overlap styling happen when drawing. Stored and exported episodes are exactly what was recorded.

- Prevents: v1's exported times containing timeline nudges.

## One global key listener, capture phase

`useGlobalKeys` is the only window `keydown`/`keyup` listener. It runs in the capture phase, stops reserved player keys (`preventDefault` and `stopPropagation` on both keydown and keyup), and ignores events from editable fields and from inside `[role=dialog]`, `[role=menu]` and `[role=listbox]`.

- Prevents: Space both clicking a focused button and toggling playback, and typing a behavior name triggering recordings.

## Release holds whenever keyups can be lost

Window `blur`, `visibilitychange` to hidden, Meta keydown and opening a dialog all call `releaseKeyHolds()`.

- Prevents: an episode that never ends because its keyup went to another window or into a dialog.

## Handle every promise from the media element

`video.play()` can reject (autoplay policy, decode errors). Call it through the store's `play()`, which catches the rejection and shows a message.

- Prevents: unhandled promise rejections and a play button that silently does nothing.

## Gentle UI copy

State the situation and the next step: "This file did not load as a video. Try an MP4 or WebM file." No "Invalid", no "You must", no exclamation marks, no em dashes. Use `·` between side-by-side facts.

## Leaf MUI imports

`import Button from "@mui/material/Button"`, never `import { Button } from "@mui/material"`. ESLint enforces this.

- Prevents: slow test start-up from loading the whole library.

## Ask and tell through the shared stores

Use `confirmAction(...)` (yes or no) or `chooseAction(...)` (confirm, alternative or cancel) from `lib/confirmStore.ts` for questions, and `notify(...)` from `lib/noticeStore.ts` for snackbars, including an Undo action. One `ConfirmDialog` and one `Notices` component render them. Never use `window.confirm` or `alert`.

- Prevents: dialogs that block the event loop and break tests, and several snackbars fighting for the same spot.

## New work starts with autosave off

`sessionStore.start(session)` leaves `autosave` false; `offerRestore` turns it on after offering any saved session (ADR-016). Code that starts a session the researcher already chose to keep (attaching imported scores) passes `{ autosave: true }`.

- Prevents: an empty new session overwriting the saved one before the researcher is asked.
