import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import App from "./App.tsx";
import MediaCheck from "./features/player/MediaCheck.tsx";
import { urlFlags } from "./features/player/mediaReport.ts";
import { theme } from "./theme.ts";

/** The app with its theme; rendered by main.tsx and by tests. */
export default function Root() {
  // ?mediacheck swaps in a bare player for comparing playback problems.
  const { mediaCheck } = urlFlags(window.location.search);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {mediaCheck ? <MediaCheck /> : <App />}
    </ThemeProvider>
  );
}
