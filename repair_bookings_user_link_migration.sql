-- Optional enhancement for linking repair bookings to authenticated users.
-- Run this after the main schema/migrations if you want first-class account linkage.

ALTER TABLE public.repair_bookings
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_bookings_user_id
    ON public.repair_bookings(user_id);
