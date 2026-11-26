import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Fragment, useEffect, useState } from "react";
import { notify } from "../../lib/noticeStore.ts";
import {
  appendEvent,
  describeMedia,
  formatEventLine,
  formatReport,
  snapshotOf,
  urlFlags,
  type FileInfo,
  type MediaEvent,
  type MediaSnapshot
} from "./mediaReport.ts";
import { usePlayerStore } from "./playerStore.ts";

const MAX_EVENTS = 40;

/**
 * Events that show loading and playback progress. A stall reads as
 * `waiting` or `stalled` with the buffer ending at the playhead.
 */
const LOGGED = [
  "loadstart",
  "durationchange",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "play",
  "playing",
  "pause",
  "waiting",
  "stalled",
  "suspend",
  "progress",
  "seeking",
  "seeked",
  "ended",
  "emptied",
  "abort",
  "error"
];

interface MediaDiagnosticsProps {
  el: HTMLMediaElement | null;
  file: FileInfo | null;
  /** How the video is loaded, for the report. */
  source: string | null;
  /** Names the page in the report: the app or the bare media check. */
  page: string;
}

/** Live media state and an event log a researcher can copy into a report. */
export default function MediaDiagnostics({
  el,
  file,
  source,
  page
}: MediaDiagnosticsProps) {
  const [snapshot, setSnapshot] = useState<MediaSnapshot | null>(null);
  const [events, setEvents] = useState<MediaEvent[]>([]);
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    if (!el) return;
    const started = performance.now();
    const onEvent = (ev: Event) => {
      const now = snapshotOf(el);
      setSnapshot(now);
      // timeupdate only refreshes the numbers; logging it would bury the rest.
      if (ev.type === "timeupdate") return;
      setEvents((log) =>
        appendEvent(
          log,
          {
            at: (performance.now() - started) / 1000,
            type: ev.type,
            currentTime: now.currentTime,
            readyState: now.readyState,
            networkState: now.networkState
          },
          MAX_EVENTS
        )
      );
    };
    const types = [...LOGGED, "timeupdate"];
    for (const type of types) el.addEventListener(type, onEvent);
    return () => {
      for (const type of types) el.removeEventListener(type, onEvent);
    };
  }, [el]);

  const copyReport = () => {
    const text = formatReport({
      page,
      version: __APP_VERSION__,
      userAgent: navigator.userAgent,
      touchPoints: navigator.maxTouchPoints,
      file,
      source,
      snapshot,
      events
    });
    const showForManualCopy = () => {
      setReport(text);
      notify(
        "This browser did not allow copying. Select the report below and copy it.",
        { severity: "warning" }
      );
    };
    // Called inside the click so Safari still counts it as a user action.
    // navigator.clipboard is missing outside HTTPS, e.g. a dev server on the LAN.
    let writing: Promise<void>;
    try {
      writing = navigator.clipboard.writeText(text);
    } catch {
      showForManualCopy();
      return;
    }
    writing.then(
      () =>
        notify("Report copied. Paste it into your message about the problem.", {
          severity: "success"
        }),
      showForManualCopy
    );
  };

  return (
    <Paper
      component="section"
      aria-labelledby="media-diagnostics-title"
      variant="outlined"
      sx={{ p: 2, mt: 2 }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
        <Typography
          id="media-diagnostics-title"
          variant="subtitle1"
          component="h2"
          sx={{ flex: 1, fontWeight: 700 }}
        >
          Media diagnostics
        </Typography>
        <Button size="small" variant="outlined" onClick={copyReport}>
          Copy report
        </Button>
      </Stack>

      {snapshot ? (
        <Box
          component="dl"
          sx={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            columnGap: 2,
            rowGap: 0.25,
            m: 0,
            typography: "body2"
          }}
        >
          {describeMedia(snapshot).map(({ label, value }) => (
            <Fragment key={label}>
              <Box component="dt" sx={{ color: "text.secondary" }}>
                {label}
              </Box>
              <Box
                component="dd"
                sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
              >
                {value}
              </Box>
            </Fragment>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Waiting for the video to report its state.
        </Typography>
      )}

      <Typography variant="subtitle2" component="h3" sx={{ mt: 2, mb: 0.5 }}>
        Events, oldest first
      </Typography>
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None yet.
        </Typography>
      ) : (
        <Box
          component="ol"
          aria-label="Media events"
          sx={{
            m: 0,
            p: 0,
            listStyle: "none",
            fontFamily: "monospace",
            fontSize: 12,
            maxHeight: 240,
            overflow: "auto"
          }}
        >
          {events.map((event, i) => (
            <li key={i}>{formatEventLine(event)}</li>
          ))}
        </Box>
      )}

      {report !== null && (
        <TextField
          label="Media report"
          value={report}
          multiline
          minRows={6}
          fullWidth
          slotProps={{ htmlInput: { readOnly: true } }}
          sx={{ mt: 2 }}
        />
      )}
    </Paper>
  );
}

/** The panel wired to the app's player. Shown only with `?debug=media`. */
export function PlayerMediaDiagnostics() {
  const el = usePlayerStore((s) => s.el);
  const file = usePlayerStore((s) => s.source?.file ?? null);
  const via = usePlayerStore((s) => s.source?.via ?? null);
  if (!urlFlags(window.location.search).debugMedia) return null;
  return <MediaDiagnostics el={el} file={file} source={via} page="app" />;
}
