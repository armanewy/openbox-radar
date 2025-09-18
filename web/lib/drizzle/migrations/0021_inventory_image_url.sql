ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS image_url text NULL;

