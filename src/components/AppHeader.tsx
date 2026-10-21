import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useSettingsDialog } from "../features/behaviors/settingsDialogStore.ts";
import VideoFileButton from "../features/player/VideoFileButton.tsx";
import { usePlayerStore } from "../features/player/playerStore.ts";
import { useSessionStore } from "../features/recording/sessionStore.ts";
import ExportMenu from "../features/session/ExportMenu.tsx";
import { openFiles } from "../features/session/openVideo.ts";

export default function AppHeader() {
  const videoName = usePlayerStore((s) => s.source?.file.name);
  const scoresName = useSessionStore((s) => s.session?.video.fileName);
  const openSettings = useSettingsDialog((s) => s.setOpen);
  const chip =
    videoName ??
    (scoresName !== undefined
      ? `${scoresName || "Imported scores"} (scores only)`
      : null);

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar sx={{ gap: 1, flexWrap: "wrap", py: { xs: 1, sm: 0 } }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            fontWeight: 700,
            color: "primary.main",
            whiteSpace: "nowrap",
            mr: 1
          }}
        >
          Video Keypress
        </Typography>
        {chip && (
          <Chip
            icon={<MovieOutlinedIcon />}
            label={chip}
            variant="outlined"
            sx={{ maxWidth: { xs: 220, md: 380 } }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => openSettings(true)}
        >
          Behaviors
        </Button>
        <VideoFileButton
          size="small"
          accept=".json,application/json"
          startIcon={<UploadFileIcon />}
          onFiles={openFiles}
        >
          Import
        </VideoFileButton>
        <ExportMenu />
        {chip && (
          <VideoFileButton onFiles={openFiles} variant="outlined" size="small">
            Open video
          </VideoFileButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
