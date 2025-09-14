import { fetchBestBuyStore, fetchMicroCenterStore } from "./adapters/stubs";

export const Scheduler = {
  async run(env: any) {
    // TODO: query active watches by plan cadence and group by retailer/store
    // For now, just log a stub
    const results = await Promise.all([
      fetchBestBuyStore("bby-123"),
      fetchMicroCenterStore("mc-cambridge")
    ]);
    return { ok: true, checked: results.length };
  }
}
