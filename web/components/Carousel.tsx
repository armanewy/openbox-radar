"use client";
import ItemCard, { type Item } from "@/components/cards/ItemCard";

export default function Carousel({ items }: { items: Item[] }) {
  return (
    <div className="overflow-x-auto">
      <ul className="flex gap-4 snap-x snap-mandatory pr-4">
        {items.map((it) => (
          <li key={`${it.retailer}-${it.store_id}-${it.id}`} className="snap-start min-w-[360px] max-w-[380px]">
            <ItemCard item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}
