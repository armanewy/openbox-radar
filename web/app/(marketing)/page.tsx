"use client";
import { useEffect, useState } from "react";
import SearchHero from "@/components/SearchHero";
import Carousel from "@/components/Carousel";
import BestBuyAttribution from "@/components/BestBuyAttribution";
import HowItWorks from "@/components/HowItWorks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Page() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [nextParam, setNextParam] = useState<string | null>(null);
  const [trending, setTrending] = useState<Array<any>>([]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, next: nextParam ?? undefined }),
    });
    if (r.ok) setSent(true);
    else setErr("Could not send link. Try again.");
  }

  // capture ?next= for magic link flow
  if (typeof window !== 'undefined' && nextParam === null) {
    const u = new URL(window.location.href);
    const n = u.searchParams.get('next');
    if (n) setNextParam(n);
  }

  useEffect(() => {
    fetch('/api/inventory/trending?limit=8&type=recent')
      .then((r) => r.json())
      .then((d) => setTrending(d.items || []))
      .catch(() => {});
  }, []);

  return (
    <main className="container mx-auto max-w-7xl p-6 space-y-10">
      <SearchHero />
      <HowItWorks />

      <form onSubmit={sendLink} className="mt-2 flex gap-2 max-w-xl">
        <Input type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        <Button variant="brand" className="h-10">Send sign-in link</Button>
      </form>

      {sent && <p className="mt-3 text-green-700">Check your email for the sign-in link.</p>}
      {err && <p className="mt-3 text-red-600">{err}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Trending now</h2>
        {trending.length === 0 ? (
          <p className="text-gray-600">No items yet — try adding a watch and running cron.</p>
        ) : (
          <Carousel items={trending} />
        )}
        {trending.some((it: any) => it.retailer === 'bestbuy') ? <BestBuyAttribution /> : null}
      </section>

      <a href="/app" className="inline-block mt-2 underline">Go to app</a>
    </main>
  );
}
