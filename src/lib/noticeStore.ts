import { create } from "zustand";

export interface Notice {
  id: number;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  action?: { label: string; run: () => void };
  /** Stays until dismissed instead of hiding after a few seconds. */
  sticky?: boolean;
}

interface NoticeState {
  notice: Notice | null;
  notify: (
    message: string,
    options?: Partial<Omit<Notice, "id" | "message">>
  ) => void;
  dismiss: (id?: number) => void;
}

let nextId = 1;

/** One snackbar at a time; a new notice replaces the current one. */
export const useNoticeStore = create<NoticeState>()((set, get) => ({
  notice: null,
  notify: (message, options) =>
    set({
      notice: { id: nextId++, message, severity: "info", ...options }
    }),
  dismiss: (id) => {
    if (id === undefined || get().notice?.id === id) set({ notice: null });
  }
}));

export const notify = (...args: Parameters<NoticeState["notify"]>) =>
  useNoticeStore.getState().notify(...args);
