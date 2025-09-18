DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_inventory_url_price'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT uniq_inventory_url_price UNIQUE (retailer, store_id, url, price_cents);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_inventory_sku_price'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT uniq_inventory_sku_price UNIQUE (retailer, store_id, sku, price_cents);
  END IF;
END $$;

