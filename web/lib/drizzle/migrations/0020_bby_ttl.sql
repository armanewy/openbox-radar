-- Add per-source TTL fields to inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'microcenter',
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

-- Fast lookups / purge
CREATE INDEX IF NOT EXISTS idx_inventory_expires_at ON public.inventory (expires_at);

