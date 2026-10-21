import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Root from "../../Root.tsx";
import { useBehaviorsStore } from "./behaviorsStore.ts";

async function openSettings() {
  const user = userEvent.setup();
  render(<Root />);
  await user.click(screen.getByRole("button", { name: "Behaviors" }));
  const dialog = screen.getByRole("dialog", { name: "Behaviors" });
  return { user, dialog };
}

function names() {
  return useBehaviorsStore.getState().behaviors.map((b) => b.name);
}

describe("Behaviors dialog", () => {
  it("lists the default behaviors with their keys", async () => {
    const { dialog } = await openSettings();

    expect(
      within(dialog)
        .getAllByLabelText("Name")
        .map((i) => (i as HTMLInputElement).value)
    ).toEqual(["Scratching", "Grooming", "Rearing"]);
    expect(
      within(dialog).getByRole("button", { name: "Hotkey for Grooming: 2" })
    ).toBeVisible();
  });

  it("saves a renamed behavior and keeps it after a reload", async () => {
    const { user, dialog } = await openSettings();
    const name = within(dialog).getAllByLabelText("Name")[0]!;

    await user.clear(name);
    await user.type(name, "  Face   washing ");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(names()[0]).toBe("Face washing");
    const stored = JSON.parse(
      localStorage.getItem("video-keypress:behaviors")!
    ) as {
      state: { behaviors: { name: string }[] };
    };
    expect(stored.state.behaviors[0]?.name).toBe("Face washing");
  });

  it("blocks saving while a name is empty or repeated", async () => {
    const { user, dialog } = await openSettings();
    const [first, second] = within(dialog).getAllByLabelText("Name");

    await user.clear(first!);
    expect(
      within(dialog).getByText("Give this behavior a name.")
    ).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(first!, "grooming");
    // Both rows are flagged, each naming the other as typed.
    expect(
      within(dialog).getByText("Another behavior is already called Grooming.")
    ).toBeVisible();
    expect(
      within(dialog).getByText("Another behavior is already called grooming.")
    ).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(second).toHaveValue("Grooming");
  });

  it("binds a new hotkey by pressing it", async () => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Hotkey for Scratching: 1" })
    );
    await user.keyboard("[KeyS]");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(useBehaviorsStore.getState().behaviors[0]?.hotkey).toEqual({
      code: "KeyS",
      label: "S"
    });
  });

  it.each([
    [
      "[Space]",
      "Space plays and pauses the video. Choose a letter or number key."
    ],
    ["[Digit2]", "2 is already used by Grooming. Choose another key."],
    ["[F5]", "Choose a letter or number key."],
    [
      "{Control>}[KeyS]{/Control}",
      "Use a single key, without Ctrl, Alt or Cmd."
    ]
  ])("refuses %s as a hotkey and says why", async (keys, message) => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Hotkey for Scratching: 1" })
    );
    await user.keyboard(keys);

    expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
    expect(
      within(dialog).getByRole("button", {
        name: "Hotkey for Scratching: press a key"
      })
    ).toBeVisible();
  });

  it("cancels a key capture with Escape without closing the dialog", async () => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Hotkey for Scratching: 1" })
    );
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Behaviors" })).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Hotkey for Scratching: 1" })
    ).toBeVisible();
  });

  it("adds a behavior with the next free number key", async () => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Add behavior" })
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const added = useBehaviorsStore.getState().behaviors[3];
    expect(added).toMatchObject({
      name: "New behavior",
      hotkey: { code: "Digit4", label: "4" },
      mode: "hold"
    });
  });

  it("switches a behavior to toggle mode", async () => {
    const { user, dialog } = await openSettings();
    const group = within(dialog).getByRole("group", {
      name: "Trigger mode for Rearing"
    });

    await user.click(within(group).getByRole("button", { name: "Toggle" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(useBehaviorsStore.getState().behaviors[2]?.mode).toBe("toggle");
  });

  it("reorders and deletes behaviors", async () => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Move Rearing up" })
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Delete Scratching" })
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(names()).toEqual(["Rearing", "Grooming"]);
  });

  it("throws away changes on Cancel", async () => {
    const { user, dialog } = await openSettings();

    await user.click(
      within(dialog).getByRole("button", { name: "Delete Scratching" })
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(names()).toEqual(["Scratching", "Grooming", "Rearing"]);
  });
});
