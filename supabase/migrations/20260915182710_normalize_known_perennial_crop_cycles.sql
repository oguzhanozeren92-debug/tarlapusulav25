create or replace function private.normalize_known_perennial_crop_cycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_crop text := lower(trim(coalesce(new.crop, '')));
begin
  if v_crop in (
    'antep fıstığı','antepfıstığı','antep fistigi','antepfistigi','fıstık','fistik','pistachio',
    'badem','almond',
    'kiraz','cherry','cherries',
    'ceviz','walnut','walnuts',
    'üzüm','uzum','grape','grapes',
    'elma','apple',
    'armut','pear',
    'zeytin','olive',
    'fındık','findik','hazelnut',
    'kayısı','kayisi','apricot',
    'şeftali','seftali','peach',
    'erik','plum',
    'nar','pomegranate'
  ) then
    new.crop_cycle := 'perennial';
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_known_perennial_crop_cycle() from public, anon, authenticated;

drop trigger if exists trg_normalize_known_perennial_crop_cycle on public.fields;
create trigger trg_normalize_known_perennial_crop_cycle
before insert or update of crop, crop_cycle on public.fields
for each row
execute function private.normalize_known_perennial_crop_cycle();

update public.fields
set crop_cycle = 'perennial'
where lower(trim(coalesce(crop, ''))) in (
  'antep fıstığı','antepfıstığı','antep fistigi','antepfistigi','fıstık','fistik','pistachio',
  'badem','almond',
  'kiraz','cherry','cherries',
  'ceviz','walnut','walnuts',
  'üzüm','uzum','grape','grapes',
  'elma','apple',
  'armut','pear',
  'zeytin','olive',
  'fındık','findik','hazelnut',
  'kayısı','kayisi','apricot',
  'şeftali','seftali','peach',
  'erik','plum',
  'nar','pomegranate'
)
and crop_cycle is distinct from 'perennial';
