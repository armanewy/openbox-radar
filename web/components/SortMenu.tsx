"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const baseOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "newest", label: "Newest" },
  { value: "upvoted", label: "Most upvoted (24h)" },
];

export default function SortMenu() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("sort") || "relevance";
  const retailer = sp.get("retailer");
  const options = [...baseOptions];
  if (retailer === 'bestbuy') options.push({ value: 'discount_desc', label: 'Discount %' });

  const currentLabel = options.find((o) => o.value === current)?.label || "Relevance";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Sort: {currentLabel}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => {
            const next = new URLSearchParams(sp.toString());
            next.set("sort", o.value);
            next.delete("cursor");
            router.push(`/search?${next.toString()}`);
          }}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
