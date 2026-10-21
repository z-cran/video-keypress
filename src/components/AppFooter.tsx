import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

export default function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        px: 3,
        py: 1.5,
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        justifyContent: "space-between",
        borderTop: 1,
        borderColor: "divider"
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Everything stays in your browser. Videos and scores are never uploaded.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        v{__APP_VERSION__} ·{" "}
        <Link href="https://github.com/z-cran/video-keypress" color="inherit">
          GitHub
        </Link>{" "}
        · GPL-3.0
      </Typography>
    </Box>
  );
}
