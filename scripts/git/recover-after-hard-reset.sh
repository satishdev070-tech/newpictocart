#!/usr/bin/env bash
# Recover commits lost after `git reset --hard` using reflog (safe: never rewrites main
# until you confirm). Run from the repo root on the machine that did the reset (your Mac).
#
# Usage:
#   scripts/git/recover-after-hard-reset.sh              # list candidates + instructions
#   scripts/git/recover-after-hard-reset.sh <SHA>        # create recover/local-work at SHA
#   scripts/git/recover-after-hard-reset.sh <SHA> apply  # cherry-pick SHA onto current main
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "error: run this inside the newpictocart git repo" >&2
  exit 1
fi
cd "$ROOT"

BRANCH_RECOVER="recover/local-work"
SHA="${1:-}"
MODE="${2:-}"

echo "==> Repo: $ROOT"
echo "==> Current tip:"
git status -sb
git log -1 --oneline
echo
echo "==> origin/main (fetching)…"
git fetch origin main 2>/dev/null || git fetch origin 2>/dev/null || true
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "origin/main = $(git rev-parse --short origin/main) $(git log -1 --oneline origin/main)"
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
    echo "HEAD matches origin/main (Sarvam + /start should already be here)."
  else
    echo "HEAD differs from origin/main — compare carefully before applying."
  fi
else
  echo "warning: origin/main not found; continuing with local reflog only"
fi

echo
echo "==> Recent reflog (look BEFORE 'reset: moving to origin/main'):"
git reflog -30
echo
echo "==> Stashes:"
git stash list || true
echo

if [[ -z "$SHA" ]]; then
  cat <<'EOF'
Next steps
----------
1. Pick a SHA from the reflog above (the commit that still had your work).
2. Inspect it:
     git show --stat <SHA>
3. Create a recovery branch (safe):
     scripts/git/recover-after-hard-reset.sh <SHA>
4. If the diff looks right, cherry-pick onto main:
     scripts/git/recover-after-hard-reset.sh <SHA> apply

Notes
-----
- .env.local is gitignored and is NOT removed by reset --hard.
- Voice onboarding + /start are already on GitHub main (PRs #9–#11).
  If that is all you needed, you may not need to recover anything:
     git checkout main && git pull origin main && pnpm install && pnpm dev
  Then open http://localhost:3000/start
EOF
  exit 0
fi

if ! git cat-file -t "$SHA" >/dev/null 2>&1; then
  echo "error: unknown object $SHA — paste output of: git reflog -30" >&2
  exit 1
fi

SHORT="$(git rev-parse --short "$SHA")"
echo "==> Candidate $SHORT:"
git log -1 --format=fuller "$SHA"
echo
git show --stat --oneline -1 "$SHA" | head -80
echo

if [[ "$MODE" == "apply" ]]; then
  echo "==> Checking out main and cherry-picking $SHORT…"
  git checkout main
  git pull origin main || true
  if git merge-base --is-ancestor "$SHA" HEAD 2>/dev/null; then
    echo "That commit is already an ancestor of main — nothing to cherry-pick."
    exit 0
  fi
  if git cherry-pick "$SHA"; then
    echo "Cherry-pick succeeded."
  else
    echo "Cherry-pick has conflicts. Fix files, then:"
    echo "  git add -A"
    echo "  git -c core.editor=true cherry-pick --continue"
    echo "Or abort: git cherry-pick --abort"
    exit 1
  fi
  echo
  echo "==> Verify:"
  git status -sb
  git log -3 --oneline
  test -f src/app/start/page.tsx && echo "OK: src/app/start/page.tsx present" || echo "MISSING: start page"
  test -f .env.local && echo "OK: .env.local present" || echo "NOTE: no .env.local (create from .env.example if needed)"
  echo "Run: pnpm install && pnpm dev → http://localhost:3000/start"
  exit 0
fi

# Default: create / reset recovery branch at SHA
if git show-ref --verify --quiet "refs/heads/$BRANCH_RECOVER"; then
  echo "==> Updating existing branch $BRANCH_RECOVER → $SHORT"
  git branch -f "$BRANCH_RECOVER" "$SHA"
else
  echo "==> Creating branch $BRANCH_RECOVER at $SHORT"
  git branch "$BRANCH_RECOVER" "$SHA"
fi
git checkout "$BRANCH_RECOVER"

echo
echo "==> Commits on recovery branch not in origin/main:"
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  git log --oneline origin/main.."HEAD" || true
  echo
  echo "==> Diffstat vs origin/main:"
  git diff --stat origin/main...HEAD | tail -40 || true
else
  git log --oneline -10
fi

echo
echo "If this looks like your lost work, apply onto main with:"
echo "  scripts/git/recover-after-hard-reset.sh $SHORT apply"
