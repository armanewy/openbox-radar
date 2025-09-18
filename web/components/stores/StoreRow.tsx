"use client";
import Link from "next/link";
import { useState } from "react";
import WatchSheet from "@/components/watch/WatchSheet";

type Props = {
  retailer: "bestbuy" | "microcenter";
  store: { store_id: string; name: string | null; city: string | null; zipcode: string | null };
};

export default function StoreRow({ retailer, store }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <li className="p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-medium">{store.name}</div>
        <div className="text-sm text-gray-600">{store.city || ""} {store.zipcode ? `• ${store.zipcode}` : ""}</div>
      </div>
      <div className="flex items-center gap-2">
        <Link className="px-3 py-2 border rounded" href={`/search?retailer=${encodeURIComponent(retailer)}&store_id=${encodeURIComponent(store.store_id)}`}>
          Browse inventory
        </Link>
        <button className="px-3 py-2 bg-black text-white rounded" onClick={() => setOpen(true)}>Watch this store</button>
        <WatchSheet open={open} onOpenChange={setOpen} defaults={{ retailer, stores: [store.store_id] }} />
      </div>
    </li>
  );
}

