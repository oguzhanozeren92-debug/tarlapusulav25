alter table public.model_engine_runs
  drop constraint if exists model_engine_runs_engine_check;

alter table public.model_engine_runs
  add constraint model_engine_runs_engine_check
  check (engine = any (array['pyfao56'::text, 'pcse'::text, 'aquacrop'::text, 'cropforge'::text]));
