"use client";
import { useEffect, useMemo, useState } from "react";
import { useOptimisticWatch, type WatchPayload } from "@/lib/hooks/useOptimisticWatch";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaults: Partial<WatchPayload> & { retailer: "bestbuy" | "microcenter" };
};

export default function WatchSheet({ open, onOpenChange, defaults }: Props) {
  const { create, loading } = useOptimisticWatch();
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState(25);
  const [minCondition, setMinCondition] = useState("fair");
  const [priceCeiling, setPriceCeiling] = useState("");

  useEffect(() => {
    if (open) {
      setZipcode("");
      setRadius(25);
      setMinCondition("fair");
      setPriceCeiling("");
    }
  }, [open]);

  async function submit() {
    const payload: WatchPayload = {
      retailer: defaults.retailer,
      sku: defaults.sku,
      product_url: defaults.product_url,
      keywords: defaults.keywords,
      zipcode: zipcode || undefined,
      radius_miles: radius,
      stores: defaults.stores,
      price_ceiling_cents: priceCeiling ? Math.round(Number(priceCeiling) * 100) : undefined,
      min_condition: minCondition as any,
    };
    const ok = await create(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <div className={open ? "fixed inset-0 z-50" : "hidden"}>
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Watch</h2>
          <button onClick={() => onOpenChange(false)} className="px-3 py-1 rounded border">Close</button>
        </div>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">Retailer</div>
          <div className="px-2 py-1 rounded bg-gray-100 inline-block text-sm">{defaults.retailer}</div>
          {defaults.sku ? (
            <div className="text-sm text-gray-600">SKU: <span className="font-medium">{defaults.sku}</span></div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-gray-600">ZIP</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Radius (mi)</label>
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-gray-600">Min condition</label>
            <select className="mt-1 w-full border rounded px-3 py-2" value={minCondition} onChange={(e) => setMinCondition(e.target.value)}>
              <option value="certified">Certified</option>
              <option value="excellent">Excellent</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="fair">Fair</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Max price (USD)</label>
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" value={priceCeiling} onChange={(e) => setPriceCeiling(e.target.value)} />
          </div>
        </div>
        <div className="mt-auto flex justify-end gap-2">
          <button className="px-4 py-2 border rounded" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="px-4 py-2 bg-black text-white rounded" onClick={submit} disabled={loading}>{loading ? "Creating…" : "Create Watch"}</button>
        </div>
      </div>
    </div>
  );
}

