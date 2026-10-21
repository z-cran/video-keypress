import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** A second, non-default choice shown between Cancel and Confirm. */
  alternativeLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
}

export type Choice = "confirm" | "alternative" | "cancel";

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (choice: Choice) => void }) | null;
  ask: (options: ConfirmOptions) => Promise<Choice>;
  answer: (choice: Choice) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  ask: (options) =>
    new Promise<Choice>((resolve) => {
      get().request?.resolve("cancel"); // a newer question replaces an open one
      set({ request: { ...options, resolve } });
    }),
  answer: (choice) => {
    get().request?.resolve(choice);
    set({ request: null });
  }
}));

/** Ask the user to confirm; resolves false on cancel or dismiss. */
export const confirmAction = async (options: ConfirmOptions) =>
  (await useConfirmStore.getState().ask(options)) === "confirm";

/** Ask with up to three answers; dismissing the dialog is "cancel". */
export const chooseAction = (options: ConfirmOptions) =>
  useConfirmStore.getState().ask(options);
