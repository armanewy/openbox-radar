import Link from "next/link";
import { db } from "@/lib/drizzle/db";
import { stores } from "@/lib/drizzle/schema";
import { and, eq } from "drizzle-orm";

export default async function RetailerStateStores({ params }: { params: { retailer: string; state: string } }) {
  const retailer = params.retailer;
  const state = decodeURIComponent(params.state);

  const rows = await db
    .select({
      store_id: stores.store_id,
      name: stores.name,
      city: stores.city,
      zipcode: stores.zipcode,
    })
    .from(stores)
    .where(and(eq(stores.retailer, retailer as any), eq(stores.state, state)))
    .orderBy(stores.city, stores.name);

  const label = (id: string) => id === "bestbuy" ? "Best Buy" : id === "microcenter" ? "Micro Center" : id;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{label(retailer)} — {state}</h1>
      {rows.length === 0 ? (
        <p className="text-gray-600">No stores found in this state.</p>
      ) : (
        <ul className="divide-y border rounded">
          {rows.map((s) => (
            <li key={s.store_id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-600">{s.city || ""} {s.zipcode ? `• ${s.zipcode}` : ""}</div>
              </div>
              <Link className="px-3 py-2 border rounded" href={`/search?retailer=${encodeURIComponent(retailer)}&store_id=${encodeURIComponent(s.store_id)}`}>
                Browse inventory
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/stores/${retailer}`} className="inline-block underline">← Back to states</Link>
    </main>
  );
}

