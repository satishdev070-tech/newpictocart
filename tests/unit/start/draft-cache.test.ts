import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyStartDraft, START_DRAFT_STORAGE_KEY } from "@/features/start/draft/schema";
import {
  clearStartDraftStorage,
  startDraftStorageEpoch,
  writeStartDraft,
} from "@/features/start/draft/storage";
import { peekStartDraftClientSnapshot } from "@/features/start/draft/use-start-draft";

/** Minimal browser globals so storage.ts `isBrowser()` passes under Node vitest. */
function installBrowserGlobals() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "document", {
    value: { cookie: "" },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  return store;
}

describe("start draft client cache vs clear", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installBrowserGlobals();
  });

  afterEach(() => {
    clearStartDraftStorage();
    store.clear();
  });

  it("reloads a fresh draft after clear even with no React subscribers", () => {
    const mid = emptyStartDraft();
    mid.screen = "theme";
    mid.path = "ai";
    mid.business.name = "Stuck Store";
    writeStartDraft(mid);

    const before = peekStartDraftClientSnapshot();
    expect(before.screen).toBe("theme");
    expect(before.business.name).toBe("Stuck Store");

    const epochBefore = startDraftStorageEpoch();
    clearStartDraftStorage();
    expect(startDraftStorageEpoch()).toBeGreaterThan(epochBefore);
    expect(store.has(START_DRAFT_STORAGE_KEY)).toBe(false);

    // No useStartDraft mounted — epoch miss must still force a LS reload.
    const after = peekStartDraftClientSnapshot();
    expect(after.screen).toBe("lang");
    expect(after.business.name).toBe("");
    expect(after.path).toBeNull();
  });
});
