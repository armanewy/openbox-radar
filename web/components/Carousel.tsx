"use client";
import ItemCard, { type Item } from "@/components/cards/ItemCard";

export default function Carousel({ items }: { items: Item[] }) {
  return (
    <div className="overflow-x-auto">
      <ul className="flex gap-3 snap-x snap-mandatory pr-3">
        {items.map((it) => (
          <li key={`${it.retailer}-${it.store_id}-${it.id}`} className="snap-start min-w-[320px] max-w-[360px]">
            <ItemCard item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

