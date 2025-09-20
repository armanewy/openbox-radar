export type StoreConfig = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  url: string;
};

export type ScrapeMetrics = {
  storeId: string;
  count: number;
  url: string;
};
