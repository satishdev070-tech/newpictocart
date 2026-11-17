import { describe, expect, it } from "vitest";
import type { PageSection } from "@/features/informative/sections";
import { canRedo, canUndo, editorReducer, HISTORY_LIMIT, initEditorState, isDirty, MAX_SECTIONS, serializeSections, type EditorAction, type EditorState } from "@/features/informative/editor/state";

const sec = (id: string, type: PageSection["type"], order: number, props: Record<string, unknown> = {}): PageSection => ({ id, type, props, order, visible: true });
const base = [sec("hero-0", "hero", 0, { heading: "Hi" }), sec("about-1", "about", 1), sec("cta-2", "cta", 2)];
const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const ids = (s: EditorState) => s.sections.map((x) => x.id);
const orders = (s: EditorState) => s.sections.map((x) => x.order);

describe("editor reducer", () => {
  it("loads sorted, clean, with no history", () => {
    const s = initEditorState([base[2]!, base[0]!, base[1]!]);
    expect(ids(s)).toEqual(["hero-0", "about-1", "cta-2"]);
    expect(isDirty(s)).toBe(false);
    expect(canUndo(s) || canRedo(s)).toBe(false);
  });

  it("adds a section at an index with a fresh id and selects it", () => {
    const s = run(initEditorState(base), { type: "add", sectionType: "faq", index: 1 }, { type: "add", sectionType: "faq" });
    expect(ids(s)).toEqual(["hero-0", "faq-0", "about-1", "cta-2", "faq-1"]);
    expect(orders(s)).toEqual([0, 1, 2, 3, 4]);
    expect(s.selectedId).toBe("faq-1");
    expect(isDirty(s)).toBe(true);
  });

  it("inserts an AI section, validating it and renaming a taken id", () => {
    const s0 = initEditorState(base);
    const s = run(s0, { type: "insert", section: sec("hero-0", "hero", 9, { heading: "AI" }), index: 1 });
    expect(ids(s)).toEqual(["hero-0", "hero-1", "about-1", "cta-2"]);
    expect(s.sections[1]!.props).toEqual({ heading: "AI" });
    expect(run(s0, { type: "insert", section: { id: "x", type: "nope", props: {}, order: 0, visible: true } as unknown as PageSection })).toBe(s0);
  });

  it("moves, ignoring out-of-range moves", () => {
    const s0 = initEditorState(base);
    expect(ids(run(s0, { type: "move", from: 0, to: 2 }))).toEqual(["about-1", "cta-2", "hero-0"]);
    expect(orders(run(s0, { type: "move", from: 2, to: 0 }))).toEqual([0, 1, 2]);
    expect(run(s0, { type: "move", from: 0, to: 3 })).toBe(s0);
    expect(run(s0, { type: "move", from: 1, to: 1 })).toBe(s0);
  });

  it("duplicates with a deep copy right after the original", () => {
    const s = run(initEditorState([sec("stats-0", "stats", 0, { items: [{ value: "10", label: "Years" }] })]), { type: "duplicate", id: "stats-0" });
    expect(ids(s)).toEqual(["stats-0", "stats-1"]);
    expect(s.selectedId).toBe("stats-1");
    expect(s.sections[1]!.props).toEqual(s.sections[0]!.props);
    expect(s.sections[1]!.props.items).not.toBe(s.sections[0]!.props.items);
  });

  it("deletes and clears the selection of the deleted section", () => {
    const s = run(initEditorState(base), { type: "select", id: "about-1" }, { type: "delete", id: "about-1" });
    expect(ids(s)).toEqual(["hero-0", "cta-2"]);
    expect(orders(s)).toEqual([0, 1]);
    expect(s.selectedId).toBeNull();
  });

  it("toggles visibility", () => {
    const s = run(initEditorState(base), { type: "toggle", id: "cta-2" });
    expect(s.sections[2]!.visible).toBe(false);
    expect(run(s, { type: "toggle", id: "cta-2" }).sections[2]!.visible).toBe(true);
  });

  it("sets and removes props; replaces props from AI", () => {
    let s = run(initEditorState(base), { type: "setProp", id: "hero-0", key: "subheading", value: "Sub" });
    expect(s.sections[0]!.props).toEqual({ heading: "Hi", subheading: "Sub" });
    s = run(s, { type: "setProp", id: "hero-0", key: "heading", value: undefined });
    expect(s.sections[0]!.props).toEqual({ subheading: "Sub" });
    s = run(s, { type: "replaceProps", id: "hero-0", props: { heading: "New" } });
    expect(s.sections[0]!.props).toEqual({ heading: "New" });
  });

  it("undo / redo across add, move, delete; a new change clears redo", () => {
    const s0 = initEditorState(base);
    const s1 = run(s0, { type: "add", sectionType: "faq" }, { type: "move", from: 3, to: 0 }, { type: "delete", id: "cta-2" });
    expect(ids(s1)).toEqual(["faq-0", "hero-0", "about-1"]);
    const u1 = run(s1, { type: "undo" });
    expect(ids(u1)).toEqual(["faq-0", "hero-0", "about-1", "cta-2"]);
    const u3 = run(u1, { type: "undo" }, { type: "undo" });
    expect(ids(u3)).toEqual(ids(s0));
    expect(isDirty(u3)).toBe(false);
    expect(canUndo(u3)).toBe(false);
    expect(run(u3, { type: "undo" })).toBe(u3);
    const r = run(u3, { type: "redo" }, { type: "redo" }, { type: "redo" });
    expect(ids(r)).toEqual(ids(s1));
    expect(canRedo(r)).toBe(false);
    const branched = run(u1, { type: "toggle", id: "hero-0" });
    expect(canRedo(branched)).toBe(false);
  });

  it("coalesces typing in one field into one undo step", () => {
    const type = (v: string): EditorAction => ({ type: "setProp", id: "hero-0", key: "heading", value: v, coalesce: true });
    const s = run(initEditorState(base), type("H"), type("He"), type("Hel"), { type: "setProp", id: "hero-0", key: "subheading", value: "x", coalesce: true });
    expect(s.past).toHaveLength(2);
    const u = run(s, { type: "undo" });
    expect(u.sections[0]!.props).toEqual({ heading: "Hel" });
    expect(run(u, { type: "undo" }).sections[0]!.props).toEqual({ heading: "Hi" });
    // Selecting something else ends the typing group.
    const s2 = run(initEditorState(base), type("A"), { type: "select", id: "hero-0" }, type("AB"));
    expect(s2.past).toHaveLength(2);
  });

  it("keeps the history bounded and caps the section count", () => {
    let s = initEditorState(base);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s = run(s, { type: "toggle", id: "hero-0" });
    expect(s.past.length).toBe(HISTORY_LIMIT);
    let full = initEditorState([]);
    for (let i = 0; i < MAX_SECTIONS + 3; i++) full = run(full, { type: "add", sectionType: "rich_text" });
    expect(full.sections).toHaveLength(MAX_SECTIONS);
    expect(run(full, { type: "duplicate", id: "rich_text-0" })).toBe(full);
  });

  it("tracks saved state", () => {
    const s = run(initEditorState(base), { type: "toggle", id: "hero-0" });
    expect(isDirty(s)).toBe(true);
    const saved = run(s, { type: "saved", json: serializeSections(s.sections) });
    expect(isDirty(saved)).toBe(false);
    expect(isDirty(run(saved, { type: "undo" }))).toBe(true);
  });
});
