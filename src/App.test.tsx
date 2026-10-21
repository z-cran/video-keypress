import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";

describe("App", () => {
  it("shows the app title and the privacy note on first load", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Video Keypress" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Everything stays in your browser/)).toBeVisible();
  });
});
