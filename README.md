# Video Keypress

Score animal behavior in a video from your computer. Load a video (for example, mice in a cage), hold a key or a button while a behavior happens (for example, scratching), and Video Keypress records when each episode started and how long it lasted. Review the episodes on a timeline, jump to any of them, and export the results.

**Open the app:** https://z-cran.github.io/video-keypress/

Everything runs in your browser. Videos and scores are never uploaded.

## Using it

1. **Open a video.** Drop it on the page or choose it. MP4 (H.264) and WebM play in every modern browser. HEVC and QuickTime depend on the browser and operating system.
2. **Set up behaviors.** Use **Behaviors** to name them, pick colors and bind keys (letters and numbers). Each behavior is either:
   - **Hold** (default): the episode lasts while the key or trigger button is held down. The video must be playing.
   - **Toggle**: press once to start, press again to stop. Works while paused, so you can step frame by frame between the start and the stop.
3. **Score.** Hold a hotkey, or press and hold a trigger button, while the behavior happens. Each trigger shows its count and total time, and counts up while recording.
4. **Review.** The timeline shows one lane per behavior. Click anywhere to jump there; click an episode to select it, jump to its start or delete it (with undo). The episode list has the same actions from the keyboard.
5. **Export.** JSON (everything, for importing later), episodes CSV, summary CSV, or the timeline as an SVG image.

Your work is saved in the browser as you go. Reopen the same video file and the app offers to continue where you left off. Browser storage can be cleared, so export when you finish.

### Keyboard shortcuts

| Keys                  | Action                                              |
| --------------------- | --------------------------------------------------- |
| Space                 | Play or pause                                       |
| Left / Right          | Back or forward 5 seconds                           |
| Shift + Left / Right  | Back or forward 1 second                            |
| , / .                 | Previous or next frame (about 1/30 s; pauses first) |
| Shift + , / Shift + . | Slower or faster, in 0.25x steps from 0.25x to 2x   |
| Your behavior keys    | Record that behavior                                |

Shortcuts are ignored while typing in a field or using a dialog.

## Data formats

Times are seconds from the start of the video, to the millisecond.

### JSON

```json
{
  "version": 2,
  "app": "video-keypress 2.0.0",
  "metadata": {
    "fileName": "mouse-03.mp4",
    "duration": 312.48,
    "scoringDate": 1760900000000,
    "scoringDateText": "2025-10-19T18:53:20.000Z"
  },
  "behaviors": [
    {
      "id": "…",
      "name": "Scratching",
      "color": "#0072B2",
      "key": "1",
      "code": "Digit1",
      "mode": "hold",
      "order": 1
    }
  ],
  "events": [
    {
      "id": 0,
      "behaviorId": "…",
      "behavior": "Scratching",
      "key": "1",
      "order": 1,
      "start": 12.345,
      "end": 13.9,
      "duration": 1.555
    }
  ]
}
```

- `events` are sorted by `start`; `id` is the position in that order and `order` is the behavior's lane (from 1).
- The `metadata` and `events` fields match version 1 files, so scripts written for v1 keep working. Version 1 files can also be imported.
- Version 1 adjusted some times by about 0.01 s to draw its timeline and saved those adjusted times. Version 2 saves exactly what was recorded.

### CSV

UTF-8 with a byte order mark (Excel shows names correctly), CRLF line endings.

- **Episodes:** `episode,behavior,key,start_s,end_s,duration_s`
- **Summary:** `behavior,key,count,total_s,mean_s,percent_of_video`

Overlapping episodes of the same behavior (possible after seeking back while recording) count separately in the totals and are flagged in the episode list.

## Development

Requires Node 22 (see `.nvmrc`).

```bash
npm install        # also enables the git hooks in .githooks/
npm run dev        # http://localhost:5173/video-keypress/
npm run check      # format, lint, typecheck, tests
npm run build      # production build in dist/
```

Built with React 19, TypeScript, Vite, MUI 9 and Zustand; tests use Vitest and Testing Library. Pushes to `main` are checked and deployed to GitHub Pages by `.github/workflows/ci.yml`.

Working with an AI coding agent? Start with [`AGENTS.md`](AGENTS.md) and [`README-AI.md`](README-AI.md).

## License

[GPL-3.0](LICENSE)
