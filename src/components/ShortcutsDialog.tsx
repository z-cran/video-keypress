import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useBehaviorsStore } from "../features/behaviors/behaviorsStore.ts";

const PLAYER_KEYS: [string[], string][] = [
  [["Space"], "Play or pause"],
  [["Left", "Right"], "Back or forward 5 seconds"],
  [["Shift", "Left", "Right"], "Back or forward 1 second"],
  [[",", "."], "Previous or next frame (pauses first)"],
  [["Shift", ",", "."], "Slower or faster by 0.25x"]
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {keys.map((k) => (
        <Box
          key={k}
          component="kbd"
          sx={{
            px: 0.75,
            py: 0.25,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: 13,
            bgcolor: "action.hover"
          }}
        >
          {k}
        </Box>
      ))}
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Typography
        variant="subtitle2"
        component="h3"
        sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}
      >
        {title}
      </Typography>
      <Table size="small">
        <TableBody>{children}</TableBody>
      </Table>
    </>
  );
}

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const behaviors = useBehaviorsStore((s) => s.behaviors);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="shortcuts-title"
    >
      <DialogTitle id="shortcuts-title">Keyboard shortcuts</DialogTitle>
      <DialogContent dividers>
        <Section title="Player">
          {PLAYER_KEYS.map(([keys, action]) => (
            <TableRow key={action}>
              <TableCell sx={{ width: 180 }}>
                <Keys keys={keys} />
              </TableCell>
              <TableCell>{action}</TableCell>
            </TableRow>
          ))}
        </Section>
        <Section title="Behaviors">
          {behaviors.map((b) => (
            <TableRow key={b.id}>
              <TableCell sx={{ width: 180 }}>
                {b.hotkey ? (
                  <Keys keys={[b.hotkey.label]} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No key
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {b.name} ·{" "}
                {b.mode === "hold"
                  ? "hold to record"
                  : "press to start, press again to stop"}
              </TableCell>
            </TableRow>
          ))}
        </Section>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Shortcuts work once a video is loaded, and not while typing in a field
          or using a dialog. Click the timeline to jump to a moment.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
