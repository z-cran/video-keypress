import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useConfirmStore } from "../lib/confirmStore.ts";

export default function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const answer = useConfirmStore((s) => s.answer);

  return (
    <Dialog
      open={request !== null}
      onClose={() => answer(false)}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      maxWidth="xs"
    >
      {request && (
        <>
          <DialogTitle id="confirm-title">{request.title}</DialogTitle>
          <DialogContent>
            <DialogContentText id="confirm-message">
              {request.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => answer(false)}>
              {request.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant="contained"
              color={request.destructive ? "error" : "primary"}
              onClick={() => answer(true)}
            >
              {request.confirmLabel}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
