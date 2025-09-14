import { Scheduler } from "./scheduler";
export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    ctx.waitUntil(Scheduler.run(env));
  },
  async fetch(req: Request, env: any) {
    const url = new URL(req.url);
    if (url.pathname === "/cron" && req.headers.get("x-cron-secret") === env.CRON_SHARED_SECRET) {
      return new Response(JSON.stringify(await Scheduler.run(env)), { headers: { "content-type": "application/json" } });
    }
    return new Response("ok");
  }
}
