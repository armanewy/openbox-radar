import Link from "next/link";
import { db } from "@/lib/drizzle/db";
import { stores } from "@/lib/drizzle/schema";
import { eq, sql } from "drizzle-orm";

export default async function RetailerStates({ params }: { params: { retailer: string } }) {
  const retailer = params.retailer;
  // distinct states for retailer with counts
  const rows = await db.execute(sql`
    select state, count(*) as count
    from stores
    where retailer = ${retailer}
    group by state
    order by state asc
  `);

  const states = (rows.rows as any[])
    .map((r) => ({ state: r.state as string | null, count: Number(r.count) }))
    .filter((r) => r.state && r.state.trim().length);

  const label = (id: string) => id === "bestbuy" ? "Best Buy" : id === "microcenter" ? "Micro Center" : id === "newegg" ? "Newegg" : id;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{label(retailer)} — States</h1>
      {states.length === 0 ? (
        <p className="text-gray-600">No states found for this retailer.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {states.map((s) => (
            <li key={s.state} className="border rounded p-4 flex items-center justify-between">
              <div className="font-medium">{s.state}</div>
              <Link className="underline" href={`/stores/${retailer}/${encodeURIComponent(s.state!)}`}>{s.count} stores →</Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/stores" className="inline-block underline">← Back to retailers</Link>
    </main>
  );
}

