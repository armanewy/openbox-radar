import { getSession } from "@/lib/utils/auth";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const s = getSession();
  if (!s) redirect("/?signin=1");
  return <Watches />;
}

async function Watches() {
  // In a moment we’ll fetch actual watches.
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
      <p className="text-gray-500">Watches will show here once we wire the list.</p>
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
}
