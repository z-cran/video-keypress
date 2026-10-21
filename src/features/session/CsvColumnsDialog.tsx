import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { useExportPrefs, type CsvKind } from "./exportPrefsStore.ts";
import {
  BOM,
  EPISODE_COLUMNS,
  pickColumns,
  SUMMARY_COLUMNS,
  toEpisodesCsv,
  toSummaryCsv
} from "./sessionFormat.ts";

const PREVIEW_ROWS = 3;

const COPY: Record<
  CsvKind,
  { title: string; columns: readonly { id: string; label: string }[] }
> = {
  episodes: { title: "Export episodes (CSV)", columns: EPISODE_COLUMNS },
  summary: { title: "Export summary (CSV)", columns: SUMMARY_COLUMNS }
};

interface CsvColumnsDialogProps {
  kind: CsvKind;
  onClose: () => void;
  /** Download with the columns just saved to the export preferences. */
  onExport: () => void;
}

/** Choose which columns a CSV export includes. Mount it only while open. */
export default function CsvColumnsDialog({
  kind,
  onClose,
  onExport
}: CsvColumnsDialogProps) {
  const { title, columns } = COPY[kind];
  const saved = useExportPrefs((s) =>
    kind === "episodes" ? s.episodeColumns : s.summaryColumns
  );
  const [selected, setSelected] = useState<string[]>(saved);
  const session = useSessionStore((s) => s.session);
  const behaviors = useBehaviorsStore((s) => s.behaviors);

  const preview = useMemo(() => {
    if (!session || selected.length === 0) return "";
    const text =
      kind === "episodes"
        ? toEpisodesCsv(
            session,
            behaviors,
            pickColumns(EPISODE_COLUMNS, selected)
          )
        : toSummaryCsv(
            session,
            behaviors,
            pickColumns(SUMMARY_COLUMNS, selected)
          );
    const lines = text.slice(BOM.length).split("\r\n").filter(Boolean);
    const shown = lines.slice(0, PREVIEW_ROWS + 1).join("\n");
    return lines.length > PREVIEW_ROWS + 1 ? `${shown}\n…` : shown;
  }, [kind, session, behaviors, selected]);

  const exportNow = () => {
    const prefs = useExportPrefs.getState();
    if (kind === "episodes")
      prefs.setEpisodeColumns(pickColumns(EPISODE_COLUMNS, selected));
    else prefs.setSummaryColumns(pickColumns(SUMMARY_COLUMNS, selected));
    onExport();
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="csv-columns-title"
    >
      <DialogTitle id="csv-columns-title">{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          Choose the columns to include. Your choice is remembered for next
          time.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Button
            size="small"
            onClick={() => setSelected(columns.map((c) => c.id))}
          >
            Select all
          </Button>
          <Button size="small" onClick={() => setSelected([])}>
            Clear
          </Button>
        </Stack>
        <FormGroup
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }
          }}
        >
          {columns.map((c) => (
            <FormControlLabel
              key={c.id}
              label={
                <>
                  {c.label}{" "}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: "monospace" }}
                  >
                    {c.id}
                  </Typography>
                </>
              }
              control={
                <Checkbox
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, c.id]
                        : prev.filter((id) => id !== c.id)
                    )
                  }
                />
              }
            />
          ))}
        </FormGroup>
        {selected.length === 0 ? (
          <FormHelperText error role="alert" sx={{ mt: 1 }}>
            Choose at least one column.
          </FormHelperText>
        ) : (
          <>
            <Typography
              variant="subtitle2"
              component="h3"
              sx={{ mt: 2, mb: 0.5 }}
            >
              Preview
            </Typography>
            <Box
              component="pre"
              data-testid="csv-preview"
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: 1,
                bgcolor: "action.hover",
                fontSize: 12,
                overflowX: "auto"
              }}
            >
              {preview}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0}
          onClick={exportNow}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}
