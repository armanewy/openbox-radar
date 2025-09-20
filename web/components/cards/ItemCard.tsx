"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ExternalLink, Heart, Share2, ThumbsUp, MapPin, MapPinOff, Loader2 } from "lucide-react";
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
    status: "online" | "verifying" | "local";
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
  if (mins <= 15) return "bg-emerald-500";
  if (mins <= 120) return "bg-amber-500";
  return "bg-gray-400";
}

function conditionShortLabel(rank: string) {
  switch ((rank || "").toLowerCase()) {
    case "certified":
      return "Cert";
    case "excellent":
      return "Ex";
    case "satisfactory":
      return "Sat";
    case "fair":
      return "Fair";
    default:
      return "Unk";
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
  const [availabilityError, setAvailabilityError] = useState<string>("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const reduce = useReducedMotion();

  async function upvote() {
    if (voted) return;
    setVoted(true);
    try {
      const r = await fetch("/api/deal-votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventory_id: item.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.votes_24h != null) setVotes(d.votes_24h);
    } catch {}
  }

  async function checkAvailability() {
    if (!item.sku) return;
    let storedZip = "";
    try {
      storedZip = localStorage.getItem("obr_zip") || "";
    } catch {}
    if (!storedZip) {
      setAvailabilityError("Add a ZIP in the search filters to check local availability.");
      return;
    }
    setAvailabilityError("");
    setAvailabilityLoading(true);
    try {
      const res = await fetch(`/api/bestbuy/availability?sku=${encodeURIComponent(item.sku)}&zip=${encodeURIComponent(storedZip)}`);
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok || (data && typeof data === "object" && "error" in data)) {
        const message = typeof data === "object" && (data as any)?.error ? (data as any).error : "Could not check availability";
        throw new Error(message);
      }
      setAvailability(data as any);
    } catch (err: any) {
      setAvailabilityError(err?.message || "Failed to check availability");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  const enrichmentDisplay = useMemo(() => {
    if (item.retailer !== "bestbuy") return null;
    const status = item.enrichment?.status ?? "online";
    if (status === "local") {
      return {
        node: (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <MapPin className="h-4 w-4" /> Local stock verified
          </span>
        ),
        meta: item.enrichment?.refreshed_at ? `Updated ${timeAgo(item.enrichment.refreshed_at)}` : null,
      };
    }
    if (status === "verifying") {
      return {
        node: (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking nearby stores
          </span>
        ),
        meta: item.enrichment?.refreshed_at ? `Updated ${timeAgo(item.enrichment.refreshed_at)}` : null,
      };
    }
    return {
      node: (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <MapPinOff className="h-4 w-4" /> Online only
        </span>
      ),
      meta: item.enrichment?.refreshed_at ? `Updated ${timeAgo(item.enrichment.refreshed_at)}` : null,
    };
  }, [item.retailer, item.enrichment?.status, item.enrichment?.refreshed_at]);

  const availabilityDisplay = useMemo(() => {
    if (!availability) return null;
    const stores = Array.isArray(availability.stores) ? availability.stores : [];
    const available = stores.filter((s: any) => s?.hasOpenBox).length;
    if (!stores.length) {
      return {
        node: (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MapPinOff className="h-4 w-4" /> No local stock yet
          </span>
        ),
        meta: availability.refreshed_at ? `Checked ${timeAgo(availability.refreshed_at)}` : null,
      };
    }
    return {
      node: (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <MapPin className="h-4 w-4" /> {available || 0} of {stores.length} stores nearby
        </span>
      ),
      meta: availability.refreshed_at ? `Checked ${timeAgo(availability.refreshed_at)}` : null,
    };
  }, [availability]);

  const topStatus = enrichmentDisplay;
  const actionStatus = availabilityDisplay;

  return (
    <m.li
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className="rounded-2xl border border-emerald-300 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex gap-4">
        <div className="flex w-24 flex-col items-center gap-2">
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
                        width={96}
                        height={96}
                        className="h-24 w-24 rounded-xl border bg-white object-contain"
                        sizes="96px"
                      />
                    );
                  }
                } catch {}
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url!} alt={item.title} className="h-24 w-24 rounded-xl border bg-white object-contain" />
                );
              })()}
            </a>
          ) : (
            <div className="h-24 w-24 rounded-xl border bg-gray-100" />
          )}
          <div className="w-full">
            <PriceSparkline retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} w={96} h={16} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`inline-block h-2 w-2 rounded-full ${stalenessColor(item.seen_at)}`} />
              <span>{timeAgoShort(item.seen_at)}</span>
              <Badge className="hidden whitespace-nowrap px-1.5 py-0.5 text-[10px] sm:inline-flex">{item.retailer}</Badge>
              <Badge variant="success" className="whitespace-nowrap px-1.5 py-0.5 text-[10px]">
                {conditionShortLabel(item.condition_rank)}
              </Badge>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900 shadow-sm">
              {dollars(item.price_cents)}
            </span>
          </div>
          {topStatus ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {topStatus.node}
              {topStatus.meta ? <span className="text-gray-400">· {topStatus.meta}</span> : null}
            </div>
          ) : null}
          <a
            href={item.url}
            target="_blank"
            rel="noopener"
            className="text-base font-semibold leading-tight text-gray-900 hover:text-emerald-700 hover:underline"
          >
            {item.title}
          </a>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">{item.store?.name || item.store_id}</span>
            {item.store?.city ? ` • ${item.store.city}, ${item.store.state ?? ''}` : ''}
            {typeof item.distance_miles === 'number' ? ` • ${item.distance_miles.toFixed(1)} mi away` : ''}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
          {actionStatus ? actionStatus.node : null}
          {actionStatus?.meta ? <span className="text-gray-400">{actionStatus.meta}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:ring-emerald-500/40"
          >
            <Heart className="h-4 w-4" />
            <span>Watch</span>
          </Button>
          {item.retailer === 'bestbuy' && item.sku ? (
            <Button
              variant="outline"
              size="sm"
              onClick={checkAvailability}
              disabled={availabilityLoading}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              {availabilityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              <span>Local</span>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open listing"
            onClick={() => {
              track("outbound_click", { retailer: item.retailer, sku: item.sku, url: item.url, id: item.id });
              window.open(item.url, "_blank", "noopener,noreferrer");
            }}
            className="text-emerald-600 hover:bg-emerald-50"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy link"
            onClick={copy}
            className="text-gray-500 hover:bg-gray-100"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mark helpful"
              onClick={upvote}
              disabled={voted}
              className="text-gray-500 hover:bg-gray-100"
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            {typeof votes === 'number' ? <span className="text-xs text-gray-500">{votes}</span> : null}
          </div>
        </div>
      </div>

      {availabilityError ? <div className="mt-2 text-xs text-red-600">{availabilityError}</div> : null}

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
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="space-y-4 px-3 pb-3">
              <PriceHistoryChart retailer={item.retailer} sku={item.sku} url={item.url} store_id={item.store_id} />
              {item.retailer === 'bestbuy' && item.sku ? (
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Local availability</span>
                    <Button variant="outline" size="sm" onClick={checkAvailability} disabled={availabilityLoading}>
                      {availabilityLoading ? 'Checking…' : 'Refresh'}
                    </Button>
                  </div>
                  {availabilityError ? <div className="text-xs text-red-600">{availabilityError}</div> : null}
                  {availability?.stores ? (
                    <ul className="space-y-1">
                      {availability.stores.map((s: any) => (
                        <li
                          key={s.id || s.name}
                          className="flex items-center justify-between gap-2 rounded border border-emerald-50 bg-emerald-50/60 px-3 py-1.5 text-xs"
                        >
                          <span className="font-medium text-gray-700">{s.name || s.id}</span>
                          <span className={`flex items-center gap-1 ${s.hasOpenBox ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {s.hasOpenBox ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}
                            {s.hasOpenBox ? 'Available' : 'Not in stock'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-500">Check availability to see nearby stores.</div>
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
