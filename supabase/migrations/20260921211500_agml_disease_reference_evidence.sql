-- TarlaPusula · AgML/PlantVillage/PlantDoc disease-image reference evidence
-- This is a dataset-reference layer only. It does not run a disease classifier and
-- never raises the diagnostic confidence of Pusula AI by itself.

create table if not exists public.agml_disease_reference_catalog (
  id bigint generated always as identity primary key,
  dataset_id text not null,
  dataset_name text not null,
  crop_label text not null,
  crop_aliases text[] not null default '{}',
  issue_label text not null,
  issue_aliases text[] not null default '{}',
  kind text not null default 'disease' check (kind in ('disease', 'pest', 'healthy', 'other')),
  scene_type text not null check (scene_type in ('controlled_leaf', 'field')),
  reference_count integer,
  license text not null,
  source_url text not null,
  attribution text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, crop_label, issue_label)
);

alter table public.agml_disease_reference_catalog enable row level security;
revoke all on table public.agml_disease_reference_catalog from anon, authenticated;

create or replace function public.tp_norm_vision_label(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(value, ''), 'ÇĞİÖŞÜçğıöşü', 'CGIOSUcgiosu')),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.tp_vision_alias_match(
  query_value text,
  canonical_value text,
  aliases text[]
)
returns boolean
language sql
immutable
parallel safe
as $$
  with normalized as (
    select
      public.tp_norm_vision_label(query_value) as q,
      public.tp_norm_vision_label(canonical_value) as canonical
  )
  select case
    when (select q from normalized) = '' then false
    when (select q from normalized) = (select canonical from normalized) then true
    when length((select q from normalized)) >= 5
      and length((select canonical from normalized)) >= 5
      and (
        position((select q from normalized) in (select canonical from normalized)) > 0
        or position((select canonical from normalized) in (select q from normalized)) > 0
      ) then true
    else exists (
      select 1
      from unnest(coalesce(aliases, '{}'::text[])) as alias_value
      where public.tp_norm_vision_label(alias_value) <> ''
        and (
          public.tp_norm_vision_label(alias_value) = (select q from normalized)
          or (
            length(public.tp_norm_vision_label(alias_value)) >= 5
            and length((select q from normalized)) >= 5
            and (
              position(public.tp_norm_vision_label(alias_value) in (select q from normalized)) > 0
              or position((select q from normalized) in public.tp_norm_vision_label(alias_value)) > 0
            )
          )
        )
    )
  end;
$$;

insert into public.agml_disease_reference_catalog
  (dataset_id, dataset_name, crop_label, crop_aliases, issue_label, issue_aliases, kind, scene_type, reference_count, license, source_url, attribution)
values
  ('Project-AgML/plant_village_classification','Plant Village Classification','Apple',array['elma'],'Apple scab',array['kara leke','elma kara lekesi','venturia inaequalis'],'disease','controlled_leaf',630,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Apple',array['elma'],'Black rot',array['siyah curukluk','siyah çürüklük','botryosphaeria obtusa'],'disease','controlled_leaf',621,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Apple',array['elma'],'Cedar apple rust',array['sedir elma pasi','sedir elma pası','gymnosporangium juniperi virginianae'],'disease','controlled_leaf',275,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Apple',array['elma'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',1645,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Blueberry',array['yaban mersini'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',1502,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Cherry',array['kiraz'],'Powdery mildew',array['kulleme','külleme'],'disease','controlled_leaf',1052,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Cherry',array['kiraz'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',854,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Corn',array['misir','mısır','maize'],'Cercospora leaf spot Gray leaf spot',array['gri yaprak lekesi','cercospora yaprak lekesi'],'disease','controlled_leaf',513,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Corn',array['misir','mısır','maize'],'Common rust',array['pas','adi pas','misir pasi','mısır pası'],'disease','controlled_leaf',1192,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Corn',array['misir','mısır','maize'],'Northern Leaf Blight',array['kuzey yaprak yanikligi','kuzey yaprak yanıklığı','yaprak yanikligi','yaprak yanıklığı'],'disease','controlled_leaf',985,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Corn',array['misir','mısır','maize'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',1162,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Grape',array['uzum','üzüm','bag','bağ'],'Black rot',array['siyah curukluk','siyah çürüklük'],'disease','controlled_leaf',1180,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Grape',array['uzum','üzüm','bag','bağ'],'Esca Black Measles',array['eska','black measles'],'disease','controlled_leaf',1383,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Grape',array['uzum','üzüm','bag','bağ'],'Leaf blight Isariopsis Leaf Spot',array['isariopsis','yaprak yanikligi','yaprak yanıklığı','yaprak lekesi'],'disease','controlled_leaf',1076,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Grape',array['uzum','üzüm','bag','bağ'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',423,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Orange',array['portakal','turuncgil','turunçgil'],'Huanglongbing Citrus greening',array['huanglongbing','citrus greening','turuncgil yesillenme','turunçgil yeşillenme'],'disease','controlled_leaf',5507,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Peach',array['seftali','şeftali'],'Bacterial spot',array['bakteriyel leke'],'disease','controlled_leaf',2297,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Peach',array['seftali','şeftali'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',360,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Bell pepper',array['biber','dolmalik biber','dolmalık biber','pepper'],'Bacterial spot',array['bakteriyel leke'],'disease','controlled_leaf',997,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Bell pepper',array['biber','dolmalik biber','dolmalık biber','pepper'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',1478,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Potato',array['patates'],'Early blight',array['erken yaniklik','erken yanıklık','alternaria','alternaria solani'],'disease','controlled_leaf',1000,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Potato',array['patates'],'Late blight',array['gec yaniklik','geç yanıklık','mildiyo','mildiyö','phytophthora infestans'],'disease','controlled_leaf',1000,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Potato',array['patates'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',152,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Raspberry',array['ahududu'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',371,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Soybean',array['soya','soya fasulyesi'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',5090,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Squash',array['kabak'],'Powdery mildew',array['kulleme','külleme'],'disease','controlled_leaf',1835,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Strawberry',array['cilek','çilek'],'Leaf scorch',array['yaprak yanikligi','yaprak yanıklığı','leaf scorch'],'disease','controlled_leaf',1109,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Strawberry',array['cilek','çilek'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',456,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Bacterial spot',array['bakteriyel leke'],'disease','controlled_leaf',2127,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Early blight',array['erken yaniklik','erken yanıklık','alternaria','alternaria solani'],'disease','controlled_leaf',1000,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Late blight',array['gec yaniklik','geç yanıklık','mildiyo','mildiyö','phytophthora infestans'],'disease','controlled_leaf',1909,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Leaf Mold',array['yaprak kufu','yaprak küfü','cladosporium'],'disease','controlled_leaf',952,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Septoria leaf spot',array['septoria','septorya','septorya yaprak lekesi','septoria leaf spot'],'disease','controlled_leaf',1771,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Spider mites Two-spotted spider mite',array['kirmizi orumcek','kırmızı örümcek','iki noktali kirmizi orumcek','iki noktalı kırmızı örümcek','spider mite'],'pest','controlled_leaf',1676,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Target Spot',array['hedef leke','target spot'],'disease','controlled_leaf',1404,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Tomato Yellow Leaf Curl Virus',array['sari yaprak kivirciklik virusu','sarı yaprak kıvırcıklık virüsü','tylcv'],'disease','controlled_leaf',5357,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'Tomato mosaic virus',array['mozaik virusu','mozaik virüsü','tomato mosaic virus'],'disease','controlled_leaf',373,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),
  ('Project-AgML/plant_village_classification','Plant Village Classification','Tomato',array['domates'],'healthy',array['saglikli','sağlıklı'],'healthy','controlled_leaf',1591,'upstream terms; redistribution license must be verified','https://huggingface.co/datasets/Project-AgML/plant_village_classification','PlantVillage / Hughes & Salathé'),

  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Apple',array['elma'],'Apple Scab Leaf',array['kara leke','elma kara lekesi'],'disease','field',93,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Apple',array['elma'],'Apple rust leaf',array['elma pasi','elma pası','rust'],'disease','field',88,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Bell pepper',array['biber','dolmalik biber','dolmalık biber'],'Bell pepper leaf spot',array['yaprak lekesi','biber yaprak lekesi'],'disease','field',71,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Corn',array['misir','mısır','maize'],'Corn Gray leaf spot',array['gri yaprak lekesi','cercospora yaprak lekesi'],'disease','field',68,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Corn',array['misir','mısır','maize'],'Corn leaf blight',array['yaprak yanikligi','yaprak yanıklığı','northern leaf blight'],'disease','field',191,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Corn',array['misir','mısır','maize'],'Corn rust leaf',array['pas','misir pasi','mısır pası'],'disease','field',116,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Potato',array['patates'],'Potato leaf early blight',array['erken yaniklik','erken yanıklık','alternaria','alternaria solani'],'disease','field',116,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Potato',array['patates'],'Potato leaf late blight',array['gec yaniklik','geç yanıklık','mildiyo','mildiyö','phytophthora infestans'],'disease','field',105,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Squash',array['kabak'],'Squash Powdery mildew leaf',array['kulleme','külleme'],'disease','field',130,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato Early blight leaf',array['erken yaniklik','erken yanıklık','alternaria','alternaria solani'],'disease','field',88,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato Septoria leaf spot',array['septoria','septorya','septorya yaprak lekesi'],'disease','field',150,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato leaf bacterial spot',array['bakteriyel leke'],'disease','field',110,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato leaf late blight',array['gec yaniklik','geç yanıklık','mildiyo','mildiyö','phytophthora infestans'],'disease','field',111,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato leaf mosaic virus',array['mozaik virusu','mozaik virüsü'],'disease','field',54,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato leaf yellow virus',array['sari yaprak virusu','sarı yaprak virüsü','yellow leaf curl virus','tylcv'],'disease','field',75,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato mold leaf',array['yaprak kufu','yaprak küfü','leaf mold'],'disease','field',91,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Tomato',array['domates'],'Tomato two spotted spider mites leaf',array['kirmizi orumcek','kırmızı örümcek','iki noktali kirmizi orumcek','iki noktalı kırmızı örümcek','spider mite'],'pest','field',2,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020'),
  ('Project-AgML/plant_doc_classification','Plant Doc Classification','Grape',array['uzum','üzüm','bag','bağ'],'grape leaf black rot',array['siyah curukluk','siyah çürüklük','black rot'],'disease','field',64,'CC-BY-SA-4.0','https://huggingface.co/datasets/Project-AgML/plant_doc_classification','PlantDoc / Singh et al. 2020')
on conflict (dataset_id, crop_label, issue_label) do update
set crop_aliases = excluded.crop_aliases,
    issue_aliases = excluded.issue_aliases,
    kind = excluded.kind,
    scene_type = excluded.scene_type,
    reference_count = excluded.reference_count,
    license = excluded.license,
    source_url = excluded.source_url,
    attribution = excluded.attribution;

create or replace function public.tp_build_agml_reference_evidence(
  p_crop text,
  p_analysis jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  issue_text text := coalesce(p_analysis->>'possibleIssue', p_analysis->>'headline', '');
  issue_type text := lower(coalesce(p_analysis->>'issueType', ''));
  matches jsonb;
  coverage text;
begin
  if p_analysis is null or jsonb_typeof(p_analysis) <> 'object' then
    return null;
  end if;

  if issue_type not in ('disease', 'pest', 'uncertain', 'healthy') then
    return null;
  end if;

  if public.tp_norm_vision_label(issue_text) in ('', 'belirsiz', 'unknown', 'uncertain') then
    return null;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'datasetId', ranked.dataset_id,
      'datasetName', ranked.dataset_name,
      'cropLabel', ranked.crop_label,
      'issueLabel', ranked.issue_label,
      'kind', ranked.kind,
      'sceneType', ranked.scene_type,
      'referenceCount', ranked.reference_count,
      'license', ranked.license,
      'sourceUrl', ranked.source_url,
      'attribution', ranked.attribution,
      'matchScore', ranked.match_score
    ) order by ranked.match_score desc, ranked.scene_type desc, ranked.dataset_id
  )
  into matches
  from (
    select
      c.*,
      (
        case when public.tp_norm_vision_label(p_crop) = public.tp_norm_vision_label(c.crop_label) then 6 else 4 end
        + case when public.tp_norm_vision_label(issue_text) = public.tp_norm_vision_label(c.issue_label) then 8 else 5 end
        + case when c.scene_type = 'field' then 2 else 0 end
      ) as match_score
    from public.agml_disease_reference_catalog c
    where public.tp_vision_alias_match(p_crop, c.crop_label, c.crop_aliases)
      and public.tp_vision_alias_match(issue_text, c.issue_label, c.issue_aliases)
    order by match_score desc, c.scene_type desc, c.dataset_id
    limit 5
  ) ranked;

  coverage := case
    when matches is null or jsonb_array_length(matches) = 0 then 'no_reference'
    when exists (
      select 1
      from jsonb_array_elements(matches) item
      where item->>'sceneType' = 'field'
    ) then 'field_reference_available'
    else 'controlled_reference_only'
  end;

  return jsonb_build_object(
    'source', 'Project-AgML public disease datasets',
    'engine', 'agml_reference_v1',
    'upstream', 'Project-AgML/AgML',
    'upstreamCommit', 'c3343fc3b3f8abd89983927da3fc8319cb019d49',
    'agmlVersion', '0.8.1',
    'referenceOnly', true,
    'diagnosticAuthority', false,
    'confidenceAuthority', false,
    'independentModel', false,
    'coverage', coverage,
    'query', jsonb_build_object('crop', p_crop, 'issue', issue_text, 'issueType', issue_type),
    'matches', coalesce(matches, '[]'::jsonb),
    'warnings', jsonb_build_array(
      'AgML bu akışta veri seti/referans katmanıdır; pretrained teşhis modeli olarak kullanılmıyor.',
      'PlantVillage kontrollü yaprak görüntüleridir ve saha fotoğrafına doğrudan genellenemez.',
      'PlantDoc saha fotoğrafı referansı sağlar; eşleşme tek başına hastalık veya zararlı teşhisini doğrulamaz.'
    ),
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.tp_build_agml_reference_evidence(text, jsonb) from public, anon, authenticated;
revoke all on function public.tp_vision_alias_match(text, text, text[]) from public, anon, authenticated;
revoke all on function public.tp_norm_vision_label(text) from public, anon, authenticated;

grant execute on function public.tp_build_agml_reference_evidence(text, jsonb) to service_role;
grant execute on function public.tp_vision_alias_match(text, text, text[]) to service_role;
grant execute on function public.tp_norm_vision_label(text) to service_role;

create or replace function public.tp_enrich_ai_job_agml_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evidence jsonb;
begin
  if new.analysis is null or jsonb_typeof(new.analysis) <> 'object' then
    return new;
  end if;

  if new.analysis ? 'agmlReferenceEvidence' then
    return new;
  end if;

  evidence := public.tp_build_agml_reference_evidence(new.crop, new.analysis);
  if evidence is not null then
    new.analysis := jsonb_set(new.analysis, '{agmlReferenceEvidence}', evidence, true);
  end if;

  return new;
end;
$$;

revoke all on function public.tp_enrich_ai_job_agml_reference() from public, anon, authenticated;

drop trigger if exists trg_ai_job_agml_reference on public.ai_image_analysis_jobs;
create trigger trg_ai_job_agml_reference
before insert or update of analysis, crop on public.ai_image_analysis_jobs
for each row
execute function public.tp_enrich_ai_job_agml_reference();

comment on table public.agml_disease_reference_catalog is
  'AgML-indexed PlantVillage/PlantDoc visual disease reference taxonomy. Reference-only; never diagnostic authority.';
comment on function public.tp_build_agml_reference_evidence(text, jsonb) is
  'Builds non-diagnostic AgML dataset coverage evidence for an AI photo analysis without changing its confidence.';
