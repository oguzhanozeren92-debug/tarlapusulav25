alter table public.crop_water_reference_profiles
  add column if not exists aliases text[] not null default '{}'::text[];

update public.crop_water_reference_profiles set aliases = case crop_key
  when 'pistachio' then array['antep fıstığı','antepfıstığı','antep fistigi','antepfistigi','fıstık','fistik','pistachio','pistachios']::text[]
  when 'almond' then array['badem','almond','almonds']::text[]
  when 'cherry' then array['kiraz','cherry','cherries']::text[]
  when 'walnut' then array['ceviz','walnut','walnuts']::text[]
  when 'grape_table' then array['üzüm','uzum','grape','grapes']::text[]
  when 'grape_wine' then array['üzüm','uzum','grape','grapes']::text[]
  else aliases
end;
