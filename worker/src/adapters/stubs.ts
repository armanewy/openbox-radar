export async function fetchBestBuyStore(storeId: string) {
  // DEV stub returning a couple of example items
  return {
    storeId,
    items: [
      {
        retailer: 'bestbuy',
        storeId,
        sku: '1234567',
        title: 'DEV BestBuy Open-Box Laptop',
        conditionLabel: 'Open-Box Excellent',
        priceCents: 89900,
        url: 'https://www.bestbuy.com/site/sku/1234567.p',
        seenAt: new Date().toISOString(),
      },
    ],
  } as const;
}

export async function fetchMicroCenterStore(storeId: string) {
  // DEV stub returning a couple of example items
  return {
    storeId,
    items: [
      {
        retailer: 'microcenter',
        storeId,
        sku: '7654321',
        title: 'DEV Micro Center Open-Box GPU',
        conditionLabel: 'Open-Box Satisfactory',
        priceCents: 34900,
        url: 'https://www.microcenter.com/product/7654321',
        seenAt: new Date().toISOString(),
      },
    ],
  } as const;
}
