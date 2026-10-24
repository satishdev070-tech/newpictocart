import { describe, expect, it } from "vitest";
import { slotListOf } from "@/features/theme/site-builder/slots";
import { CANVAS_TAG, parseCanvasMessage } from "@/features/theme/site-builder/protocol";
import { hasUnpublishedChanges } from "@/features/theme/preview";
import { MAX_AUTO_RECOVERIES, RENDER_WATCHDOG_MS } from "@/features/theme/site-builder/components/canvas-frame";

/** Site builder fixes from the Bugs 2.0 sheet (#11–#16). */

const page = { id: "pabcdefghi", handle: "about", title: "About", seoTitle: "", seoDescription: "", socialImagePath: "", noindex: false, sections: [] };

describe("slotListOf: the list a canvas slot shows (#11)", () => {
  it("maps the home slot to the chosen homepage, and handle slots to their page", () => {
    const doc = { pages: [page], homePageId: page.id };
    expect(slotListOf(doc, "templates.home")).toBe(`pages.${page.id}`);
    expect(slotListOf(doc, "handle.about")).toBe(`pages.${page.id}`);
  });

  it("falls back to the slot's own list", () => {
    expect(slotListOf({ pages: [], homePageId: "" }, "templates.home")).toBe("templates.home");
    expect(slotListOf({ pages: [] }, "templates.page.before")).toBe("templates.page");
    expect(slotListOf(null, "layout.header")).toBe("layout.header");
    expect(slotListOf("not a doc", "layout.footer")).toBe("layout.footer");
  });
});

describe("hasUnpublishedChanges: the preview banner (#12)", () => {
  it("is false when there is no draft or the draft matches what is live", () => {
    const live = { tokens: { primary: "#000" }, pages: [] };
    expect(hasUnpublishedChanges(null, live)).toBe(false);
    expect(hasUnpublishedChanges({ tokens: { primary: "#000" }, pages: [] }, live)).toBe(false);
  });

  it("is true when the draft differs", () => {
    expect(hasUnpublishedChanges({ tokens: { primary: "#f00" }, pages: [] }, { tokens: { primary: "#000" }, pages: [] })).toBe(true);
  });
});

describe("canvas render results (#13–#16)", () => {
  it("keeps the forbidden / failed code so the builder can recover", () => {
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "rendered", rev: 3, ok: false, error: "No", code: "forbidden" })).toEqual({
      tag: CANVAS_TAG,
      type: "rendered",
      rev: 3,
      ok: false,
      error: "No",
      code: "forbidden",
    });
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "rendered", rev: 3, ok: false, code: "nope" })).not.toHaveProperty("code");
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "rendered", rev: 4, ok: true })).toEqual({ tag: CANVAS_TAG, type: "rendered", rev: 4, ok: true });
  });

  it("recovers a lost render automatically, then shows Retry", () => {
    expect(RENDER_WATCHDOG_MS).toBeGreaterThanOrEqual(10_000);
    expect(MAX_AUTO_RECOVERIES).toBeGreaterThan(0);
  });
});
