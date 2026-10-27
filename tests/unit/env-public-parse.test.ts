import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv, publicEnvSchema } from "@/lib/env/schema";
import { parsePublicEnv } from "@/lib/env/public-parse";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_0123456789abcdef",
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in",
};

/** The browser parser must accept/reject exactly what the zod schema does, with the same output. */
const cases: Record<string, string | undefined>[] = [
  valid,
  { ...valid, NEXT_PUBLIC_PLATFORM_URL: "https://saas-ecom-puce.vercel.app" },
  { ...valid, NEXT_PUBLIC_PLATFORM_URL: "" },
  { ...valid, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: " HTTPS://www.Pictocart.in/ " },
  { ...valid, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "localhost" },
  { ...valid, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in:3000" },
  { ...valid, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "" },
  { ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" },
  { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short" },
  { ...valid, NEXT_PUBLIC_PLATFORM_URL: "nope" },
];

describe("parsePublicEnv (zod-free, ships to the browser)", () => {
  it.each(cases.map((c, i) => [i, c] as const))("matches publicEnvSchema for case %i", (_i, input) => {
    let expected: unknown;
    try {
      expected = parseEnv(publicEnvSchema, input);
    } catch (e) {
      expected = e;
    }
    if (expected instanceof EnvValidationError) {
      expect(() => parsePublicEnv(input)).toThrow(EnvValidationError);
      // Same variables are reported (messages may be worded differently).
      try {
        parsePublicEnv(input);
      } catch (e) {
        const vars = (issues: string[]) => issues.map((x) => x.split(":")[0]).sort();
        expect(vars((e as EnvValidationError).issues)).toEqual(vars(expected.issues));
      }
    } else {
      expect(parsePublicEnv(input)).toEqual(expected);
    }
  });
});
