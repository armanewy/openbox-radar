import { Scheduler } from "./scheduler";
import { findMatches } from "./alerts/matcher";
import { getBestBuyStoreAvailability } from "./enrichers/bestbuy_store_availability";
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
    const secretOk = req.headers.get("x-cron-secret") === env.CRON_SHARED_SECRET;
    if (url.pathname === "/cron" && secretOk) {
      const start = Date.now();
      const out = await Scheduler.run(env);
      const ms = Date.now() - start;
      console.log(JSON.stringify({ level: 'info', event: 'cron-http', ok: (out as any)?.ok, ingested: (out as any)?.ingested ?? 0, ms }));
      return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/alerts" && secretOk) {
      const start = Date.now();
      const matches = await findMatches(env);
      const ms = Date.now() - start;
      console.log(JSON.stringify({ level: 'info', event: 'alerts', matches: matches.length, ms }));
      return new Response(JSON.stringify({ ok: true, matches }), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/enrich/bb" && secretOk) {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
      }
      const body = await req.json().catch(() => ({}));
      const sku = typeof body?.sku === 'string' ? body.sku : null;
      const zip = typeof body?.zip === 'string' ? body.zip : null;
      if (!sku || !zip) {
        return new Response(JSON.stringify({ error: 'sku and zip required' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      if (env.ENABLE_BB_ENRICHMENT !== '1') {
        return new Response(JSON.stringify({ ok: false, error: 'disabled' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const start = Date.now();
      const result = await getBestBuyStoreAvailability(env, sku, zip);
      const ms = Date.now() - start;
      console.log(JSON.stringify({ level: 'info', event: 'bb_enrich', sku, zip, stores: result.stores.length, fromCache: result.fromCache, failed: result.failed, ms }));
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
    }
    return new Response("ok");
  }
}
