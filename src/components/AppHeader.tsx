import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export default function AppHeader() {
  return (
    <AppBar position="sticky" color="default" elevation={0}>
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
          Video Keypress
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
