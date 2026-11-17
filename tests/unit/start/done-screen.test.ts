import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/stores/actions", () => ({ publishStoreAction: vi.fn() }));
vi.mock("@/features/theme/actions", () => ({ refreshPreviewUrlAction: vi.fn() }));
vi.mock("@/features/start/components/live-preview", () => ({ LivePreview: () => null }));
vi.mock("@/app/fonts", () => ({ inter: { className: "", variable: "" }, display: { className: "", variable: "" } }));
vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "", style: {} }) }));
vi.mock("@/lib/env/public", () => ({ publicEnv: () => ({ NEXT_PUBLIC_PLATFORM_URL: "https://pictocart.in" }) }));

const { publishThenLeave, DoneScreen } = await import("@/features/start/screens/done-screen");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { startCopy } = await import("@/features/start/copy");

describe("done screen actions", () => {
  it("goes to the dashboard only after the store is published", async () => {
    const leave = vi.fn();
    await expect(publishThenLeave(async () => ({ ok: true }), leave, "fallback")).resolves.toBeNull();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("stays on the page and shows why when publishing fails", async () => {
    const leave = vi.fn();
    await expect(publishThenLeave(async () => ({ ok: false, error: { message: "You don't have permission to do that." } }), leave, "fallback")).resolves.toBe(
      "You don't have permission to do that.",
    );
    await expect(
      publishThenLeave(
        async () => {
          throw new Error("network");
        },
        leave,
        "fallback",
      ),
    ).resolves.toBe("fallback");
    expect(leave).not.toHaveBeenCalled();
  });

  it.each(["en-IN", "ta-IN"])("renders Publish, Go to my dashboard and Preview (%s)", (locale) => {
    const c = startCopy(locale);
    const html = renderToStaticMarkup(createElement(DoneScreen, { locale, slug: "kia", rootDomain: "pictocart.in", storeName: "Kia", onDashboard: () => {} }));
    expect(html).toContain(c.done.publish);
    expect(html).toContain(c.done.myDashboard);
    expect(html).toContain(c.done.preview);
    expect(html).toContain("kia.pictocart.in");
  });
});
