"use client";
import { useRouter, useSearchParams } from "next/navigation";

const baseOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "newest", label: "Newest" },
];

export default function SortMenu() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("sort") || "relevance";
  const retailer = sp.get("retailer");
  const options = [...baseOptions];
  if (retailer === 'bestbuy') options.push({ value: 'discount_desc', label: 'Discount %' });

  return (
    <label className="text-sm text-gray-700 inline-flex items-center gap-2">
      Sort
      <select
        className="border rounded px-2 py-1"
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("sort", e.target.value);
          next.delete("cursor");
          router.push(`/search?${next.toString()}`);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
