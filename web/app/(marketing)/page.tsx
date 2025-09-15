"use client";
import { useState } from "react";

export default function Page() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (r.ok) setSent(true);
    else setErr("Could not send link. Try again.");
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
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

      <a href="/app" className="inline-block mt-6 underline">Go to app</a>
    </main>
  );
}
