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
      onClose={() => answer("cancel")}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      maxWidth="xs"
    >
      {request && (
        <>
          <DialogTitle id="confirm-title">{request.title}</DialogTitle>
          <DialogContent>
            <DialogContentText
              id="confirm-message"
              sx={{ whiteSpace: "pre-line" }}
            >
              {request.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => answer("cancel")}>
              {request.cancelLabel ?? "Cancel"}
            </Button>
            {request.alternativeLabel && (
              <Button variant="outlined" onClick={() => answer("alternative")}>
                {request.alternativeLabel}
              </Button>
            )}
            <Button
              variant="contained"
              color={request.destructive ? "error" : "primary"}
              onClick={() => answer("confirm")}
            >
              {request.confirmLabel}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
