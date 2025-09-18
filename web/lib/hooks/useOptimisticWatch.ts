"use client";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export type WatchPayload = {
  retailer: "bestbuy" | "microcenter";
  sku?: string;
  product_url?: string;
  keywords?: string[];
  zipcode?: string;
  radius_miles?: number;
  stores?: string[];
  price_ceiling_cents?: number;
  min_condition?: "certified" | "excellent" | "satisfactory" | "fair" | "unknown";
};

export function useOptimisticWatch() {
  const [loading, setLoading] = useState(false);
  const create = useCallback(async (payload: WatchPayload) => {
    setLoading(true);
    try {
      const r = await fetch("/api/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        toast.success("Watch created");
        return await r.json();
      }
      if (r.status === 401) {
        toast.error("Sign in required to create a watch");
        return null;
      }
      const err = await r.json().catch(() => ({}));
      toast.error("Could not create watch");
      console.error("watch error", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  return { create, loading } as const;
}

