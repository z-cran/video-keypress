# Legacy v1 app audit: how it recorded, and the bugs v2 fixes

**Date:** 2026-10-20
**Session:** Claude Code, codebase survey before the v2 rebuild, ~1 hour
**Status:** active

## Summary

v1 (versions 1.0.0 to 1.0.11, 2021 to 2022) was a Create React App on React 17 and MUI 4. Its timestamps could be off by up to a second, and its exported JSON contains display adjustments. v2 reads the video clock directly and still imports v1 files.

## Context / Question

Before replacing the app, record what v1 did so v2 keeps its data compatible and does not repeat its bugs. The v1 source is in git history up to commit `85cef69` (`src/App.js`, `src/Chart.js`).

## Investigation

**Structure.** `App.js` (822 lines) held almost everything: upload, player, keybinds, settings, export. `Chart.js` (400 lines) drew a Google Charts Timeline (loaded from Google's CDN at runtime) and a derived-stats DataGrid. State was one `reactn` global object, spread on every update.

**Recording.** Hold to record: keydown started an event, keyup ended it, and only while the video was playing. Keys matched `event.key`, case-sensitive and one character long.

**Bug: timestamps up to 1 s late.** Start and end came from `state.playedSeconds`, which react-player updates on `onProgress` (default every 1000 ms). A press between ticks got the previous tick's time. `Chart.js` carried workarounds for "key presses faster than the update cycle".

**Bug: exported data contains display nudges.** `Chart.js formatEvent` changed the stored event objects in place. It extended events shorter than 0.01 s and shifted start or end by about 0.01 s when two events of one behavior shared a time. Those changed values were then exported. Expect v1 files to contain near-duplicate times offset by about 0.01 s.

**Bug: Shift during a hold left the event open.** Matching on `event.key` meant `1` down, Shift down, `!` up never matched the keyup.

**Other findings.**

- Space play/pause was advertised in Settings but intentionally did nothing.
- Keybinds persisted to localStorage key `keybinds`, including the transient `active` flag. "Reset to defaults" could restore an already-changed array because the defaults were mutated.
- Importing JSON showed it read-only; there was no way to keep scoring.
- Speeds were limited to 0.5, 1, 1.5 and 2.
- Eleven dependencies were never imported. An attempted MUI 5 upgrade had been backed out.
- `homepage` pointed at `zacran.github.io`; the account is now `z-cran`, and there was no `gh-pages` branch, so the site was down.

**v1 file shape.**

```json
{
  "metadata": {
    "fileName": "x.mp4",
    "scoringDate": 1645400000000,
    "scoringDateText": "2022-02-21T00:00:00.000Z",
    "duration": 123.45
  },
  "events": [
    {
      "id": 0,
      "key": "1",
      "behavior": "Behavior1",
      "order": 1,
      "start": 1.234,
      "end": 4.037
    }
  ]
}
```

`id` is a sequential integer, `order` is the 1-based chart row, times are seconds with up to 3 decimals.

## Conclusion

v2 reads `video.currentTime` in the event handler, matches keys by `event.code`, never mutates stored episodes, and imports v1 files by mapping `behavior` names to behaviors. See `DATA-MODEL.md` and ADR-009 to ADR-012 in `DECISIONS.md`.

## Follow-ups

- The legacy `keybinds` localStorage key lives on the old `zacran.github.io` origin, so v2 at `z-cran.github.io` will rarely see it. The migration exists for local or forked deployments.
