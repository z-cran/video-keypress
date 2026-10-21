import DownloadIcon from "@mui/icons-material/Download";
import Button from "@mui/material/Button";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import { downloadText } from "../../lib/download.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { buildTimelineSvg } from "../timeline/timelineSvg.ts";
import {
  exportBaseName,
  toEpisodesCsv,
  toJsonV2,
  toSummaryCsv
} from "./sessionFormat.ts";

type Kind = "json" | "episodes" | "summary" | "svg";

const OPTIONS: { kind: Kind; label: string; detail: string }[] = [
  {
    kind: "json",
    label: "Scores (JSON)",
    detail: "Everything, for importing later"
  },
  { kind: "episodes", label: "Episodes (CSV)", detail: "One row per episode" },
  {
    kind: "summary",
    label: "Summary (CSV)",
    detail: "Count, total and mean per behavior"
  },
  {
    kind: "svg",
    label: "Timeline (SVG)",
    detail: "Image for slides and papers"
  }
];

function exportAs(kind: Kind) {
  const { session } = useSessionStore.getState();
  const { behaviors } = useBehaviorsStore.getState();
  if (!session) return;
  const base = exportBaseName(session.video.fileName);
  switch (kind) {
    case "json":
      return downloadText(
        `${base}-scores.json`,
        toJsonV2(session, behaviors, __APP_VERSION__, Date.now()),
        "application/json"
      );
    case "episodes":
      return downloadText(
        `${base}-episodes.csv`,
        toEpisodesCsv(session, behaviors),
        "text/csv"
      );
    case "summary":
      return downloadText(
        `${base}-summary.csv`,
        toSummaryCsv(session, behaviors),
        "text/csv"
      );
    case "svg":
      return downloadText(
        `${base}-timeline.svg`,
        buildTimelineSvg(session, behaviors),
        "image/svg+xml"
      );
  }
}

export default function ExportMenu() {
  const hasEpisodes = useSessionStore(
    (s) => (s.session?.episodes.length ?? 0) > 0
  );
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        size="small"
        startIcon={<DownloadIcon />}
        disabled={!hasEpisodes}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Export
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
      >
        {OPTIONS.map((o) => (
          <MenuItem
            key={o.kind}
            onClick={() => {
              exportAs(o.kind);
              setAnchor(null);
            }}
          >
            <ListItemText primary={o.label} secondary={o.detail} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
