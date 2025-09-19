ALTER TABLE public.watches
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- optional index to query pending/verified quickly
CREATE INDEX IF NOT EXISTS idx_watches_user_verified ON public.watches (user_id, verified);

