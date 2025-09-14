export type ConditionRank = 'certified'|'excellent'|'satisfactory'|'fair'|'unknown';

export interface InventoryItem {
  retailer: 'bestbuy'|'microcenter';
  storeId: string;
  sku?: string;
  title: string;
  conditionLabel: string;
  conditionRank: ConditionRank;
  priceCents: number;
  url: string;
  seenAt: string;
}
