do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'private.tp_complete_pusula_experiment_stage_task()'::regprocedure
  )
  into v_definition;

  v_definition := replace(
    v_definition,
    '''field-growth-observation''',
    '''field-growth'''
  );

  execute v_definition;

  select pg_get_functiondef(
    'private.tp_sync_pusula_experiment_evidence_tasks_from_calibration()'::regprocedure
  )
  into v_definition;

  v_definition := replace(
    v_definition,
    '''field-growth-observation''',
    '''field-growth'''
  );

  execute v_definition;
end;
$$;

update public.field_todos
set
  action_target = 'field-growth',
  updated_at = now()
where source = 'pusula-experiment'
  and action_target = 'field-growth-observation'
  and task_key like 'pusula-experiment-growth-stage:%';

revoke all on function private.tp_complete_pusula_experiment_stage_task()
from public, anon, authenticated;

revoke all on function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration()
from public, anon, authenticated;

comment on function private.tp_complete_pusula_experiment_stage_task() is
  'Completes a Pusula Experiment stage task only after matching real field-stage evidence is inserted. Task deep-link target is field-growth.';

comment on function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration() is
  'Creates point-bearing Pusula Experiment field evidence tasks after review-eligible calibration. Growth-stage tasks deep-link to Tarla Detayı > Üretim > Saha Gözlemi via field-growth.';
