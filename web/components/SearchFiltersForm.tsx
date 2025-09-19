"use client";
type Props = {
  q: string;
  retailer: string;
  sku: string;
  min_condition: string;
  price_min: string;
  price_max: string;
  zip: string;
  radius_miles: string;
};

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export default function SearchFiltersForm({ q, retailer, sku, min_condition, price_min, price_max, zip, radius_miles }: Props) {
  function onSubmit() {
    track('filters_apply', { q, retailer, sku, min_condition, price_min, price_max, zip, radius_miles });
  }
  return (
    <form method="GET" className="space-y-3" onSubmit={onSubmit}>
      <div>
        <label className="block text-sm text-gray-600">Search</label>
        <Input name="q" defaultValue={q} placeholder="Title or SKU" />
      </div>
      <div>
        <label className="block text-sm text-gray-600">Retailer</label>
        <select name="retailer" defaultValue={retailer} className="mt-1 w-full border rounded-lg px-3 py-2">
          <option value="">All</option>
          <option value="bestbuy">Best Buy</option>
          <option value="microcenter">Micro Center</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600">SKU</label>
        <Input name="sku" defaultValue={sku} placeholder="Exact or partial" />
      </div>
      <div>
        <label className="block text-sm text-gray-600">Min condition</label>
        <select name="min_condition" defaultValue={min_condition} className="mt-1 w-full border rounded-lg px-3 py-2">
          <option value="">Any</option>
          <option value="certified">Certified</option>
          <option value="excellent">Excellent</option>
          <option value="satisfactory">Satisfactory</option>
          <option value="fair">Fair</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm text-gray-600">Min price (USD)</label>
          <Input name="price_min" type="number" defaultValue={price_min} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Max price (USD)</label>
          <Input name="price_max" type="number" defaultValue={price_max} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm text-gray-600">ZIP</label>
          <Input name="zip" defaultValue={zip} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Radius (mi)</label>
          <Input name="radius_miles" type="number" defaultValue={radius_miles} />
        </div>
      </div>
      <Button className="w-full mt-2">Apply</Button>
    </form>
  );
}
