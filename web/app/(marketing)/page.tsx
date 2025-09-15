"use client";
import { useState } from "react";
import { useEffect } from "react";

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
    <main className="max-w-3xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-semibold">Catch open-box deals before they’re gone.</h1>
      <p className="mt-4 text-gray-600">Browse before login. Search, filter, and jump right in.</p>

      <form action="/search" method="GET" className="mt-6 flex gap-2">
        <input
          name="q"
          placeholder="Search open-box deals (title or SKU)"
          className="border rounded px-3 py-3 flex-1"
        />
        <button className="px-5 py-3 bg-black text-white rounded">Search</button>
      </form>

      <form onSubmit={sendLink} className="mt-8 flex gap-2">
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button className="px-4 py-2 bg-black text-white rounded">Send sign-in link</button>
      </form>

      {sent && <p className="mt-3 text-green-700">Check your email for the sign-in link.</p>}
      {err && <p className="mt-3 text-red-600">{err}</p>}

      <section>
        <h2 className="text-xl font-semibold mt-8">Trending now</h2>
        {trending.length === 0 ? (
          <p className="text-gray-600">No items yet — try adding a watch and running cron.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {trending.map((it) => (
              <li key={`${it.retailer}-${it.store_id}-${it.id}`} className="border rounded p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-sm text-gray-600">{it.store?.name || it.store_id} {it.store?.city ? `• ${it.store.city}, ${it.store.state ?? ''}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">${"" + (it.price_cents / 100).toFixed(2)}</div>
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border rounded">View</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <a href="/app" className="inline-block mt-6 underline">Go to app</a>
    </main>
  );
}
