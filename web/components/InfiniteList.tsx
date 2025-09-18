"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ItemCard, { type Item } from "@/components/cards/ItemCard";

type Props = {
  fetchUrl: string; // base URL for /api/inventory/search
  baseParams: Record<string, string | number | undefined>;
  initialItems: Item[];
  initialNextCursor: string | null | undefined;
};

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length) u.set(k, String(v));
  }
  return u.toString();
}

export default function InfiniteList({ fetchUrl, baseParams, initialItems, initialNextCursor }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const qp = buildQuery({ ...baseParams, cursor, limit: 20 });
    const res = await fetch(`${fetchUrl}?${qp}`);
    const data = (await res.json()) as { items: Item[]; nextCursor?: string | null };
    setItems((prev) => [...prev, ...data.items]);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  }, [cursor, loading, baseParams, fetchUrl]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const obs = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div>
      <ul className="space-y-3">
        {items.map((it) => (
          <ItemCard key={`${it.retailer}-${it.store_id}-${it.id}`} item={it} />
        ))}
      </ul>
      {cursor && (
        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 border rounded"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
          <div ref={loadMoreRef} className="h-1" />
        </div>
      )}
    </div>
  );
}

