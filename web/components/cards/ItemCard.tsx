"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Heart, Share2, ThumbsUp } from "lucide-react";
import WatchSheet from "@/components/watch/WatchSheet";
import PriceSparkline from "@/components/cards/PriceSparkline";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import { Drawer, DrawerContent, DrawerHeader, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { m, useReducedMotion } from "framer-motion";
import { track } from "@/lib/analytics";

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
  distance_miles?: number | null;
  enrichment?: {
    status: 'online' | 'verifying' | 'local';
    refreshed_at?: string | null;
    stores?: Array<{ id: string; name?: string | null; city?: string | null; state?: string | null; zip?: string | null; hasOpenBox?: boolean | null }>;
  };
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

function timeAgoShort(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
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
      return 'Cert';
    case 'excellent':
      return 'Ex';
    case 'satisfactory':
      return 'Sat';
    case 'fair':
      return 'Fair';
    default:
      return 'Unk';
  }
}

export default function ItemCard({ item }: { item: Item }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.url);
    } catch {}
  }, [item.url]);
  const [open, setOpen] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [voted, setVoted] = useState(false);
  const [votes, setVotes] = useState<number | undefined>((item as any).votes_24h);
  const [availability, setAvailability] = useState<any | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string>('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  async function upvote() {
    if (voted) return;
    setVoted(true);
    try {
      const r = await fetch('/api/deal-votes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inventory_id: item.id }) });
      const d = await r.json().catch(() => ({}));
      if (d?.votes_24h != null) setVotes(d.votes_24h);
    } catch {}
  }
  const reduce = useReducedMotion();

  async function checkAvailability() {
    if (!item.sku) return;
    let storedZip = '';
    try {
      storedZip = localStorage.getItem('obr_zip') || '';
    } catch {}
    if (!storedZip) {
      setAvailabilityError('Add a ZIP in the search filters to check local availability.');
      return;
    }
    setAvailabilityError('');
    setAvailabilityLoading(true);
    try {
      const res = await fetch(`/api/bestbuy/availability?sku=${encodeURIComponent(item.sku)}&zip=${encodeURIComponent(storedZip)}`);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
        const message = typeof data === 'object' && data?.error ? data.error : 'Could not check availability';
        throw new Error(message);
      }
      setAvailability(data as any);
    } catch (err: any) {
      setAvailabilityError(err?.message || 'Failed to check availability');
    } finally {
      setAvailabilityLoading(false);
    }
  }

  return (
    <m.li whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.99 }} className="rounded-xl border border-gray-300 shadow p-2.5 bg-white overflow-hidden">
      <div className="flex gap-3">
        <div className="shrink-0 w-[72px]">
          {item.image_url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
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
            <div className="h-[72px] w-[72px] rounded-lg bg-gray-100 border" />
          )}
          <button className="mt-1 w-full" onClick={() => setOpenHistory(true)} title="View price history">
            <PriceSparkline retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} w={72} h={12} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-600">
            <div className="min-w-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
              <span className={`inline-block w-2 h-2 rounded-full ${stalenessColor(item.seen_at)}`} />
              <span>{timeAgoShort(item.seen_at)}</span>
              <Badge className="whitespace-nowrap px-1 py-0.5 text-[10px] hidden sm:inline-flex">{item.retailer}</Badge>
              <Badge variant="success" className="whitespace-nowrap px-1 py-0.5 text-[10px]">{conditionShortLabel(item.condition_rank)}</Badge>
            </div>
            <span className="shrink-0 inline-block rounded-md bg-black text-white text-xs font-semibold px-2 py-1 shadow">
              {dollars(item.price_cents)}
            </span>
          </div>
          {item.enrichment?.status && (
            <div className="mt-1 text-[11px] flex items-center gap-2 text-gray-600">
              {item.enrichment.status === 'local' ? (
                <Badge variant="success" className="text-[10px]">Local availability verified</Badge>
              ) : item.enrichment.status === 'verifying' ? (
                <span>Checking local availability…</span>
              ) : (
                <span>Online only</span>
              )}
              {item.enrichment.refreshed_at ? (
                <span className="text-gray-400">· updated {timeAgo(item.enrichment.refreshed_at)}</span>
              ) : null}
            </div>
          )}
          <a href={item.url} target="_blank" rel="noopener" className="mt-1 block text-sm font-medium leading-snug hover:underline line-clamp-2">
            {item.title}
          </a>
          <div className="mt-1 text-[11px] text-gray-700 truncate">
            {item.sku ? <span className="mr-2">{item.sku}</span> : null}
            <span>
              {item.store?.name || item.store_id}
              {item.store?.city ? ` • ${item.store.city}, ${item.store.state ?? ""}` : ""}
              {typeof item.distance_miles === 'number' ? (
                <span className="text-gray-500"> {` (~${item.distance_miles.toFixed(1)} mi)`}</span>
              ) : null}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <div className="text-right shrink-0">
              <div className="mt-1 flex items-center gap-1 flex-wrap sm:flex-nowrap justify-end">
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => track('outbound_click', { retailer: item.retailer, sku: item.sku, url: item.url, id: item.id })}>
                  <Button variant="outline" size="sm" className="inline-flex gap-1">
                    <ExternalLink size={14} />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                </a>
                <Button variant="brand" size="sm" className="inline-flex gap-1" onClick={() => setOpen(true)}><Heart size={14} /> Watch</Button>
                <Button variant="outline" size="sm" className="inline-flex gap-1" onClick={copy}>
                  <Share2 size={14} />
                  <span className="hidden sm:inline">Share</span>
                </Button>
                {item.retailer === 'bestbuy' && item.sku ? (
                  <Button variant="outline" size="sm" className="inline-flex gap-1" onClick={checkAvailability} disabled={availabilityLoading}>
                    <span>{availabilityLoading ? 'Checking…' : 'Local availability'}</span>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="inline-flex gap-1" onClick={upvote} disabled={voted} title="Mark helpful">
                  <ThumbsUp size={14} />
                  <span className="hidden sm:inline">Helpful{typeof votes === 'number' ? ` (${votes})` : ''}</span>
                </Button>
              </div>
              </div>
            </div>
          </div>
          {availabilityError ? <div className="text-xs text-red-600 mt-2">{availabilityError}</div> : null}
          {availability?.stores && (
            <div className="mt-2 text-xs text-gray-700 space-y-1">
              <div className="text-gray-500">Last checked {availability.refreshed_at ? timeAgo(availability.refreshed_at) : 'just now'}</div>
              {availability.stores.length ? (
                <ul className="space-y-1">
                  {availability.stores.slice(0, 4).map((s: any) => (
                    <li key={s.id || s.name} className="flex items-center justify-between gap-2">
                      <span>{s.name || s.id}</span>
                      <span className={`text-[11px] ${s.hasOpenBox ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {s.hasOpenBox ? 'Available' : 'Not in stock'}
                      </span>
                    </li>
                  ))}
                  {availability.stores.length > 4 ? <li className="text-gray-500">and {availability.stores.length - 4} more…</li> : null}
                </ul>
              ) : (
                <div>No local availability yet.</div>
              )}
            </div>
          )}
      </div>
      <WatchSheet
        open={open}
        onOpenChange={setOpen}
        defaults={{ retailer: item.retailer as any, sku: item.sku ?? undefined }}
      />
      <Drawer open={openHistory} onOpenChange={setOpenHistory}>
        <DrawerContent side="right">
          <div className="flex h-full flex-col gap-3">
            <DrawerHeader>
              <h3 className="text-lg font-semibold">Price History</h3>
              <DrawerClose asChild>
                <Button variant="outline" size="sm">Close</Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-3 pb-3">
              <PriceHistoryChart retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} />
              {item.retailer === 'bestbuy' && item.sku ? (
                <div className="mt-4 space-y-2">
                  <Button variant="outline" size="sm" onClick={checkAvailability} disabled={availabilityLoading}>
                    {availabilityLoading ? 'Checking local availability…' : 'Check local availability'}
                  </Button>
                  {availabilityError ? <div className="text-xs text-red-600">{availabilityError}</div> : null}
                  {availability?.stores && (
                    <div className="text-xs text-gray-700 space-y-1">
                      <div className="text-gray-500">Last checked {availability.refreshed_at ? timeAgo(availability.refreshed_at) : 'just now'}</div>
                      {availability.stores.length ? (
                        <ul className="space-y-1">
                          {availability.stores.slice(0, 6).map((s: any) => (
                            <li key={s.id || s.name} className="flex items-center justify-between gap-2">
                              <span>{s.name || s.id}</span>
                              <span className={`text-[11px] ${s.hasOpenBox ? 'text-emerald-600' : 'text-gray-500'}`}>
                                {s.hasOpenBox ? 'Available' : 'Not in stock'}
                              </span>
                            </li>
                          ))}
                          {availability.stores.length > 6 ? <li className="text-gray-500">and {availability.stores.length - 6} more…</li> : null}
                        </ul>
                      ) : (
                        <div>No local availability yet.</div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </m.li>
  );
}
