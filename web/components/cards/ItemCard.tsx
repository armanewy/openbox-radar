"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Heart, Share2 } from "lucide-react";
import WatchSheet from "@/components/watch/WatchSheet";
import PriceSparkline from "@/components/cards/PriceSparkline";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

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

function conditionShortLabel(rank: string) {
  switch ((rank || '').toLowerCase()) {
    case 'certified':
      return 'Certified';
    case 'excellent':
      return 'Excellent';
    case 'satisfactory':
      return 'Satisfactory';
    case 'fair':
      return 'Fair';
    default:
      return 'Unknown';
  }
}

export default function ItemCard({ item }: { item: Item }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.url);
    } catch {}
  }, [item.url]);
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border shadow-card p-2.5 bg-white/60 backdrop-blur overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
      <div className="flex gap-3">
        {item.image_url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block shrink-0">
            {(() => {
              try {
                const u = new URL(item.image_url!);
                const isBbyCdn = u.hostname.endsWith("bbystatic.com");
                if (isBbyCdn) {
                  return (
                    <Image
                      src={item.image_url!}
                      alt={item.title}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] object-contain rounded-lg bg-white border"
                      sizes="72px"
                    />
                  );
                }
              } catch {}
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url!} alt={item.title} className="h-[72px] w-[72px] object-contain rounded-lg bg-white border" />
              );
            })()}
          </a>
        ) : (
          <div className="h-[72px] w-[72px] rounded-lg bg-gray-100 border shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
            <div className="min-w-0 flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <span className={`inline-block w-2 h-2 rounded-full ${stalenessColor(item.seen_at)}`} />
              <span>last seen {timeAgo(item.seen_at)}</span>
              <Badge className="whitespace-nowrap">{item.retailer}</Badge>
              <Badge variant="success" className="whitespace-nowrap">{conditionShortLabel(item.condition_rank)}</Badge>
            </div>
            <span className="shrink-0 inline-block rounded-md bg-black text-white text-xs font-semibold px-2 py-1 shadow">
              {dollars(item.price_cents)}
            </span>
          </div>
          <a href={item.url} target="_blank" rel="noopener" className="mt-1 block text-sm font-medium leading-snug hover:underline line-clamp-2">
            {item.title}
          </a>
          <div className="mt-1 text-[11px] text-gray-600 truncate">
            {item.sku ? <span className="mr-2">{item.sku}</span> : null}
            <span>{item.store?.name || item.store_id}{item.store?.city ? ` • ${item.store.city}, ${item.store.state ?? ""}` : ""}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="hidden sm:block">
              <PriceSparkline retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} w={64} h={14} />
            </div>
            <div className="text-right shrink-0">
              <div className="mt-1 flex items-center gap-1.5 justify-end">
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
                  <Button variant="outline" size="sm" className="inline-flex gap-1"><ExternalLink size={14} /> View</Button>
                </a>
                <Button size="sm" className="inline-flex gap-1" onClick={() => setOpen(true)}><Heart size={14} /> Watch</Button>
                <Button variant="outline" size="sm" className="inline-flex gap-1" onClick={copy}><Share2 size={14} /> Share</Button>
              </div>
            </div>
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
