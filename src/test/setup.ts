import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Pure-module tests run with `@vitest-environment node`, which has no DOM.
const hasDom = typeof window !== "undefined";

if (hasDom) {
  const { installMediaFakes } = await import("./fakeMedia.ts");
  installMediaFakes();

  // jsdom has no object URLs, ResizeObserver or pointer capture.
  let urls = 0;
  URL.createObjectURL = () => `blob:test/${++urls}`;
  URL.revokeObjectURL = () => {};

  window.ResizeObserver ??= class {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const entry = { target, contentRect: { width: 1000, height: 200 } };
      this.callback([entry as unknown as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  };

  // MUI reads prefers-color-scheme through matchMedia.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList;

  Element.prototype.setPointerCapture ??= function () {};
  Element.prototype.releasePointerCapture ??= function () {};
  Element.prototype.hasPointerCapture ??= () => false;
}

afterEach(async () => {
  if (!hasDom) return;
  cleanup();
  localStorage.clear();
  const { resetStores } = await import("./resetStores.ts");
  resetStores();
});
