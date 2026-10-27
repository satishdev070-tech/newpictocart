import { describe, expect, it } from "vitest";
import { personName } from "@/lib/validation/common";
import { addressSchema } from "@/features/customer-account/address";
import { nameFromAuthMetadata, splitPersonName } from "@/features/customer-account/names";

const ok = (v: string) => personName.safeParse(v);
const message = (v: string) => {
  const r = personName.safeParse(v);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("person name (checkout / address)", () => {
  it.each(["Asha Mehta", "Ravi K.", "Dr. A. P. J. Abdul Kalam", "D'Souza", "Mary-Jane O'Neil", "राहुल शर्मा", "முருகன்", "সৌরভ গাঙ্গুলী", "ശ്രീ‍ കുമാർ", "Li"])("accepts %s", (v) => {
    expect(ok(v).success).toBe(true);
  });

  it("trims, collapses spaces and normalises curly apostrophes", () => {
    expect(personName.parse("  Asha    Mehta  ")).toBe("Asha Mehta");
    expect(personName.parse("D’Souza")).toBe("D'Souza");
  });

  it("rejects numbers with a clear message", () => {
    expect(message("Asha123")).toBe("Names can't contain numbers");
    expect(message("१२३ राहुल")).toBe("Names can't contain numbers");
  });

  it.each(["Asha@Mehta", "Ravi_Kumar", "Asha!", "<script>", "--", "Asha--Mehta", "-Asha", "Asha 🙂"])("rejects symbols in %s", (v) => {
    expect(ok(v).success).toBe(false);
  });

  it("enforces 2–80 characters", () => {
    expect(message("")).toBe("Enter your full name");
    expect(message("   ")).toBe("Enter your full name");
    expect(message("A")).toBe("Name is too short");
    expect(ok("A".repeat(80)).success).toBe(true);
    expect(message("A".repeat(81))).toBe("Keep the name under 80 characters");
  });

  it("is what the checkout address schema uses on the server", () => {
    const base = { phone: "9876543210", line1: "12 MG Road", city: "Jaipur", state: "Rajasthan", postalCode: "302001" };
    expect(addressSchema.safeParse({ ...base, name: "Asha 2" }).success).toBe(false);
    expect(addressSchema.parse({ ...base, name: " Asha  Mehta " }).name).toBe("Asha Mehta");
  });
});

describe("name from the sign-in identity", () => {
  it("reads Google's full_name / name / given+family names", () => {
    expect(nameFromAuthMetadata({ full_name: "Asha Mehta", name: "Asha M", email: "a@x.in" })).toBe("Asha Mehta");
    expect(nameFromAuthMetadata({ name: "Ravi Kumar" })).toBe("Ravi Kumar");
    expect(nameFromAuthMetadata({ given_name: "Ravi", family_name: "Kumar" })).toBe("Ravi Kumar");
    expect(nameFromAuthMetadata({ display_name: "Asha" })).toBe("Asha");
  });

  it("ignores names that aren't valid person names", () => {
    expect(nameFromAuthMetadata({ full_name: "user_1234" })).toBeNull();
    expect(nameFromAuthMetadata({ full_name: "user_1234", name: "Asha Mehta" })).toBe("Asha Mehta");
    expect(nameFromAuthMetadata(null)).toBeNull();
    expect(nameFromAuthMetadata({})).toBeNull();
  });

  it("splits into first and last name", () => {
    expect(splitPersonName("Asha Mehta Rao")).toEqual({ first: "Asha", last: "Mehta Rao" });
    expect(splitPersonName("Asha")).toEqual({ first: "Asha", last: null });
  });
});
