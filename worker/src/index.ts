import { Scheduler } from "./scheduler";
import { findMatches } from "./alerts/matcher";
export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    const start = Date.now();
    ctx.waitUntil((async () => {
      const res = await Scheduler.run(env);
      const ms = Date.now() - start;
      // structured log
      console.log(JSON.stringify({ level: 'info', event: 'cron', ok: (res as any)?.ok, ingested: (res as any)?.ingested ?? 0, ms }));
      return res;
    })());
  },
  async fetch(req: Request, env: any) {
    const url = new URL(req.url);
    if (url.pathname === "/cron" && req.headers.get("x-cron-secret") === env.CRON_SHARED_SECRET) {
      const start = Date.now();
      const out = await Scheduler.run(env);
      const ms = Date.now() - start;
      console.log(JSON.stringify({ level: 'info', event: 'cron-http', ok: (out as any)?.ok, ingested: (out as any)?.ingested ?? 0, ms }));
      return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/alerts" && req.headers.get("x-cron-secret") === env.CRON_SHARED_SECRET) {
      const start = Date.now();
      const matches = await findMatches(env);
      const ms = Date.now() - start;
      console.log(JSON.stringify({ level: 'info', event: 'alerts', matches: matches.length, ms }));
      return new Response(JSON.stringify({ ok: true, matches }), { headers: { "content-type": "application/json" } });
    }
    return new Response("ok");
  }
}
