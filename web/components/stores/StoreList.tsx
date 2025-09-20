"use client";
import { useState } from "react";
import StoreRow from "@/components/stores/StoreRow";

type Store = { store_id: string; name: string | null; city: string | null; zipcode: string | null };

export default function StoreList({ retailer, stores }: { retailer: "bestbuy" | "microcenter" | "newegg"; stores: Store[] }) {
  const [compact, setCompact] = useState(false);
  const [showMap, setShowMap] = useState(false);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> Compact</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showMap} onChange={(e) => setShowMap(e.target.checked)} /> Map</label>
      </div>
      {showMap && (
        <div className="border rounded p-8 text-sm text-gray-600">Map placeholder (add MapLibre/Leaflet when geo is ready)</div>
      )}
      <ul className={`divide-y border rounded ${compact ? 'text-sm' : ''}`}>
        {stores.map((s) => (
          <StoreRow key={s.store_id} retailer={retailer} store={s} />
        ))}
      </ul>
    </section>
  );
}

