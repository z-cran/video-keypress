import {
  sanitizeBehaviors,
  type Behavior,
  type NewId
} from "../behaviors/behaviors.ts";
import { legacyKeyToCode } from "../behaviors/hotkeys.ts";
import type { Episode } from "../recording/recorder.ts";
import { summarize } from "../recording/tally.ts";
import type { Session } from "./session.ts";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Byte order mark (U+FEFF), built from its code so no invisible character sits in the source. */
export const BOM = String.fromCharCode(0xfeff);

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Behaviors in lane order: the list's order, then any others the session uses. */
function lanes(session: Session, behaviors: readonly Behavior[]): Behavior[] {
  const used = new Set(session.episodes.map((e) => e.behaviorId));
  const listed = behaviors.filter((b) => used.has(b.id));
  const extra = session.behaviors.filter(
    (b) => used.has(b.id) && !listed.some((l) => l.id === b.id)
  );
  return [...listed, ...extra];
}

/**
 * JSON export. Keeps v1's `metadata` and `events` fields so tools written for
 * v1 files still read it (ADR-012).
 */
export function toJsonV2(
  session: Session,
  behaviors: readonly Behavior[],
  appVersion: string,
  now: number
): string {
  const ordered = lanes(session, behaviors);
  const order = new Map(ordered.map((b, i) => [b.id, i + 1]));
  const byId = new Map(ordered.map((b) => [b.id, b]));
  const sorted = [...session.episodes].sort((a, b) => a.start - b.start);
  const file = {
    version: 2,
    app: `video-keypress ${appVersion}`,
    metadata: {
      fileName: session.video.fileName,
      fileSize: session.video.size,
      lastModified: session.video.lastModified,
      duration: finite(session.video.duration) ? session.video.duration : null,
      scoringDate: session.createdAt,
      scoringDateText: new Date(session.createdAt).toISOString(),
      updatedAt: session.updatedAt,
      exportedAt: now
    },
    behaviors: ordered.map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      key: b.hotkey?.label ?? null,
      code: b.hotkey?.code ?? null,
      mode: b.mode,
      order: order.get(b.id)
    })),
    events: sorted.map((e, i) => ({
      id: i,
      behaviorId: e.behaviorId,
      behavior: byId.get(e.behaviorId)?.name ?? "",
      key: byId.get(e.behaviorId)?.hotkey?.label ?? "",
      order: order.get(e.behaviorId) ?? 0,
      start: e.start,
      end: e.end,
      duration: round3(e.end - e.start)
    }))
  };
  return JSON.stringify(file, null, 2);
}

export type ParseResult =
  | {
      ok: true;
      session: Session;
      format: "v1" | "v2";
      /** Events left out because their times or behavior were unreadable. */
      skipped: number;
    }
  | { ok: false; message: string };

const NOT_OURS =
  "This file does not look like scores from Video Keypress. Choose a .json file exported from the app.";

interface RawEvent {
  behaviorId?: unknown;
  behavior?: unknown;
  key?: unknown;
  order?: unknown;
  start?: unknown;
  end?: unknown;
}

/** Read a v1 or v2 JSON export into a read-only session (no fingerprint). */
export function parseSessionFile(
  text: string,
  newId: NewId,
  now: number
): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      message:
        "This file is larger than 10 MB, which is more than a scores file should be."
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message:
        "This file could not be read as JSON. Choose a .json file exported from the app."
    };
  }
  if (typeof raw !== "object" || raw === null)
    return { ok: false, message: NOT_OURS };
  const file = raw as Record<string, unknown>;
  if (!Array.isArray(file.events)) return { ok: false, message: NOT_OURS };
  const meta = (
    typeof file.metadata === "object" && file.metadata !== null
      ? file.metadata
      : {}
  ) as Record<string, unknown>;
  const events = file.events as RawEvent[];
  const isV2 = file.version === 2;

  // Behaviors: v2 lists them; v1 only names them on each event.
  let candidates: unknown[];
  if (isV2 && Array.isArray(file.behaviors)) {
    candidates = (file.behaviors as Record<string, unknown>[]).map((b) => ({
      id: b?.id,
      name: b?.name,
      color: b?.color,
      hotkey:
        typeof b?.code === "string" ? { code: b.code, label: b.key } : null,
      mode: b?.mode
    }));
  } else {
    const seen = new Map<
      string,
      { name: string; key: unknown; order: number }
    >();
    events.forEach((e, i) => {
      if (typeof e?.behavior !== "string" || seen.has(e.behavior)) return;
      seen.set(e.behavior, {
        name: e.behavior,
        key: e.key,
        order: finite(e.order) ? e.order : 1000 + i
      });
    });
    candidates = [...seen.values()]
      .sort((a, b) => a.order - b.order)
      .map((b) => {
        const code = legacyKeyToCode(b.key);
        return {
          id: "",
          name: b.name,
          color: "",
          hotkey: code ? { code } : null,
          mode: "hold"
        };
      });
  }
  const behaviors = sanitizeBehaviors(candidates, newId) ?? [];
  const byId = new Map(behaviors.map((b) => [b.id, b]));
  const byName = new Map(behaviors.map((b) => [b.name.toLocaleLowerCase(), b]));

  const episodes: Episode[] = [];
  let skipped = 0;
  for (const e of events) {
    const behavior =
      (typeof e?.behaviorId === "string"
        ? byId.get(e.behaviorId)
        : undefined) ??
      (typeof e?.behavior === "string"
        ? byName.get(e.behavior.trim().replace(/\s+/g, " ").toLocaleLowerCase())
        : undefined);
    if (
      !behavior ||
      !finite(e.start) ||
      !finite(e.end) ||
      e.start < 0 ||
      e.end < 0
    ) {
      skipped++;
      continue;
    }
    episodes.push({
      id: newId(),
      behaviorId: behavior.id,
      start: round3(Math.min(e.start, e.end)),
      end: round3(Math.max(e.start, e.end))
    });
  }
  episodes.sort((a, b) => a.start - b.start);

  const usedBehaviors = behaviors.filter((b) =>
    episodes.some((e) => e.behaviorId === b.id)
  );
  const scoringDate = finite(meta.scoringDate) ? meta.scoringDate : now;
  return {
    ok: true,
    format: isV2 ? "v2" : "v1",
    skipped,
    session: {
      version: 2,
      fingerprint: null,
      video: {
        fileName: typeof meta.fileName === "string" ? meta.fileName : "",
        size: finite(meta.fileSize) ? meta.fileSize : 0,
        lastModified: finite(meta.lastModified) ? meta.lastModified : 0,
        duration:
          finite(meta.duration) && meta.duration > 0
            ? meta.duration
            : Number.NaN
      },
      createdAt: scoringDate,
      updatedAt: finite(meta.updatedAt) ? meta.updatedAt : scoringDate,
      behaviors: usedBehaviors.length > 0 ? usedBehaviors : behaviors,
      episodes
    }
  };
}

/** One CSV cell: quoted when needed, and never run as a spreadsheet formula. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

type Cell = string | number | null;

function csv(rows: readonly (readonly Cell[])[]): string {
  // The BOM makes Excel read UTF-8 names correctly.
  return BOM + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** CSV columns in file order. `id` is the header written to the file. */
export const EPISODE_COLUMNS = [
  { id: "episode", label: "Episode number" },
  { id: "behavior", label: "Behavior" },
  { id: "key", label: "Hotkey" },
  { id: "start_s", label: "Start (s)" },
  { id: "end_s", label: "End (s)" },
  { id: "duration_s", label: "Duration (s)" }
] as const;
export type EpisodeColumn = (typeof EPISODE_COLUMNS)[number]["id"];

export const SUMMARY_COLUMNS = [
  { id: "behavior", label: "Behavior" },
  { id: "key", label: "Hotkey" },
  { id: "count", label: "Count" },
  { id: "total_s", label: "Total (s)" },
  { id: "mean_s", label: "Mean (s)" },
  { id: "percent_of_video", label: "% of video" }
] as const;
export type SummaryColumn = (typeof SUMMARY_COLUMNS)[number]["id"];

/**
 * The known ids in `selected`, in file order. Unknown ids are dropped, and
 * an empty or unreadable selection means every column, so a stale or
 * corrupt saved choice never produces an empty file.
 */
export function pickColumns<T extends string>(
  all: readonly { id: T }[],
  selected: unknown
): T[] {
  const chosen = new Set<unknown>(Array.isArray(selected) ? selected : []);
  const picked = all.map((c) => c.id).filter((id) => chosen.has(id));
  return picked.length > 0 ? picked : all.map((c) => c.id);
}

function table<T extends string>(
  columns: readonly T[],
  rows: readonly Record<T, Cell>[]
): string {
  return csv([columns, ...rows.map((row) => columns.map((c) => row[c]))]);
}

export function toEpisodesCsv(
  session: Session,
  behaviors: readonly Behavior[],
  columns: readonly EpisodeColumn[] = EPISODE_COLUMNS.map((c) => c.id)
): string {
  const byId = new Map(lanes(session, behaviors).map((b) => [b.id, b]));
  const sorted = [...session.episodes].sort((a, b) => a.start - b.start);
  return table(
    pickColumns(EPISODE_COLUMNS, columns),
    sorted.map((e, i) => {
      const b = byId.get(e.behaviorId);
      return {
        episode: i + 1,
        behavior: b?.name ?? "",
        key: b?.hotkey?.label ?? "",
        start_s: e.start.toFixed(3),
        end_s: e.end.toFixed(3),
        duration_s: (e.end - e.start).toFixed(3)
      };
    })
  );
}

export function toSummaryCsv(
  session: Session,
  behaviors: readonly Behavior[],
  columns: readonly SummaryColumn[] = SUMMARY_COLUMNS.map((c) => c.id)
): string {
  const ordered = [
    ...behaviors,
    ...session.behaviors.filter(
      (b) =>
        !behaviors.some((l) => l.id === b.id) &&
        session.episodes.some((e) => e.behaviorId === b.id)
    )
  ];
  const tally = summarize(
    session.episodes,
    ordered.map((b) => b.id),
    session.video.duration
  );
  return table(
    pickColumns(SUMMARY_COLUMNS, columns),
    ordered.map((b) => {
      const t = tally.get(b.id);
      return {
        behavior: b.name,
        key: b.hotkey?.label ?? "",
        count: t?.count ?? 0,
        total_s: (t?.total ?? 0).toFixed(3),
        mean_s: t?.mean == null ? "" : t.mean.toFixed(3),
        percent_of_video:
          t?.percentOfVideo == null ? "" : t.percentOfVideo.toFixed(2)
      };
    })
  );
}

/** A safe base name for exported files: `mouse 3.mp4` gives `mouse 3`. */
export function exportBaseName(fileName: string): string {
  const base = fileName
    .replace(/\.[^./\\]+$/, "")
    // Control characters are not allowed in file names on Windows.
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, "_")
    .trim();
  return base || "scores";
}
