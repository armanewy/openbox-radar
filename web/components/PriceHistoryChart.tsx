"use client";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";

type Props = {
  retailer: string;
  sku?: string | null;
  url?: string | null;
  store_id?: string | null;
  limit?: number;
  className?: string;
};

type Point = { t: string; p: number };

function dollars(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

export default function PriceHistoryChart({ retailer, sku, url, store_id, limit = 30, className }: Props) {
  const [data, setData] = useState<Point[] | null>(null);
  useEffect(() => {
    const qp = new URLSearchParams();
    qp.set("retailer", retailer);
    if (sku) qp.set("sku", sku);
    if (!sku && url) qp.set("url", url);
    if (store_id) qp.set("store_id", store_id);
    qp.set("limit", String(limit));
    fetch(`/api/inventory/history?${qp.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d.points || []))
      .catch(() => setData([]));
  }, [retailer, sku, url, store_id, limit]);

  const stats = useMemo(() => {
    if (!data || !data.length) return null;
    const prices = data.map((d) => d.p);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }, [data]);

  if (!data || data.length < 2) return <div className="text-sm text-gray-600">Not enough history</div>;

  return (
    <div className={className}>
      <div className="text-sm text-gray-700 mb-2">
        {stats ? (
          <span>
            Min {dollars(stats.min)} • Max {dollars(stats.max)} • {data.length} points
          </span>
        ) : null}
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <XAxis dataKey="t" hide tickFormatter={() => ""} />
            <YAxis tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} width={48} />
            <Tooltip formatter={(v) => dollars(Number(v))} labelFormatter={(t) => new Date(t).toLocaleString()} />
            <ReferenceLine y={stats?.min} stroke="#10b981" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="p" stroke="#111827" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

