import { fetchBestBuyStore, fetchMicroCenterStore } from "./adapters/stubs";

export const Scheduler = {
  async run(env: any) {
    // TODO: query active watches/store list via Supabase REST or KV; for now, static examples
    const batches = await Promise.all([
      fetchBestBuyStore("bby-123"),
      fetchMicroCenterStore("mc-cambridge"),
    ]);

    const items = batches.flatMap((b) => b.items);
    if (items.length === 0) return { ok: true, ingested: 0 };

    const ingestUrl: string = env.INGEST_URL || '';
    if (!ingestUrl) return { ok: false, error: 'INGEST_URL not set', ingested: 0 };

    const r = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.CRON_SHARED_SECRET}`,
      },
      body: JSON.stringify({ items }),
    });

    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ingested: json.inserted ?? 0 };
  }
}
