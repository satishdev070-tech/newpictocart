import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Supabase clients are created only in src/lib/supabase/* so RLS/secret rules stay in one place.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message: "Use the factories in @/lib/supabase/* (server, browser, admin).",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/lib/supabase/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Local agent worktrees contain generated Next chunks from other checkouts; they are neither
  // application source nor part of this repository's deliverable.
  globalIgnores([".next/**", "out/**", "build/**", ".claude/**", "next-env.d.ts", "workers/**/dist/**"]),
]);

export default eslintConfig;
