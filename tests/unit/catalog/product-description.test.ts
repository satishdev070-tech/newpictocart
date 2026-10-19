import { describe, expect, it } from "vitest";
import { parseProductDescription } from "@/features/catalog/product-description";

describe("product-description preview", () => {
  it("formats plain-text headings, paragraphs, and bullets without HTML", () => {
    expect(parseProductDescription("Made to last.\n\nKey features\n\n• Soft cotton\n• Machine washable")).toEqual([
      { kind: "p", text: "Made to last." },
      { kind: "h", text: "Key features" },
      { kind: "ul", items: ["Soft cotton", "Machine washable"] },
    ]);
  });

  it("keeps markup as literal text for React to safely escape", () => {
    expect(parseProductDescription("<script>alert('no')</script>")).toEqual([{ kind: "p", text: "<script>alert('no')</script>" }]);
  });
});
