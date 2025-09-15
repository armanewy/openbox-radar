import { getSession } from "@/lib/utils/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { absoluteUrl } from "@/lib/utils/url";

export default async function AppPage() {
  const s = getSession();
  if (!s) redirect("/?signin=1");
  return <Watches />;
}

async function Watches() {
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(absoluteUrl("/api/watches"), {
    cache: "no-store",
    headers: { cookie },
  });
  const data = (await res.json()) as { watches: any[] };
  const rows = data.watches || [];

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Watches</h1>
        <a href="/app/watches/new" className="px-3 py-2 bg-black text-white rounded">Create new</a>
      </div>
      <form className="grid grid-cols-2 gap-3" action={createWatch}>
        <select name="retailer" className="border rounded px-2 py-2">
          <option value="bestbuy">Best Buy</option>
          <option value="microcenter">Micro Center</option>
        </select>
        <input name="sku" placeholder="SKU (optional)" className="border rounded px-2 py-2" />
        <input name="zipcode" placeholder="ZIP code" required className="border rounded px-2 py-2" />
        <input name="radius_miles" type="number" defaultValue={25} className="border rounded px-2 py-2" />
        <input name="price_ceiling_usd" type="number" placeholder="Max price (USD)" className="border rounded px-2 py-2 col-span-2" />
        <button className="px-4 py-2 bg-black text-white rounded col-span-2">Add Watch</button>
      </form>

      <section>
        {rows.length === 0 ? (
          <p className="text-gray-500">No watches yet. Add one above.</p>
        ) : (
          <ul className="divide-y border rounded">
            {rows.map((w) => (
              <li key={w.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{w.retailer.toUpperCase()} {w.sku ? `• ${w.sku}` : ''}</div>
                  <div className="text-sm text-gray-600">
                    ZIP {w.zipcode || '—'} • radius {w.radius_miles || '—'}mi
                  </div>
                </div>
                <form action={deleteWatch}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className="px-3 py-2 border rounded">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentMatches />
    </main>
  );
}

async function createWatch(formData: FormData) {
  "use server";
  const payload = {
    retailer: String(formData.get("retailer")),
    sku: (formData.get("sku") || undefined) as string | undefined,
    zipcode: String(formData.get("zipcode")),
    radius_miles: Number(formData.get("radius_miles") || 25),
    price_ceiling_cents: formData.get("price_ceiling_usd") ? Math.round(Number(formData.get("price_ceiling_usd")) * 100) : undefined,
  };
  // relative path keeps it working in dev/prod
  const cookie = headers().get("cookie") ?? "";
  await fetch(absoluteUrl("/api/watches"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    // forward session cookie to API
    headers: { "content-type": "application/json", cookie },
  });
  revalidatePath("/app");
}

async function deleteWatch(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const cookie = headers().get("cookie") ?? "";
  await fetch(absoluteUrl(`/api/watches/${id}`), { method: "DELETE", cache: "no-store", headers: { cookie } });
  revalidatePath("/app");
}

async function RecentMatches() {
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(absoluteUrl("/api/matches"), { cache: "no-store", headers: { cookie } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    matches: Array<{
      watch_id: string;
      watch: { retailer: string; sku: string | null; keywords: string[] | null };
      item: {
        id: number; retailer: string; store_id: string; sku: string | null; title: string;
        condition_label: string; price_cents: number; url: string; seen_at: string;
        store_name: string | null; store_city: string | null; store_state: string | null;
      };
    }>;
  };
  const rows = data.matches || [];
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold mt-6">Recent Matches</h2>
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={`${m.item.retailer}-${m.item.store_id}-${m.item.id}`} className="border rounded p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{m.item.title}</div>
              <div className="text-sm text-gray-600">{m.item.store_name || m.item.store_id} • {m.item.store_city}{m.item.store_state ? `, ${m.item.store_state}` : ''}</div>
              <div className="text-xs text-gray-500">Watch: {m.watch.retailer.toUpperCase()} {m.watch.sku ? `• ${m.watch.sku}` : m.watch.keywords ? `• ${m.watch.keywords.join(', ')}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-semibold">${"" + (m.item.price_cents / 100).toFixed(2)}</div>
              <a href={m.item.url} target="_blank" rel="noopener" className="px-3 py-2 border rounded">View</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
