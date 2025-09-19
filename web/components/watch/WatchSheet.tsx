"use client";
import { useEffect, useState } from "react";
import { useOptimisticWatch, type WatchPayload } from "@/lib/hooks/useOptimisticWatch";
import { Drawer, DrawerContent, DrawerHeader, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setZipcode("");
      setRadius(25);
      setMinCondition("fair");
      setPriceCeiling("");
    }
  }, [open]);

  async function submit() {
    setErr("");
    const payload: WatchPayload & { email?: string; next?: string } = {
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
    if (email) (payload as any).email = email;
    (payload as any).next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app';
    const ok = await create(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right">
        <div className="flex h-full flex-col gap-4">
          <DrawerHeader>
            <h2 className="text-lg font-semibold">Create Watch</h2>
            <DrawerClose asChild>
              <Button variant="outline" size="sm">Close</Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="px-1 space-y-3">
            <div className="text-sm text-gray-600">Retailer</div>
            <div className="px-2 py-1 rounded bg-gray-100 inline-block text-sm">{defaults.retailer}</div>
            {defaults.sku ? (
              <div className="text-sm text-gray-600">SKU: <span className="font-medium">{defaults.sku}</span></div>
            ) : null}
          </div>
          <div className="px-1">
            <label className="block text-sm text-gray-600">Email (to activate alerts)</label>
            <Input className="mt-1" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">No password; we’ll send a magic link.</p>
            {err ? <p className="text-sm text-red-600 mt-1">{err}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div>
              <label className="block text-sm text-gray-600">ZIP</label>
              <Input className="mt-1" value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Radius (mi)</label>
              <Input className="mt-1" type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
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
              <Input className="mt-1" type="number" value={priceCeiling} onChange={(e) => setPriceCeiling(e.target.value)} />
            </div>
          </div>
          <div className="mt-auto flex justify-end gap-2 px-1 pb-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Creating…" : "Create Watch"}</Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
