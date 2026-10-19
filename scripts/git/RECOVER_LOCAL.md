# Recover after `git reset --hard`

Your Mac may still have discarded commits in **reflog**. This cloud agent cannot see those SHAs.

## Quick path (feature work already on GitHub)

Voice onboarding + `/start` shipped via PRs #9–#11 on `main`:

```bash
git checkout main
git pull origin main
pnpm install
pnpm dev
```

Open http://localhost:3000/start

`.env.local` is not deleted by `reset --hard`.

## Recover unique local commits

```bash
scripts/git/recover-after-hard-reset.sh          # list reflog
scripts/git/recover-after-hard-reset.sh <SHA>    # branch recover/local-work
scripts/git/recover-after-hard-reset.sh <SHA> apply
```

Paste `git reflog -20` into Cursor if you need help choosing `<SHA>`.
