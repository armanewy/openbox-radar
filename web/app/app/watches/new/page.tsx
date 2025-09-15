"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Retailer = "bestbuy" | "microcenter";
type StateItem = { state: string; count: number };
type StoreItem = { store_id: string; name: string | null; city: string | null; zipcode: string | null };

export default function NewWatchWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [retailer, setRetailer] = useState<Retailer>("bestbuy");

  // Step 2
  const [useStores, setUseStores] = useState(false);
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState(25);
  const [states, setStates] = useState<StateItem[]>([]);
  const [stateSel, setStateSel] = useState<string>("");
  const [storeOptions, setStoreOptions] = useState<StoreItem[]>([]);
  const [storesSel, setStoresSel] = useState<string[]>([]);

  // Step 3
  const [productUrl, setProductUrl] = useState("");
  const [keywords, setKeywords] = useState("");

  // Step 4
  const [minCondition, setMinCondition] = useState("fair");
  const [priceCeiling, setPriceCeiling] = useState<string>("");

  useEffect(() => {
    if (useStores) {
      fetch(`/api/stores?retailer=${retailer}`).then(r => r.json()).then((d) => setStates(d.states || []));
    }
  }, [useStores, retailer]);

  useEffect(() => {
    if (useStores && stateSel) {
      fetch(`/api/stores?retailer=${retailer}&state=${encodeURIComponent(stateSel)}`)
        .then(r => r.json()).then((d) => setStoreOptions(d.stores || []));
    } else {
      setStoreOptions([]);
      setStoresSel([]);
    }
  }, [useStores, retailer, stateSel]);

  async function submit() {
    const payload: any = {
      retailer,
      zipcode: useStores ? undefined : zipcode,
      radius_miles: useStores ? undefined : radius,
      stores: useStores ? storesSel : undefined,
      product_url: productUrl || undefined,
      keywords: keywords ? keywords.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      min_condition: minCondition,
      // interpret USD → cents
      price_ceiling_cents: priceCeiling ? Math.round(Number(priceCeiling) * 100) : undefined,
    };
    const r = await fetch("/api/watches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) {
      router.push("/app");
    } else {
      alert("Could not create watch");
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Create a New Watch</h1>

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="font-medium">Step 1: Pick retailer</h2>
          <select value={retailer} onChange={(e) => setRetailer(e.target.value as Retailer)} className="border rounded px-3 py-2">
            <option value="bestbuy">Best Buy</option>
            <option value="microcenter">Micro Center</option>
          </select>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => router.push("/app")}>Cancel</button>
            <button className="px-4 py-2 bg-black text-white rounded" onClick={() => setStep(2)}>Next</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="font-medium">Step 2: Location</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useStores} onChange={(e) => setUseStores(e.target.checked)} />
            Pick specific stores instead of ZIP + radius
          </label>
          {!useStores ? (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="ZIP code" value={zipcode} onChange={(e) => setZipcode(e.target.value)} className="border rounded px-3 py-2" />
              <input type="number" placeholder="Radius (mi)" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="border rounded px-3 py-2" />
            </div>
          ) : (
            <div className="space-y-2">
              <select value={stateSel} onChange={(e) => setStateSel(e.target.value)} className="border rounded px-3 py-2">
                <option value="">Select a state</option>
                {states.map((s) => (
                  <option key={s.state} value={s.state}>{s.state} ({s.count})</option>
                ))}
              </select>
              {stateSel && (
                <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                  {storeOptions.map((s) => (
                    <label key={s.store_id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={storesSel.includes(s.store_id)}
                        onChange={(e) => {
                          setStoresSel((prev) => e.target.checked ? [...prev, s.store_id] : prev.filter((x) => x !== s.store_id));
                        }}
                      />
                      <span>{s.name || s.store_id} {s.city ? `• ${s.city}` : ''} {s.zipcode ? `(${s.zipcode})` : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <button className="px-4 py-2 border rounded" onClick={() => setStep(1)}>Back</button>
            <button className="px-4 py-2 bg-black text-white rounded" onClick={() => setStep(3)}>Next</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <h2 className="font-medium">Step 3: Keywords or Product URL</h2>
          <input placeholder="Paste product URL (optional)" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} className="w-full border rounded px-3 py-2" />
          <input placeholder="Keywords (comma-separated)" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full border rounded px-3 py-2" />
          <div className="flex justify-between">
            <button className="px-4 py-2 border rounded" onClick={() => setStep(2)}>Back</button>
            <button className="px-4 py-2 bg-black text-white rounded" onClick={() => setStep(4)}>Next</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3">
          <h2 className="font-medium">Step 4: Filters</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600">Min condition</label>
              <select value={minCondition} onChange={(e) => setMinCondition(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="certified">Certified</option>
                <option value="excellent">Excellent</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="fair">Fair</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">Max price (optional, USD)</label>
              <input type="number" placeholder="e.g. 999.99" value={priceCeiling} onChange={(e) => setPriceCeiling(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-between">
            <button className="px-4 py-2 border rounded" onClick={() => setStep(3)}>Back</button>
            <button className="px-4 py-2 bg-black text-white rounded" onClick={submit}>Create Watch</button>
          </div>
        </section>
      )}
    </main>
  );
}
