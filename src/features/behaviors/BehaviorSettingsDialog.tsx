import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState } from "react";
import ControlButton from "../../components/ControlButton.tsx";
import { newId } from "../../lib/id.ts";
import {
  createBehavior,
  defaultBehaviors,
  MAX_NAME_LENGTH,
  moveBehavior,
  nameProblem,
  normalizeName,
  removeBehavior,
  updateBehavior,
  type Behavior
} from "./behaviors.ts";
import { useBehaviorsStore } from "./behaviorsStore.ts";
import ColorPicker from "./ColorPicker.tsx";
import HotkeyField from "./HotkeyField.tsx";
import { hotkeyProblem } from "./hotkeys.ts";

interface BehaviorSettingsDialogProps {
  onClose: () => void;
  /**
   * Called before saving with the behaviors that will be removed. Return
   * false to keep the dialog open (e.g. the user declined to lose episodes).
   */
  confirmRemoval?: (removed: Behavior[]) => Promise<boolean>;
}

/** Edits a draft copy; nothing changes until Save. Mount it only while open. */
export default function BehaviorSettingsDialog({
  onClose,
  confirmRemoval
}: BehaviorSettingsDialogProps) {
  const saved = useBehaviorsStore((s) => s.behaviors);
  const setBehaviors = useBehaviorsStore((s) => s.setBehaviors);
  const [draft, setDraft] = useState<Behavior[]>(saved);
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const problems = new Map(
    draft.map((b) => [b.id, nameProblem(b.name, draft, b.id)])
  );
  const canSave = [...problems.values()].every((p) => p === null);

  const patch = (id: string, change: Partial<Omit<Behavior, "id">>) =>
    setDraft((list) => updateBehavior(list, id, change));

  const save = async () => {
    const kept = new Set(draft.map((b) => b.id));
    const removed = saved.filter((b) => !kept.has(b.id));
    if (
      removed.length > 0 &&
      confirmRemoval &&
      !(await confirmRemoval(removed))
    ) {
      return;
    }
    // The name field keeps spaces while typing; tidy them once, here.
    setBehaviors(draft.map((b) => ({ ...b, name: normalizeName(b.name) })));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      aria-labelledby="behavior-settings-title"
    >
      <DialogTitle id="behavior-settings-title">Behaviors</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>Hold</strong> records while the key or button is held down.{" "}
          <strong>Toggle</strong> starts on the first press and stops on the
          next, and works while the video is paused. Letters and numbers can be
          hotkeys; Space, arrows, comma and period control the player.
        </Typography>
        {draft.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Add a behavior to start scoring.
          </Alert>
        )}
        <Stack spacing={1.5}>
          {draft.map((b, index) => {
            const problem = problems.get(b.id) ?? null;
            const label = b.name.trim() || "this behavior";
            return (
              <Paper key={b.id} sx={{ p: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: "flex-start" } }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flex: 1, alignItems: "flex-start" }}
                  >
                    <ColorPicker
                      color={b.color}
                      label={`Color for ${label}`}
                      onChange={(color) => patch(b.id, { color })}
                    />
                    <TextField
                      label="Name"
                      size="small"
                      fullWidth
                      value={b.name}
                      onChange={(e) =>
                        setDraft((list) =>
                          list.map((x) =>
                            x.id === b.id ? { ...x, name: e.target.value } : x
                          )
                        )
                      }
                      error={problem !== null}
                      helperText={problem ?? " "}
                      slotProps={{
                        htmlInput: { maxLength: MAX_NAME_LENGTH + 10 }
                      }}
                    />
                  </Stack>
                  <HotkeyField
                    value={b.hotkey}
                    behaviorName={b.name.trim()}
                    onChange={(hotkey) => patch(b.id, { hotkey })}
                    problemFor={(code) => hotkeyProblem(code, draft, b.id)}
                  />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={b.mode}
                    aria-label={`Trigger mode for ${label}`}
                    onChange={(_, mode: Behavior["mode"] | null) => {
                      if (mode) patch(b.id, { mode });
                    }}
                  >
                    <ToggleButton value="hold">Hold</ToggleButton>
                    <ToggleButton value="toggle">Toggle</ToggleButton>
                  </ToggleButtonGroup>
                  <Stack direction="row">
                    <ControlButton
                      label={`Move ${label} up`}
                      size="small"
                      disabled={index === 0}
                      onClick={() =>
                        setDraft((list) => moveBehavior(list, b.id, -1))
                      }
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </ControlButton>
                    <ControlButton
                      label={`Move ${label} down`}
                      size="small"
                      disabled={index === draft.length - 1}
                      onClick={() =>
                        setDraft((list) => moveBehavior(list, b.id, 1))
                      }
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </ControlButton>
                    <ControlButton
                      label={`Delete ${label}`}
                      size="small"
                      onClick={() =>
                        setDraft((list) => removeBehavior(list, b.id))
                      }
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </ControlButton>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
        <Button
          startIcon={<AddIcon />}
          sx={{ mt: 2 }}
          onClick={() =>
            setDraft((list) => [...list, createBehavior(list, newId)])
          }
        >
          Add behavior
        </Button>
      </DialogContent>
      <DialogActions>
        <Button
          color="inherit"
          onClick={() => setDraft(defaultBehaviors(newId))}
        >
          Reset to defaults
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
