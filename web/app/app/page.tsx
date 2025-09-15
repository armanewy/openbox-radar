import { getSession } from "@/lib/utils/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function AppPage() {
  const s = getSession();
  if (!s) redirect("/?signin=1");
  return <Watches />;
}

async function Watches() {
  const res = await fetch("/api/watches", { cache: "no-store" });
  const data = (await res.json()) as { watches: any[] };
  const rows = data.watches || [];

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Your Watches</h1>
      <form className="grid grid-cols-2 gap-3" action={createWatch}>
        <select name="retailer" className="border rounded px-2 py-2">
          <option value="bestbuy">Best Buy</option>
          <option value="microcenter">Micro Center</option>
        </select>
        <input name="sku" placeholder="SKU (optional)" className="border rounded px-2 py-2" />
        <input name="zipcode" placeholder="ZIP code" required className="border rounded px-2 py-2" />
        <input name="radius_miles" type="number" defaultValue={25} className="border rounded px-2 py-2" />
        <input name="price_ceiling_cents" type="number" placeholder="Max price (cents)" className="border rounded px-2 py-2 col-span-2" />
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
    price_ceiling_cents: formData.get("price_ceiling_cents") ? Number(formData.get("price_ceiling_cents")) : undefined,
  };
  // relative path keeps it working in dev/prod
  await fetch("/api/watches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  revalidatePath("/app");
}

async function deleteWatch(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await fetch(`/api/watches/${id}`, { method: "DELETE", cache: "no-store" });
  revalidatePath("/app");
}
