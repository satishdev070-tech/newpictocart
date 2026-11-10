import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function installBrowserStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", localStorage);
  return localStorage;
}

describe("sound prefs useSyncExternalStore snapshots", () => {
  beforeEach(() => {
    installBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns a stable getSnapshot reference until prefs change (React #185 guard)", async () => {
    const mod = await import("@/features/notifications/inbox/notification-sound");
    const a = mod.readSoundPrefs();
    const b = mod.readSoundPrefs();
    expect(a).toBe(b);

    mod.writeSoundPrefs({ enabled: false, toneId: "ping" });
    const c = mod.readSoundPrefs();
    expect(c).not.toBe(a);
    expect(c).toEqual({ enabled: false, toneId: "ping" });
    expect(mod.readSoundPrefs()).toBe(c);
  });

  it("returns a stable getServerSnapshot reference", async () => {
    const mod = await import("@/features/notifications/inbox/notification-sound");
    expect(mod.getServerSoundPrefs()).toBe(mod.getServerSoundPrefs());
  });

  it("does not notify listeners when writing an identical prefs object", async () => {
    const mod = await import("@/features/notifications/inbox/notification-sound");
    mod.writeSoundPrefs({ enabled: true, toneId: "chime" });
    const spy = vi.fn();
    const unsub = mod.subscribeSoundPrefs(spy);
    mod.writeSoundPrefs({ enabled: true, toneId: "chime" });
    expect(spy).not.toHaveBeenCalled();
    mod.writeSoundPrefs({ enabled: false, toneId: "chime" });
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });
});
