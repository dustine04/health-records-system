-- Apply after backup. Nullable columns do not modify existing records.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS sync_uuid uuid;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS sync_uuid uuid;
ALTER TABLE public.child_health_records ADD COLUMN IF NOT EXISTS sync_uuid uuid;
CREATE UNIQUE INDEX IF NOT EXISTS households_sync_uuid_unique ON public.households(sync_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS residents_sync_uuid_unique ON public.residents(sync_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS child_health_records_sync_uuid_unique ON public.child_health_records(sync_uuid);
-- IMPORTANT: Review RLS and server authorization separately; this script does not grant access.
