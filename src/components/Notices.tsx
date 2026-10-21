import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useNoticeStore } from "../lib/noticeStore.ts";

export default function Notices() {
  const notice = useNoticeStore((s) => s.notice);
  const dismiss = useNoticeStore((s) => s.dismiss);

  return (
    <Snackbar
      key={notice?.id}
      open={notice !== null}
      autoHideDuration={notice?.sticky ? null : 5000}
      onClose={(_, reason) => {
        if (reason !== "clickaway") dismiss(notice?.id);
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {notice ? (
        <Alert
          severity={notice.severity}
          variant="filled"
          onClose={() => dismiss(notice.id)}
          action={
            notice.action ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  notice.action?.run();
                  dismiss(notice.id);
                }}
              >
                {notice.action.label}
              </Button>
            ) : undefined
          }
          sx={{ alignItems: "center" }}
        >
          {notice.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
