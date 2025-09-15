-- Enable trigram extension and add indexes to improve search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for ILIKE on title and sku
CREATE INDEX IF NOT EXISTS idx_inventory_title_trgm ON inventory USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm   ON inventory USING gin (sku gin_trgm_ops);

-- Common filters and sort
CREATE INDEX IF NOT EXISTS idx_inventory_seen_at ON inventory (seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store   ON inventory (retailer, store_id);

