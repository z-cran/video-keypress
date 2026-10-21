import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import { useColorScheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { askAndResetData } from "../features/session/resetData.ts";

export default function AppFooter() {
  const { setMode } = useColorScheme();

  const reset = async () => {
    // The theme choice is kept by MUI, so it is reset here.
    if ((await askAndResetData()) === "everything") setMode("system");
  };

  return (
    <Box
      component="footer"
      sx={{
        px: 3,
        py: 1.5,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 2,
        justifyContent: "space-between",
        borderTop: 1,
        borderColor: "divider"
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Everything stays in your browser. Videos and scores are never uploaded.
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Button
          size="small"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={() => void reset()}
          sx={{ color: "text.secondary" }}
        >
          Reset saved data
        </Button>
        <Typography variant="body2" color="text.secondary">
          v{__APP_VERSION__} ·{" "}
          <Link href="https://github.com/z-cran/video-keypress" color="inherit">
            GitHub
          </Link>{" "}
          · GPL-3.0
        </Typography>
      </Box>
    </Box>
  );
}
