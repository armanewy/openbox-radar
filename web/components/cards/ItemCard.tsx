"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Heart, Share2 } from "lucide-react";
import WatchSheet from "@/components/watch/WatchSheet";
import PriceSparkline from "@/components/cards/PriceSparkline";

export type Item = {
  id: number;
  retailer: string;
  store_id: string;
  sku: string | null;
  title: string;
  condition_label: string;
  condition_rank: string;
  price_cents: number;
  url: string;
  image_url: string | null;
  seen_at: string;
  store: { name: string | null; city: string | null; state: string | null; zipcode: string | null };
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function stalenessColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins <= 15) return "bg-green-500";
  if (mins <= 120) return "bg-amber-500";
  return "bg-gray-400";
}

export default function ItemCard({ item }: { item: Item }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.url);
    } catch {}
  }, [item.url]);
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border shadow-card p-4 bg-white/60 backdrop-blur transition-transform hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
      <div className="flex gap-4">
        {item.image_url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.title} className="h-24 w-24 object-contain rounded-lg bg-white" />
          </a>
        ) : (
          <div className="h-24 w-24 rounded-lg bg-gray-100 border shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`inline-block w-2 h-2 rounded-full ${stalenessColor(item.seen_at)}`} />
            <span>last seen {timeAgo(item.seen_at)}</span>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">
              {item.retailer}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-700">
              {item.condition_label}
            </span>
          </div>
          <a href={item.url} target="_blank" rel="noopener" className="mt-1 block font-medium hover:underline">
            {item.title}
          </a>
          <div className="mt-1 text-sm text-gray-600 truncate">
            {item.store?.name || item.store_id}
            {item.store?.city ? ` • ${item.store.city}, ${item.store.state ?? ""}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold flex items-center gap-2 justify-end">
            {dollars(item.price_cents)}
            <PriceSparkline retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} />
          </div>
          <div className="mt-2 flex items-center gap-2 justify-end">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50"
            >
              <ExternalLink size={16} /> View
            </a>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
            >
              <Heart size={16} /> Watch
            </button>
            <button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-2 border rounded-lg hover:bg-gray-50">
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>
      <WatchSheet
        open={open}
        onOpenChange={setOpen}
        defaults={{ retailer: item.retailer as any, sku: item.sku ?? undefined }}
      />
    </li>
  );
}
