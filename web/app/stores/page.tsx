import Link from "next/link";

export default function StoresIndex() {
  const retailers = [
    { id: "bestbuy", name: "Best Buy" },
    { id: "microcenter", name: "Micro Center" },
  ];
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Browse Stores</h1>
      <p className="text-gray-600">Pick a retailer to browse by state and see local stores.</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {retailers.map((r) => (
          <li key={r.id} className="border rounded p-4">
            <div className="font-medium">{r.name}</div>
            <Link className="mt-2 inline-block underline" href={`/stores/${r.id}`}>View states →</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

