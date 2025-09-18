"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

type Props = {
  retailer: string;
  sku?: string | null;
  url?: string | null;
  store_id?: string | null;
};

type Point = { t: string; p: number };

export default function PriceSparkline({ retailer, sku, url, store_id }: Props) {
  const [data, setData] = useState<Point[] | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams();
    qp.set("retailer", retailer);
    if (sku) qp.set("sku", sku);
    if (!sku && url) qp.set("url", url);
    if (store_id) qp.set("store_id", store_id);
    qp.set("limit", "7");
    fetch(`/api/inventory/history?${qp.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d.points || []))
      .catch(() => setData([]));
  }, [retailer, sku, url, store_id]);

  if (!data || data.length < 2) return null;

  const min = Math.min(...data.map((d) => d.p));
  const max = Math.max(...data.map((d) => d.p));

  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="p" stroke="#10b981" fill="url(#spark)" strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

