"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [retailer, setRetailer] = useState("");
  const [minCondition, setMinCondition] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (retailer) u.set("retailer", retailer);
    if (minCondition) u.set("min_condition", minCondition);
    router.push(`/search?${u.toString()}`);
  }

  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold">Catch open-box deals before they’re gone.</h1>
      <p className="text-gray-600">Search by SKU, product, or keywords.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search open-box (title or SKU)"
          className="border rounded-xl px-4 py-3 flex-1"
        />
        <button className="px-5 py-3 bg-black text-white rounded-xl">Search</button>
      </form>
      <div className="flex items-center gap-2 text-sm">
        <span>Quick filters:</span>
        <button onClick={() => setRetailer(retailer === "bestbuy" ? "" : "bestbuy")} className={`px-3 py-1.5 rounded-full border ${retailer === 'bestbuy' ? 'bg-black text-white' : 'bg-white'}`}>Best Buy</button>
        <button onClick={() => setRetailer(retailer === "microcenter" ? "" : "microcenter")} className={`px-3 py-1.5 rounded-full border ${retailer === 'microcenter' ? 'bg-black text-white' : 'bg-white'}`}>Micro Center</button>
        <button onClick={() => setMinCondition(minCondition === "excellent" ? "" : "excellent")} className={`px-3 py-1.5 rounded-full border ${minCondition === 'excellent' ? 'bg-black text-white' : 'bg-white'}`}>Excellent+</button>
      </div>
    </section>
  );
}

