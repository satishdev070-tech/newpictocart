import { describe, expect, it } from "vitest";
import { alignOf, boldSegments, imageUrl, int, items, link, wrapperStyle } from "@/features/informative/site/section-props";

describe("informative section settings (Website editor props)", () => {
  it("accepts only safe links", () => {
    expect(link({ c: { label: "Book now", href: "/contact" } }, "c")).toEqual({ label: "Book now", href: "/contact" });
    expect(link({ c: { label: "Call", href: "tel:+91 98765 43210" } }, "c")).not.toBeNull();
    expect(link({ c: { label: "WhatsApp", href: "https://wa.me/919876543210" } }, "c")).not.toBeNull();
    expect(link({ c: { label: "x", href: "javascript:alert(1)" } }, "c")).toBeNull();
    expect(link({ c: { label: "x", href: "http://insecure.example" } }, "c")).toBeNull();
    expect(link({ c: { label: "", href: "/a" } }, "c")).toBeNull();
  });

  it("resolves images only from tenant media paths or the Unsplash CDN", () => {
    expect(imageUrl({ i: "https://images.unsplash.com/photo-1?w=800" }, "i")).toContain("images.unsplash.com");
    expect(imageUrl({ i: "https://evil.example/x.jpg" }, "i")).toBeNull();
    expect(imageUrl({ i: "../../secret" }, "i")).toBeNull();
    expect(imageUrl({}, "i")).toBeNull();
  });

  it("clamps numbers and filters repeatable items", () => {
    expect(int({ n: 99 }, "n", 1, 24)).toBe(24);
    expect(int({ n: "3" }, "n", 1, 24)).toBe(3);
    expect(int({ n: "x" }, "n", 1, 24)).toBeNull();
    const out = items({ list: [{ t: "a" }, "junk", { t: "" }, { t: "b" }] }, "list", 3, (o) => (typeof o.t === "string" && o.t ? o.t : null));
    expect(out).toEqual(["a"]);
  });

  it("backgrounds re-point theme variables so every section type follows them", () => {
    expect(wrapperStyle({}).style).toBeUndefined();
    const dark = wrapperStyle({ background: "dark" });
    expect(dark.style).toMatchObject({ "--if-bg": "#0b0b0d", "--if-text": "#ffffff" });
    expect(wrapperStyle({ background: "surface" }).style).toMatchObject({ "--if-bg": "var(--if-surface)" });
    expect(wrapperStyle({ spacing: "compact" }).style).toMatchObject({ "--if-section-y": "2.5rem" });
    expect(wrapperStyle({ background: "rainbow" }).style).toBeUndefined();
  });

  it("alignment and bold text", () => {
    expect(alignOf({ align: "center" })).toBe("center");
    expect(alignOf({ align: "diagonal" }, "left")).toBe("left");
    expect(boldSegments("Open **every day** till 9")).toEqual([
      { text: "Open ", bold: false },
      { text: "every day", bold: true },
      { text: " till 9", bold: false },
    ]);
  });
});
