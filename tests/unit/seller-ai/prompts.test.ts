import { describe, expect, it } from "vitest";
import { blogWritePrompt, businessCoachPrompt, contactReplyPrompt, productGeneratePrompt } from "@/features/seller-ai/prompts";

describe("seller AI prompts", () => {
  it("builds a product prompt with optional hint and images", () => {
    const p = productGeneratePrompt({
      hint: "cotton kurta <script>",
      locale: "en-IN",
      images: [{ mediaType: "image/jpeg", data: "abc".repeat(20) }],
    });
    expect(p.system).toContain("priceMinor");
    expect(p.user).toContain("cotton kurta");
    expect(p.user).not.toContain("<script>");
    expect(p.images).toHaveLength(1);
  });

  it("builds blog / contact / coach prompts with tagged data blocks", () => {
    const blog = blogWritePrompt({ storeName: "Aangan", topic: "Festive styling tips", locale: "en-IN" });
    expect(blog.user).toContain("<topic>");
    expect(blog.user).toContain("Festive styling tips");
    expect(blog.system).toContain("blocks");

    const reply = contactReplyPrompt({
      storeName: "Aangan",
      name: "Riya",
      subject: "Size chart",
      message: "Do you have M?",
    });
    expect(reply.user).toContain("<customer_message>");
    expect(reply.user).toContain("Riya");
    expect(reply.system).toContain("Aangan");

    const coach = businessCoachPrompt({
      storeName: "Aangan",
      metrics: { orders30d: 12 },
      setupPending: ["Add UPI"],
    });
    expect(coach.user).toContain("<store_snapshot>");
    expect(coach.user).toContain("Add UPI");
    expect(coach.system).toContain("priority");
  });
});
