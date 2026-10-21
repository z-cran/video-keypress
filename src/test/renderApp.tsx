import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.tsx";
import { loadMetadata } from "./fakeMedia.ts";

interface Options {
  duration?: number;
  name?: string;
  size?: number;
  lastModified?: number;
}

export function videoFile({
  name = "mouse.mp4",
  size = 1,
  lastModified = 1
}: Omit<Options, "duration"> = {}) {
  return new File(["x".repeat(size)], name, {
    type: "video/mp4",
    lastModified
  });
}

/** Render the app, pick a video through the file input and load its metadata. */
export async function renderAppWithVideo(options: Options = {}) {
  const user = userEvent.setup();
  render(<App />);
  const file = videoFile(options);
  await user.upload(screen.getByLabelText("Choose a video"), file);
  const video = screen.getByLabelText<HTMLVideoElement>("Video");
  loadMetadata(video, { duration: options.duration ?? 60 });
  return { user, video, file };
}
