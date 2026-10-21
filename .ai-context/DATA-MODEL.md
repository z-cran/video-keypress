# Data model

Types, storage keys and file formats. Times are seconds as numbers, rounded to milliseconds when captured.

## Core types

```ts
// src/features/behaviors/behaviors.ts
type TriggerMode = "hold" | "toggle";
interface Hotkey {
  code: string;
  label: string;
} // code: KeyboardEvent.code, e.g. "Digit1"
interface Behavior {
  id: string;
  name: string; // unique, trimmed, compared case-insensitively
  color: string; // hex
  hotkey: Hotkey | null;
  mode: TriggerMode;
}

// src/features/recording/recorder.ts
interface Episode {
  id: string;
  behaviorId: string;
  start: number;
  end: number;
} // start <= end
type Holder = "key" | `pointer:${number}`;
interface ActiveEpisode {
  behaviorId: string;
  start: number;
  holders: Holder[];
}
type Active = Record<string, ActiveEpisode>; // by behaviorId; at most one per behavior

// src/features/session/session.ts
interface VideoInfo {
  fileName: string;
  size: number;
  lastModified: number;
  duration: number;
}
interface Session {
  version: 2;
  fingerprint: string | null; // null for an import with no video loaded (read-only)
  video: VideoInfo;
  createdAt: number; // ms epoch
  updatedAt: number;
  behaviors: Behavior[]; // snapshot of behaviors used by episodes
  episodes: Episode[]; // sorted by start
}
```

Behavior order is the array order in the behaviors store. Timeline lanes and the tally follow it.

**Invariant:** every `episode.behaviorId` exists in the behaviors store. Loading a session adds missing behaviors from its snapshot (ADR-014).

## localStorage keys

| Key                                    | Value                                                        | Written by                        |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| `video-keypress:behaviors`             | Zustand persist envelope `{ state: { behaviors }, version }` | `behaviorsStore`                  |
| `video-keypress:prefs`                 | `{ state: { rate, muted }, version }`                        | `playerStore`                     |
| `video-keypress:session:<fingerprint>` | `Session` JSON                                               | `savedSessions` via `useAutosave` |
| `keybinds` (legacy, read once)         | v1 `[{ id, key, order, behavior, active }]`                  | v1 only; migrated, never written  |

Fingerprint: `${name}|${size}|${lastModified}`. A saved session is offered for restore only when its duration is within 0.5 s of the loaded video's.

## JSON export (v2)

```json
{
  "version": 2,
  "app": "video-keypress 2.0.0",
  "metadata": {
    "fileName": "mouse-03.mp4",
    "fileSize": 104857600,
    "lastModified": 1760000000000,
    "duration": 312.48,
    "scoringDate": 1760900000000,
    "scoringDateText": "2025-10-19T18:53:20.000Z",
    "updatedAt": 1760900500000,
    "exportedAt": 1760900600000
  },
  "behaviors": [
    {
      "id": "b1",
      "name": "Scratching",
      "color": "#E69F00",
      "key": "1",
      "code": "Digit1",
      "mode": "hold",
      "order": 1
    }
  ],
  "events": [
    {
      "id": 0,
      "behaviorId": "b1",
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

- `events` are sorted by `start`. `id` is the 0-based index in that order. `order` is the behavior's 1-based lane.
- `key` is the hotkey label, or `""` when the behavior has no hotkey.
- `scoringDate` is when scoring started (session `createdAt`).

## JSON import

- **v2:** has `"version": 2`. Behaviors come from `behaviors`; events reference them by `behaviorId`.
- **v1:** no `version`. Shape: `{ metadata: { fileName, scoringDate, scoringDateText, duration }, events: [{ id, key, behavior, order, start, end }] }`. Behaviors are built from unique `behavior` names, ordered by `order`, with the hotkey from `key` (`"1"` becomes `Digit1`, `"a"` becomes `KeyA`).
- Behaviors in the file are matched to existing behaviors by name, ignoring case. Unmatched ones are added.
- Rejected with a message: unreadable JSON, files over 10 MB, a wrong shape, non-finite or negative times. Swapped `start`/`end` are put in order.
- **v1 caveat:** v1's timeline code changed stored times in place, so v1 files can contain times shifted by about 0.01 s and events stretched to 0.01 s. Those values are imported as they are.

## CSV exports

Both start with a UTF-8 BOM, use CRLF line endings and RFC 4180 quoting. Text cells starting with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets do not run them as formulas.

**Episodes** (`<video>-episodes.csv`): `episode,behavior,key,start_s,end_s,duration_s`

**Summary** (`<video>-summary.csv`): `behavior,key,count,total_s,mean_s,percent_of_video`

## SVG export

`<video>-timeline.svg` is built from session data (not from the screen): one lane per behavior, bars for episodes, a time axis, fixed light colors and the behavior colors.
