# iPad video stall: what is ruled out, and how to find the cause

**Date:** 2026-11-26
**Session:** Claude Code, about 2 hours, with headless Chrome and the iPadOS 18.4 simulator
**Status:** active

## Summary

v2 stalls on iPad (Safari and Chrome, both WebKit) 4 to 8 seconds into large Photos videos. The app's own code does not stop the video, and the stall does not reproduce in desktop Chrome or the iPadOS simulator, so the trigger is something only a real iPad has. Diagnostics (`?debug=media`, `?mediacheck`) now let reporters capture it.

## Context / Question

Researchers reported that the video "freezes" after 4 to 8 seconds. It first sounded like every browser and device, but the reporters confirmed it is iPad only, in Safari and Chrome. Details from the reporters:

- The picture and the clock both stop, and the button still shows Pause. So the element is waiting for data; this is not a decode or compositing glitch.
- They use the v2 build.
- The videos come from the Photos library and are long or large.

## Investigation

**Code review.** Read every file that touches the player: `VideoPlayer.tsx`, `playerStore.ts`, `PlayerControls.tsx`, `Timeline.tsx`, `EpisodeList.tsx`, `sessionStore.ts`, `useAutosave.ts`, `restoreSession.ts`, `useGlobalKeys.ts`, `App.tsx`.

- Nothing pauses, seeks, reloads or remounts the `<video>` during playback.
- The only seeks are user actions, plus the Infinity-duration fix for MediaRecorder files.
- MUI 9's Slider calls `onChange` only on pointer or key input (checked in `useSlider.js`).

**Headless Chrome (desktop).** Production build, real file input driven over CDP, `currentTime` setter and `pause()` wrapped on the element.

- Over 12 s: no programmatic seeks or pauses, no `waiting` or `stalled`, no long tasks, steady 30 fps.

**iPadOS 18.4 simulator, iPad Air 11-inch.** A harness page loaded the build, handed the app a `File` through its real file input with `DataTransfer`, pressed Play muted, and posted samples to a local log.

- The app played a 12 MB clip and a 1.4 GB, one-hour MP4 without stalling. Screenshots showed the picture advancing.
- A bare `<video>` page did the same.
- Limits of the harness: the `File` was memory-backed, built from a fetched blob, not the file-backed temporary copy the Photos picker hands over. Playback was muted, there was no touch, and the simulator does not enforce iPad memory limits.

**Known WebKit bugs checked.** None match.

- Bug 228683: a picked file's temporary copy was deleted after 60 s. Fixed in 2021, and the timing is wrong.
- Bugs 232076, 232195 and 238170: blob URL Range header problems on iOS 15. Fixed in 2021 and 2022.

**Side finding (fixed).** The persisted player store rewrote `video-keypress:prefs` to localStorage about 14 times a second during playback. zustand `persist` writes on every `set()`, including the 10 Hz `currentTime` tick. `skipUnchangedWrites` now limits it to real changes, and the simulator harness shows 0 writes while playing.

## Conclusion

The stall needs something only a real iPad provides. Candidates, most likely first:

1. The file-backed (often HEVC, sometimes transcoded) temporary copy from the Photos picker, as read through WebKit's blob loading for AVFoundation.
2. Device memory limits with large files.
3. Sound on, or touch input.

On iPadOS, a `blob:` URL's bytes reach AVFoundation through WebKit's resource loader. If those requests stop, playback stops at the end of the first buffered stretch, which is a few seconds and matches the reports.

## Follow-ups

- Reporters run the protocol in `planning/ipad-video-stall.md` on a real iPad with a Photos video. Capture a report from `?debug=media` in the app, then one from `?mediacheck` with the same file.
- Both pages stall: WebKit cannot stream that file from a blob URL. The leading fix is a service worker that answers range requests from `file.slice()` (needs HTTPS). The fallback is `video.srcObject = file`.
- Only the app stalls: bisect the app's file input lifecycle (it clears the value and unmounts with the drop zone) and its main-thread work.
- The simulator harness (`harness.js`, `serve.mjs`, `control.html`) was in a session scratchpad and is not kept. Rebuild it from this description if needed.
