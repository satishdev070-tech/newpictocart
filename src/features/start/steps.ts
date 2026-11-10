/** Canonical URL steps for `/start/[step]` (journey mounts only; no legacy ids). */
export const START_STEP_IDS = [
  "lang",
  "path",
  "quiz",
  "voice",
  "business",
  "theme",
  "account",
  "building",
  "done",
] as const;

export type StartStepId = (typeof START_STEP_IDS)[number];

export function isStartStepId(s: string): s is StartStepId {
  return (START_STEP_IDS as readonly string[]).includes(s);
}

export function startStepPath(step: string): `/start/${string}` {
  return `/start/${step}`;
}

/** Preserve query string when redirecting bare `/start` → `/start/lang`. */
export function startSearchQuery(
  sp: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") {
      if (value) params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item) params.append(key, item);
      }
    }
  }
  return params.toString();
}
