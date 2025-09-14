export async function fetchBestBuyStore(storeId: string) {
  // TODO: polite fetch with ETag/If-Modified-Since; parse inventory
  return { storeId, items: [] };
}

export async function fetchMicroCenterStore(storeId: string) {
  // TODO: polite fetch; parse inventory
  return { storeId, items: [] };
}
