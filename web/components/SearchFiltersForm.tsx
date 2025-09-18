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

export default function SearchFiltersForm({ q, retailer, sku, min_condition, price_min, price_max, zip, radius_miles }: Props) {
  return (
    <form method="GET" className="space-y-3">
      <div>
        <label className="block text-sm text-gray-600">Search</label>
        <input name="q" defaultValue={q} placeholder="Title or SKU" className="mt-1 w-full border rounded-lg px-3 py-2" />
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
        <input name="sku" defaultValue={sku} placeholder="Exact or partial" className="mt-1 w-full border rounded-lg px-3 py-2" />
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
          <input name="price_min" type="number" defaultValue={price_min} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Max price (USD)</label>
          <input name="price_max" type="number" defaultValue={price_max} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm text-gray-600">ZIP</label>
          <input name="zip" defaultValue={zip} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Radius (mi)</label>
          <input name="radius_miles" type="number" defaultValue={radius_miles} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <button className="w-full mt-2 px-4 py-2 bg-black text-white rounded-lg">Apply</button>
    </form>
  );
}

