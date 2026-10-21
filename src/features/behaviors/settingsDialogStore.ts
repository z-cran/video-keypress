import { create } from "zustand";

interface SettingsDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Lets the header and the trigger pad open the same Behaviors dialog. */
export const useSettingsDialog = create<SettingsDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open })
}));
