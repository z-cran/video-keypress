import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Root from "./Root.tsx";

describe("App", () => {
  it("shows the app title and the privacy note on first load", () => {
    render(<Root />);

    expect(
      screen.getByRole("heading", { name: "Video Keypress" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Everything stays in your browser/)).toBeVisible();
  });

  it("lists player keys and each behavior's hotkey in the shortcuts dialog", async () => {
    const user = userEvent.setup();
    render(<Root />);

    await user.click(
      screen.getByRole("button", { name: "Keyboard shortcuts" })
    );

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Play or pause")).toBeVisible();
    expect(within(dialog).getByText("Grooming · hold to record")).toBeVisible();
  });

  it("cycles the theme between system, light and dark", async () => {
    const user = userEvent.setup();
    render(<Root />);

    await user.click(
      screen.getByRole("button", { name: "Theme: match the system" })
    );
    expect(screen.getByRole("button", { name: "Theme: light" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Theme: light" }));
    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeVisible();
    expect(document.documentElement).toHaveClass("dark");
  });
});
