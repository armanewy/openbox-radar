import type { NormalizedItem } from './types';

// Placeholder/stub for Newegg clearance adapter.
// In dev (USE_REAL_NEWEGG != '1') this returns an empty list to keep the pipeline running.

export async function fetchNeweggClearance(useReal: boolean): Promise<{ storeId: string; items: NormalizedItem[] }> {
  if (!useReal) {
    return { storeId: 'newegg-online', items: [] };
  }
  // TODO: Implement real DOM/API fetch if/when available
  // Keep returning empty for now to satisfy interface and scheduler expectations
  return { storeId: 'newegg-online', items: [] };
}

