-- CropForge shadow readiness: allow server-derived readiness snapshots.
-- Runtime execution is intentionally disabled in phase 1.

alter table public.model_engine_readiness_snapshots
  drop constraint if exists model_engine_readiness_snapshots_engine_check;

alter table public.model_engine_readiness_snapshots
  add constraint model_engine_readiness_snapshots_engine_check
  check (engine = any (array[
    'pyfao56'::text,
    'pcse'::text,
    'aquacrop'::text,
    'cropforge'::text
  ]));
