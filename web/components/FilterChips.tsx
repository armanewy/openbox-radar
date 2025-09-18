"use client";
import { useRouter, useSearchParams } from "next/navigation";

type Chip = { key: string; label: string; value: string };

function buildChips(sp: URLSearchParams): Chip[] {
  const chips: Chip[] = [];
  const pairs: Array<[string, string, string]> = [
    ["q", "Query", sp.get("q") || ""],
    ["retailer", "Retailer", sp.get("retailer") || ""],
    ["sku", "SKU", sp.get("sku") || ""],
    ["min_condition", "Min condition", sp.get("min_condition") || ""],
    ["price_min", "Min $", sp.get("price_min") || ""],
    ["price_max", "Max $", sp.get("price_max") || ""],
    ["zip", "ZIP", sp.get("zip") || ""],
    ["radius_miles", "Radius", sp.get("radius_miles") || ""],
  ];
  for (const [k, label, v] of pairs) {
    if (v) chips.push({ key: k, label, value: v });
  }
  return chips;
}

export default function FilterChips() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chips = buildChips(new URLSearchParams(searchParams.toString()));

  if (!chips.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          title={`Remove ${c.label}`}
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            next.delete(c.key);
            next.delete("cursor");
            router.push(`/search?${next.toString()}`);
          }}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
        >
          <span className="text-gray-700">
            {c.label}: <span className="font-medium">{c.value}</span>
          </span>
          <span className="text-gray-400">×</span>
        </button>
      ))}
      <button
        onClick={() => {
          router.push("/search");
        }}
        className="ml-1 text-sm text-gray-600 underline"
      >
        Clear all
      </button>
    </div>
  );
}

