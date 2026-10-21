import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import VideoFileButton from "../features/player/VideoFileButton.tsx";
import { usePlayerStore } from "../features/player/playerStore.ts";
import { openVideo } from "../features/session/openVideo.ts";

export default function AppHeader() {
  const fileName = usePlayerStore((s) => s.source?.file.name);

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar sx={{ gap: 1.5, flexWrap: "wrap" }}>
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
        {fileName && (
          <VideoFileButton onFiles={openVideo} variant="outlined" size="small">
            Open video
          </VideoFileButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
