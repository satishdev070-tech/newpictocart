import { describe, expect, it } from "vitest";
import { IMAGE_STANDARDS, aspectChoices, aspectRatio, purposeForSlot, recommendedText, sameAspect, standardForSlot } from "@/features/media/image-standards";

describe("image standards", () => {
  it("has the agreed sizes", () => {
    expect(IMAGE_STANDARDS.heroDesktop).toMatchObject({ aspect: { w: 16, h: 9 }, maxWidth: 2400, maxHeight: 1350 });
    expect(IMAGE_STANDARDS.heroMobile).toMatchObject({ aspect: { w: 4, h: 5 }, maxWidth: 1080, maxHeight: 1350 });
    expect(IMAGE_STANDARDS.banner).toMatchObject({ aspect: { w: 3, h: 1 }, maxWidth: 2400, maxHeight: 800 });
    expect(IMAGE_STANDARDS.favicon).toMatchObject({ aspect: { w: 1, h: 1 }, maxWidth: 512, maxHeight: 512, transparent: true });
    expect(IMAGE_STANDARDS.logo).toMatchObject({ aspect: null, maxWidth: 960, maxHeight: 400, transparent: true });
    expect(IMAGE_STANDARDS.blogCover).toMatchObject({ maxWidth: 1600, maxHeight: 900 });
    expect(IMAGE_STANDARDS.ogImage).toMatchObject({ maxWidth: 1200, maxHeight: 630 });
    expect(IMAGE_STANDARDS.product.maxWidth).toBe(2000);
  });

  it("output boxes match their aspect", () => {
    for (const s of Object.values(IMAGE_STANDARDS)) {
      if (!s.aspect) continue;
      expect(Math.abs(s.maxWidth / s.maxHeight - aspectRatio(s.aspect)!)).toBeLessThan(0.01);
    }
  });

  it("maps theme fields by section type + key", () => {
    expect(purposeForSlot({ sectionType: "Hero", fieldKey: "imagePath" })).toBe("heroDesktop");
    expect(purposeForSlot({ sectionType: "Hero", fieldKey: "imagePath", variant: "collage" })).toBe("collageTile");
    expect(purposeForSlot({ sectionType: "Hero", fieldKey: "mobileImagePath" })).toBe("heroMobile");
    expect(purposeForSlot({ sectionType: "PromoBanner", fieldKey: "imagePath" })).toBe("banner");
    expect(purposeForSlot({ sectionType: "TrustBadges", fieldKey: "icon" })).toBe("icon");
    expect(purposeForSlot({ sectionType: "VideoBanner", fieldKey: "posterPath" })).toBe("videoCover");
    expect(purposeForSlot({ sectionType: "Footer", fieldKey: "imagePath" })).toBe("illustration");
    expect(purposeForSlot({ sectionType: "header", fieldKey: "logoPath" })).toBe("logo");
  });

  it("guesses from key / label when the section is unknown", () => {
    expect(purposeForSlot({ fieldKey: "imagePath", label: "Image (desktop)" })).toBe("heroDesktop");
    expect(purposeForSlot({ fieldKey: "mobileImagePath", label: "Image (mobile, optional)" })).toBe("heroMobile");
    expect(purposeForSlot({ fieldKey: "logoPath", label: "Logo" })).toBe("logo");
    expect(purposeForSlot({ fieldKey: "", label: "Social share image" })).toBe("ogImage");
    expect(purposeForSlot({ fieldKey: "posterPath", label: "Cover image" })).toBe("videoCover");
    expect(purposeForSlot({ sectionType: "Unknown", fieldKey: "imagePath", label: "Image" })).toBe("general");
    expect(standardForSlot({ fieldKey: "whatever" })).toBe(IMAGE_STANDARDS.general);
  });

  it("offers the preset first, then Free / 1:1 / 4:5 / 16:9 without duplicates", () => {
    const hero = aspectChoices(IMAGE_STANDARDS.heroDesktop).map((c) => c.label);
    expect(hero).toEqual(["16:9 (recommended)", "Free", "1:1", "4:5"]);
    const product = aspectChoices(IMAGE_STANDARDS.product).map((c) => c.label);
    expect(product).toEqual(["1:1 (recommended)", "4:5", "Free", "16:9"]);
    const logo = aspectChoices(IMAGE_STANDARDS.logo).map((c) => c.label);
    expect(logo).toEqual(["Free (recommended)", "1:1", "4:5", "16:9"]);
    expect(sameAspect({ w: 16, h: 9 }, { w: 32, h: 18 })).toBe(true);
    expect(sameAspect(null, { w: 1, h: 1 })).toBe(false);
  });

  it("describes the recommendation", () => {
    expect(recommendedText(IMAGE_STANDARDS.heroDesktop)).toBe("Recommended 2400×1350, 16:9");
    expect(recommendedText(IMAGE_STANDARDS.logo)).toBe("Recommended up to 960×400, any shape (transparent PNG works)");
    expect(recommendedText(IMAGE_STANDARDS.general)).toBe("Recommended up to 2400×2400, any shape");
  });
});

describe("hero collage photos 2 and 3", () => {
  it("use the collage tile standard", () => {
    expect(purposeForSlot({ sectionType: "Hero", fieldKey: "image2Path", variant: "collage" })).toBe("collageTile");
    expect(purposeForSlot({ sectionType: "Hero", fieldKey: "image3Path", variant: "collage" })).toBe("collageTile");
  });
});
