import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import ControlButton from "../../components/ControlButton.tsx";
import { formatClock, formatDuration } from "../../lib/time.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import type { Episode } from "../recording/recorder.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { findOverlaps } from "../recording/tally.ts";

const NO_EPISODES: Episode[] = [];

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap"
} as const;

/** The keyboard and screen reader route to every episode on the timeline. */
export default function EpisodeList() {
  const behaviors = useBehaviorsStore((s) => s.behaviors);
  const episodes = useSessionStore((s) => s.session?.episodes ?? NO_EPISODES);
  const selectedId = useSessionStore((s) => s.selectedId);
  const canSeek = usePlayerStore((s) => s.ready);
  const overlaps = useMemo(() => findOverlaps(episodes), [episodes]);
  const byId = useMemo(
    () => new Map(behaviors.map((b) => [b.id, b])),
    [behaviors]
  );
  const { select, deleteEpisode } = useSessionStore.getState();
  const { seek } = usePlayerStore.getState();

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          Episodes ({episodes.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {episodes.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No episodes yet. Hold a hotkey or a trigger while the video plays.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 420, overflow: "auto" }}>
            <Table size="small" stickyHeader aria-label="Episodes">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Behavior</TableCell>
                  <TableCell align="right">Start</TableCell>
                  <TableCell align="right">End</TableCell>
                  <TableCell align="right">Duration</TableCell>
                  <TableCell align="right">
                    <Box component="span" sx={visuallyHidden}>
                      Actions
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {episodes.map((e, i) => {
                  const behavior = byId.get(e.behaviorId);
                  return (
                    <TableRow
                      key={e.id}
                      hover
                      selected={e.id === selectedId}
                      onClick={() => {
                        select(e.id);
                        seek(e.start);
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: behavior?.color,
                              flexShrink: 0
                            }}
                          />
                          {behavior?.name}
                          {overlaps.has(e.id) && (
                            <Tooltip
                              title={`Overlaps another ${behavior?.name ?? ""} episode`}
                            >
                              <ReportProblemOutlinedIcon
                                fontSize="small"
                                color="warning"
                                aria-label={`Overlaps another ${behavior?.name ?? ""} episode`}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatClock(e.start)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatClock(e.end)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatDuration(e.end - e.start)}
                      </TableCell>
                      <TableCell align="right" padding="checkbox">
                        <ControlButton
                          label={`Delete episode ${i + 1}`}
                          size="small"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteEpisode(e.id);
                          }}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </ControlButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
        {!canSeek && episodes.length > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 2, py: 1 }}
          >
            Open the matching video to jump to episodes.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
