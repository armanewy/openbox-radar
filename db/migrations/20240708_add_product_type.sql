ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS inventory_product_type_idx ON inventory(product_type);
