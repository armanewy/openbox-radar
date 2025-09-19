export type Match = { watchId: string; count: number };

function baseUrlFromIngest(ingestUrl: string): string {
  try {
    const u = new URL(ingestUrl);
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export async function findMatches(env: any): Promise<Match[]> {
  const base = baseUrlFromIngest(env.INGEST_URL || '');
  if (!base) return [];
  const auth = `Bearer ${env.CRON_SHARED_SECRET}`;
  const r = await fetch(`${base}/api/alerts/watches`, { headers: { authorization: auth } });
  if (!r.ok) return [];
  const json: any = await r.json();
  const ws: any[] = json?.watches || [];
  const out: Match[] = [];
  for (const w of ws) {
    const m = await fetch(`${base}/api/alerts/match?watch_id=${encodeURIComponent(w.id)}&limit=5`, { headers: { authorization: auth } });
    if (!m.ok) continue;
    const matches = (await m.json())?.items || [];
    if (matches.length) {
      const ids = matches.map((x: any) => x.id);
      await fetch(`${base}/api/alerts/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth },
        body: JSON.stringify({ watchId: w.id, inventoryIds: ids }),
      });
      out.push({ watchId: w.id, count: ids.length });
    }
  }
  return out;
}
