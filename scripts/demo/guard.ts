/** CLI options and the remote-target guard for the demo-store seeder. PURE; unit tested. */

export type SeedOptions = {
  dryRun: boolean;
  remove: boolean;
  category: string | null;
  slugs: string[];
  target: "local" | "remote";
  yes: boolean;
  retheme: boolean;
  /** Seed even when some department photo searches aren't cached (uses the generic curated pool). */
  allowCuratedPhotos: boolean;
  /** Replace product photos that differ from the plan, and republish the theme. */
  refreshPhotos: boolean;
  /** Platform root domain stores answer on (`<slug>.<root>`); null = NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN. */
  root: string | null;
};

export function parseArgs(argv: readonly string[]): SeedOptions {
  const opts: SeedOptions = { dryRun: false, remove: false, category: null, slugs: [], target: "local", yes: false, retheme: false, allowCuratedPhotos: false, refreshPhotos: false, root: null };
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--remove") opts.remove = true;
    else if (a === "--yes") opts.yes = true;
    else if (a === "--retheme") opts.retheme = true;
    else if (a === "--allow-curated-photos") opts.allowCuratedPhotos = true;
    else if (a === "--refresh-photos") opts.refreshPhotos = true;
    else if (a.startsWith("--root=")) opts.root = a.slice("--root=".length).trim().toLowerCase() || null;
    else if (a.startsWith("--category=")) opts.category = a.slice("--category=".length).trim() || null;
    else if (a.startsWith("--slug=")) opts.slugs.push(...a.slice("--slug=".length).split(",").map((s) => s.trim()).filter(Boolean));
    else if (a.startsWith("--target=")) {
      const t = a.slice("--target=".length);
      if (t !== "local" && t !== "remote") throw new Error(`--target must be "local" or "remote", got "${t}"`);
      opts.target = t;
    } else if (a !== "--") throw new Error(`unknown option ${a}`);
  }
  return opts;
}

/** A Supabase URL on this machine (CLI stack, Docker, or a .localhost / .test dev host). */
export function isLocalSupabaseUrl(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || host === "host.docker.internal" || host.endsWith(".localhost") || host.endsWith(".test");
}

/**
 * Refuses to write to a non-local Supabase project unless BOTH `--target=remote` and `--yes`
 * are given. Dry runs never write, so they are always allowed. Returns a description of the target.
 */
export function assertSafeTarget(url: string, opts: Pick<SeedOptions, "target" | "yes" | "dryRun">): string {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const local = isLocalSupabaseUrl(url);
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  if (opts.dryRun) return `${local ? "local" : "REMOTE"} ${host} (dry run: nothing is written)`;
  if (local) {
    if (opts.target === "remote") throw new Error(`--target=remote was given but ${host} is a local database; drop the flag`);
    return `local ${host}`;
  }
  if (opts.target !== "remote" || !opts.yes) {
    throw new Error(`Refusing to write to the non-local Supabase project at ${host}. To seed it on purpose, pass --target=remote --yes (and run --dry-run first).`);
  }
  return `REMOTE ${host}`;
}

/** A remote run must use a real platform root: `<slug>.localhost` rows don't resolve in production. */
export function assertRootFor(targetLabel: string, root: string): void {
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(root)) throw new Error(`invalid root domain "${root}"`);
  const localRoot = root === "localhost" || root.endsWith(".localhost") || root.endsWith(".test");
  if (targetLabel.startsWith("REMOTE") && !targetLabel.includes("dry run") && localRoot) {
    throw new Error(`Refusing a remote run with the local root domain "${root}": pass --root=<domain the stores should answer on>`);
  }
}
