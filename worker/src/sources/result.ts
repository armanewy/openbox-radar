import type { ScrapeMetrics } from './types';
import type { IngestPayload } from '../ingest';

export type StoreScrapeResult = {
  items: IngestPayload[];
  metrics: ScrapeMetrics[];
};
