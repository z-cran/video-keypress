import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2F7F8C", light: "#469FAE", dark: "#1F5D67" },
        secondary: { main: "#C2185B" },
        background: { default: "#F5F7F8", paper: "#FFFFFF" }
      }
    },
    dark: {
      palette: {
        primary: { main: "#5FB7C6", light: "#8ACFDA", dark: "#469FAE" },
        secondary: { main: "#F06292" },
        background: { default: "#0F1416", paper: "#172024" }
      }
    }
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    button: { textTransform: "none", fontWeight: 500 }
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { variant: "outlined" } }
  }
});
