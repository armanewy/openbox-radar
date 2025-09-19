export type NormalizedItem = {
  retailer: 'bestbuy' | 'microcenter' | 'newegg' | string;
  storeId?: string;
  sku?: string;
  title: string;
  conditionLabel?: string;
  priceCents: number;
  url: string;
  seenAt?: string;
  imageUrl?: string;
};

export interface RetailerAdapter {
  name: string;
  fetchBatch(opts: Record<string, any>): Promise<NormalizedItem[]>;
}

