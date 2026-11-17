import { describe, expect, it } from "vitest";
import {
  EDITOR_TAG,
  editorPreviewUrl,
  isTrustedOrigin,
  MAX_STATE_CHARS,
  parseEditorMessage,
  parsePreviewMessage,
  PREVIEW_TAG,
  previewSelectMessage,
  readyMessage,
  renderedMessage,
  selectMessage,
  stateMessage,
} from "@/features/informative/editor/protocol";

const hero = { id: "hero-0", type: "hero", props: { heading: "Hi" }, order: 0, visible: true } as const;

describe("editor ↔ preview protocol", () => {
  it("accepts only the exact same origin", () => {
    expect(isTrustedOrigin("https://pictocart.in", "https://pictocart.in")).toBe(true);
    for (const o of ["https://evil.in", "https://shop.pictocart.in", "null", "", "http://pictocart.in"]) expect(isTrustedOrigin(o, "https://pictocart.in"), o).toBe(false);
  });

  it("round-trips every message it builds", () => {
    expect(parseEditorMessage(stateMessage(3, [hero]))).toEqual({ tag: EDITOR_TAG, type: "state", rev: 3, sections: [hero] });
    expect(parseEditorMessage(selectMessage("hero-0"))).toEqual(selectMessage("hero-0"));
    expect(parseEditorMessage(selectMessage(null))).toEqual(selectMessage(null));
    expect(parsePreviewMessage(readyMessage())).toEqual({ tag: PREVIEW_TAG, type: "ready" });
    expect(parsePreviewMessage(renderedMessage(9))).toEqual(renderedMessage(9));
    expect(parsePreviewMessage(previewSelectMessage("about-1"))).toEqual(previewSelectMessage("about-1"));
  });

  it("validates state with the save schema", () => {
    const bad = [
      { ...hero, type: "script" },
      { ...hero, id: "has space" },
      { ...hero, props: { heading: "x".repeat(25_000) } },
    ];
    for (const s of bad) expect(parseEditorMessage(stateMessage(1, [s as never])), JSON.stringify(s).slice(0, 60)).toBeNull();
    expect(parseEditorMessage(stateMessage(1, [hero, hero]))).toBeNull(); // duplicate ids
    expect(parseEditorMessage(stateMessage(1, Array.from({ length: 41 }, (_, i) => ({ ...hero, id: `h-${i}` }))))).toBeNull();
    expect(parseEditorMessage({ tag: EDITOR_TAG, type: "state", rev: -1, sections: [] })).toBeNull();
    expect(parseEditorMessage({ tag: EDITOR_TAG, type: "state", rev: 1, sections: "[]" })).toBeNull();
    expect(MAX_STATE_CHARS).toBeGreaterThan(40 * 20_000);
  });

  it("rejects foreign, malformed and unknown messages", () => {
    for (const d of [null, "ready", [], { type: "ready" }, { tag: "other", type: "ready" }, { tag: PREVIEW_TAG, type: "navigate", url: "/x" }, { tag: PREVIEW_TAG, type: "select", id: "<img>" }, { tag: PREVIEW_TAG, type: "rendered", rev: 1.5 }])
      expect(parsePreviewMessage(d)).toBeNull();
    for (const d of [{ tag: PREVIEW_TAG, type: "ready" }, { tag: EDITOR_TAG, type: "select", id: 5 }, { tag: EDITOR_TAG, type: "eval" }]) expect(parseEditorMessage(d)).toBeNull();
  });

  it("builds the preview URL with an encoded page ref", () => {
    expect(editorPreviewUrl("home")).toBe("/informative/editor-preview?page=home");
    expect(editorPreviewUrl("a&b")).toBe("/informative/editor-preview?page=a%26b");
  });
});
