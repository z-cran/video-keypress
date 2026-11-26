import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root.tsx";
import { registerVideoServiceWorker } from "./features/player/videoStreamClient.ts";

// Large videos stall on iPad from blob URLs; the worker serves them in pieces.
registerVideoServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
