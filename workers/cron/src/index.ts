/**
 * pictocart-cron: Cloudflare Cron Triggers for the app's /api/cron/* jobs (ADR-043).
 *
 * Holds no app code and no data. On each trigger it calls the platform Worker through a service
 * binding (Worker-to-Worker, never the public internet) with `Authorization: Bearer CRON_SECRET`,
 * exactly like a manual run. Waiting on those calls is I/O, not CPU, so it fits the Free plan's
 * 10 ms CPU per trigger. A failed job is logged and the invocation fails (visible in Workers Logs
 * and the Cron Events list); the next trigger runs again (jobs are idempotent).
 *
 * Production only: staging shares the production database, so it is never scheduled.
 */
import { SCHEDULES } from "./schedule";

export interface Env {
  /** Service binding to the platform Worker (`pictocart`). */
  APP: { fetch(request: Request): Promise<Response> };
  /** Same value as the platform Worker's CRON_SECRET. */
  CRON_SECRET: string;
  /** Origin the jobs are addressed to (selects the platform host inside the app). */
  APP_ORIGIN: string;
}

export type JobResult = { job: string; status: number; ok: boolean; body: string };

export async function runJobs(cron: string, env: Env): Promise<JobResult[]> {
  const jobs = SCHEDULES[cron];
  if (!jobs) throw new Error(`no jobs mapped for cron "${cron}"`);
  const secret = (env.CRON_SECRET ?? "").trim();
  if (secret.length < 24) throw new Error("CRON_SECRET missing or too short");
  const results: JobResult[] = [];
  for (const job of jobs) {
    let status = 0;
    let body = "";
    try {
      // A Request built inside a Worker has no Host header, and the app routes by Host (no Host =>
      // unknown host => 404). Send the platform host explicitly, as a browser would.
      const res = await env.APP.fetch(
        new Request(`${env.APP_ORIGIN}/api/cron/${job}`, {
          headers: { host: new URL(env.APP_ORIGIN).host, authorization: `Bearer ${secret}`, "x-cron-source": "pictocart-cron" },
        }),
      );
      status = res.status;
      body = (await res.text()).slice(0, 300); // counts / status only, never PII
    } catch (err) {
      body = err instanceof Error ? err.message.slice(0, 300) : "fetch failed";
    }
    const result = { job, status, ok: status === 200, body };
    console.log(JSON.stringify({ event: "cron.job", cron, ...result }));
    results.push(result);
  }
  return results;
}

const cronWorker = {
  async scheduled(controller: { cron: string }, env: Env): Promise<void> {
    const failed = (await runJobs(controller.cron, env)).filter((r) => !r.ok);
    if (failed.length) throw new Error(`cron ${controller.cron}: ${failed.map((f) => `${f.job}=${f.status}`).join(", ")}`);
  },
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
};

export default cronWorker;
