CREATE TABLE IF NOT EXISTS public.bb_store_availability (
  id bigserial PRIMARY KEY,
  sku text NOT NULL,
  zip text NOT NULL,
  stores jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  failed boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bb_store_availability_sku_zip
  ON public.bb_store_availability (sku, zip);

CREATE INDEX IF NOT EXISTS idx_bb_store_availability_refreshed
  ON public.bb_store_availability (refreshed_at DESC);
