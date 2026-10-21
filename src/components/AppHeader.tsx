import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useSettingsDialog } from "../features/behaviors/settingsDialogStore.ts";
import VideoFileButton from "../features/player/VideoFileButton.tsx";
import { usePlayerStore } from "../features/player/playerStore.ts";
import { openVideo } from "../features/session/openVideo.ts";

export default function AppHeader() {
  const fileName = usePlayerStore((s) => s.source?.file.name);
  const openSettings = useSettingsDialog((s) => s.setOpen);

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: { xs: 1, sm: 0 } }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{ fontWeight: 700, color: "primary.main", whiteSpace: "nowrap" }}
        >
          Video Keypress
        </Typography>
        {fileName && (
          <Chip
            icon={<MovieOutlinedIcon />}
            label={fileName}
            variant="outlined"
            sx={{ maxWidth: { xs: 200, md: 360 } }}
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
        {fileName && (
          <VideoFileButton onFiles={openVideo} variant="outlined" size="small">
            Open video
          </VideoFileButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
