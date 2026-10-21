import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AppFooter from "./components/AppFooter.tsx";
import AppHeader from "./components/AppHeader.tsx";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3 }}>
        <Typography color="text.secondary">Choose a video to begin.</Typography>
      </Container>
      <AppFooter />
    </Box>
  );
}
