"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import WatchSheet from "@/components/watch/WatchSheet";

function toKeywords(q: string | undefined) {
  if (!q) return undefined;
  const parts = q.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  return parts;
}

export default function SaveSearchButton({ params }: { params: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const defaults = useMemo(() => {
    const retailer = params.retailer === 'bestbuy' || params.retailer === 'microcenter' ? (params.retailer as 'bestbuy'|'microcenter') : undefined;
    const stores = params.store_id ? params.store_id.split(',').filter(Boolean) : undefined;
    const keywords = toKeywords(params.q);
    const min_condition = params.min_condition as any | undefined;
    const radius_miles = params.radius_miles ? Number(params.radius_miles) : undefined;
    const price_ceiling_cents = params.price_max ? Math.round(Number(params.price_max) * 100) : undefined;
    const zipcode = params.zip || undefined;
    const sku = params.sku || undefined;
    return { retailer, stores, keywords, min_condition, radius_miles, price_ceiling_cents, zipcode, sku } as any;
  }, [params]);

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>Save search</Button>
      <WatchSheet open={open} onOpenChange={setOpen} defaults={defaults} />
    </>
  );
}

