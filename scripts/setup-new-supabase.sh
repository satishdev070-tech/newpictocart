#!/usr/bin/env bash
# One-time setup: connect this repo to a NEW Supabase project, apply all migrations,
# and regenerate TypeScript types. Run from the repo root:  bash scripts/setup-new-supabase.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Use an installed Supabase CLI if present, otherwise run it through npx.
if command -v supabase >/dev/null 2>&1; then SB="supabase"; else SB="npx -y supabase@latest"; fi
echo "Using Supabase CLI: $SB"; $SB --version

# 1. config.toml (needed by link/push)
if [ ! -f supabase/config.toml ]; then
  echo "==> supabase/config.toml missing - creating it"
  $SB init </dev/null || true
fi

# 2. Log in (opens your browser once)
if ! $SB projects list >/dev/null 2>&1; then
  echo "==> Logging in to Supabase (approve in the browser window)"
  $SB login
fi

# 3. Pick the NEW project
echo; echo "Your Supabase projects:"; $SB projects list
echo
read -r -p "Paste the Reference ID of the NEW project: " REF
[ -n "$REF" ] || { echo "No ref given, stopping."; exit 1; }
read -r -p "Link this folder to project '$REF'? This must be the NEW project, not the old one. (y/N) " OK
[ "$OK" = "y" ] || [ "$OK" = "Y" ] || { echo "Stopped."; exit 1; }

# 4. Link (asks for the database password you set when creating the project)
$SB link --project-ref "$REF"

# 5. Dry run, then apply migrations (dev/apply-*.sql are NOT used)
echo; echo "==> Migrations that will be applied:"
$SB db push --dry-run
read -r -p "Apply these migrations now? (y/N) " OK
[ "$OK" = "y" ] || [ "$OK" = "Y" ] || { echo "Stopped before applying."; exit 1; }
$SB db push

echo; echo "==> Migration status (Local and Remote should both be filled):"
$SB migration list

# 6. Regenerate types from the live project
echo "==> Regenerating src/lib/supabase/database.types.ts"
$SB gen types typescript --linked > src/lib/supabase/database.types.ts.new
mv src/lib/supabase/database.types.ts.new src/lib/supabase/database.types.ts

if command -v pnpm >/dev/null 2>&1; then
  [ -d node_modules ] || pnpm install
  echo "==> Typecheck"; pnpm typecheck || echo "Typecheck reported issues - paste them to Claude."
fi

echo; echo "Done. Check Table Editor and Storage in the Supabase dashboard."
