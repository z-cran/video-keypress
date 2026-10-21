import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false); // a newer question replaces an open one
      set({ request: { ...options, resolve } });
    }),
  answer: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  }
}));

/** Ask the user to confirm; resolves false on cancel or dismiss. */
export const confirmAction = (options: ConfirmOptions) =>
  useConfirmStore.getState().ask(options);
