import Link from "next/link";
import StoreList from "@/components/stores/StoreList";
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

  const label = (id: string) => id === "bestbuy" ? "Best Buy" : id === "microcenter" ? "Micro Center" : id === "newegg" ? "Newegg" : id;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{label(retailer)} — {state}</h1>
      {rows.length === 0 ? (
        <p className="text-gray-600">No stores found in this state.</p>
      ) : (
        <StoreList retailer={retailer as any} stores={rows} />
      )}
      <Link href={`/stores/${retailer}`} className="inline-block underline">← Back to states</Link>
    </main>
  );
}
