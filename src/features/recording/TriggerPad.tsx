import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSettingsDialog } from "../behaviors/settingsDialogStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "./sessionStore.ts";
import TriggerButton from "./TriggerButton.tsx";
import { useTally } from "./useTally.ts";

export default function TriggerPad() {
  const behaviors = useBehaviorsStore((s) => s.behaviors);
  const active = useSessionStore((s) => s.active);
  const canRecord = useSessionStore((s) => Boolean(s.session?.fingerprint));
  const ready = usePlayerStore((s) => s.ready);
  const openSettings = useSettingsDialog((s) => s.setOpen);
  const tally = useTally();

  return (
    <Paper component="section" aria-labelledby="triggers-title" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 1.5 }}>
        <Typography
          id="triggers-title"
          variant="subtitle1"
          component="h2"
          sx={{ flex: 1, fontWeight: 700 }}
        >
          Triggers
        </Typography>
        <Button size="small" onClick={() => openSettings(true)}>
          Edit behaviors
        </Button>
      </Stack>
      {behaviors.length === 0 ? (
        <Typography color="text.secondary">
          No behaviors yet. Use Edit behaviors to add one.
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 1
          }}
        >
          {behaviors.map((b) => (
            <TriggerButton
              key={b.id}
              behavior={b}
              tally={tally.get(b.id)}
              active={active[b.id]}
              disabled={!ready || !canRecord}
            />
          ))}
        </Box>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1.5 }}
      >
        Hold a hotkey or press and hold a trigger while the behavior happens.
        Toggle triggers start on one press and stop on the next.
      </Typography>
    </Paper>
  );
}
