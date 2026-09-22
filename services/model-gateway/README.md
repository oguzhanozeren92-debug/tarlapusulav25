# TarlaPusula Model Gateway

Bu servis Python tabanlı tarım motorlarını React uygulamasından ayırır. Harici motorlar doğrudan UI veya Pusula AI tarafından çağrılmaz.

Akış:

`React / Supabase -> trusted backend -> Model Gateway -> engine adapter -> Decision Layer -> Pusula`

## Aktif motorlar

- `pyfao56`: shadow modda iki ayrı doğrulama yolu vardır:
  - referans ET0 + TarlaPusula'nın doğrulanmış günlük Kc değeriyle ETc karşılaştırması,
  - doğrulanmış basal Kcb, gerçek/kanıtlı başlangıç De-Dr durumu ve FAO REW alt/üst sınırlarını ayrı senaryolar halinde çalıştıran bounded dual-Kc su dengesi. REW aralığı keyfi bir orta değere düşürülmez. Kullanıcının kaydettiği sulama yöntemi de FAO-56 fw referans aralığıyla taşınır; fw sulama randımanı olarak yorumlanmaz.
- `PCSE/WOFOST`: pilot/readiness; gerçek tarla hava + ürün + toprak + site + agromanagement girdileri tamamlanmadan çalıştırılmaz.
- `AquaCrop-OSPy`: pilot/readiness; gerçek sezon/su/toprak girdileri tamamlanmadan çalıştırılmaz.

Bu motorların hiçbiri tek başına production sulama/tarım karar otoritesi değildir. Son kullanıcı kararı TarlaPusula karar katmanından geçer.

Aşağıdaki motorlar registry'de kayıtlıdır ancak kapalıdır: AutoGeoBound, OpenAgri Pest&Disease, AgML, FarmVibes.AI.

## Bağımlılıklar

Canonical Python bağımlılıkları ve motor sürümleri `requirements.txt` içinde pinlenir:

```bash
pip install -r requirements.txt
```

`requirements-pilot.txt` geriye uyumluluk için aynı canonical dosyayı referans eder; ayrı motor sürümü pinlemez.

## Tek uygulama entrypoint'i

Tüm deploy yolları aynı FastAPI uygulamasını çalıştırır:

`services/model-gateway/app.py -> app`

`dual_app.py` yalnız eski deploy komutları için geriye uyumlu bir re-export katmanıdır. Dual-Kc route'u da dahil olmak üzere bütün endpointler `app.py` içinde kayıtlıdır.

## Yerel çalıştırma

```bash
cd services/model-gateway
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

Development dışında `MODEL_GATEWAY_SHARED_KEY` tanımlanmalıdır. Bu anahtar frontend'e konmaz. `VITE_*` secret kullanılmaz.

## Ana endpointler

- `GET /health`
- `GET /v1/registry`
- `POST /v1/irrigation/pyfao56/shadow`
- `POST /v1/irrigation/pyfao56/dual-kc-shadow`
- `POST /v1/phenology/pcse/readiness`
- `POST /v1/phenology/pcse/pilot`
- `POST /v1/scenario/aquacrop/readiness`
- `POST /v1/scenario/aquacrop/pilot`

## Vercel yedek deploy yolu

Vercel projesinin Root Directory değeri `services/model-gateway` olmalıdır. `app.py` FastAPI entrypoint'idir; `vercel.json` fonksiyon süresini 60 saniyeye ayarlar.

Vercel ortam değişkenlerinde en az:

- `MODEL_GATEWAY_ENV=production`
- `MODEL_GATEWAY_SHARED_KEY=<server-only-secret>`

olmalıdır. Bu değerler mobil uygulamaya veya `VITE_*` değişkenlerine yazılmaz. Aynı secret Supabase model Edge Function tarafındaki `MODEL_GATEWAY_SHARED_KEY` ile eşleşmelidir; gateway URL de yalnız Supabase server secret'ı olarak tutulur.

## Güvenlik / veri ilkeleri

- Gateway public frontend endpoint'i değildir; yalnız trusted backend çağırır.
- Motor sonucu production otoritesi değildir; rollout registry belirler.
- Eksik tarla girdisi sahte/default tarla verisiyle doldurulmaz.
- pyfao56 shadow sonuçları mevcut production sulama kararını otomatik değiştirmez.
- Bounded dual-Kc shadow, FAO REW aralığını ayrı alt/üst senaryolar olarak taşır; sahte tek REW değeri üretmez.
- Sulama yöntemi için FAO-56 ıslanan yüzey oranı (fw) aralığı korunur; aralık uydurma orta değere indirgenmez ve sulama verimi/efficiency yerine kullanılmaz.
- Shadow → production karşılaştırmaları aynı run'a ait production snapshot'ıyla saklanır; geçmiş run bugünkü kararla yeniden yorumlanmaz.
- Promotion doğrulaması fail-closed'dur: üç ayrı gün destekleyici kayıt + doğrulanmış saha su ölçümü olmadan uygun sayılmaz ve production authority daima false kalır.
- Tam su dengesi; doğrulanmış basal Kcb, yüzey buharlaşma durumu ve mevcut kök-bölgesi su durumu olmadan çalıştırılmaz.
- PCSE ve AquaCrop gerçek tarla girdileri tamamlanana kadar kullanıcı tavsiyesi üretmez.
- Upstream sürümleri bilinçli pin ile tutulur ve yükseltmeler benchmark ister.


## AquaCrop pilot completion contract

AquaCrop-OSPy is integrated as season-scale validation evidence only. The pinned runtime is `aquacrop==3.1.0`; production irrigation, irrigation prescription, and yield authority remain false. Inputs are server-derived and fail closed when real weather, soil, initial-water, crop, or irrigation-management evidence is missing. Contract v8 binds the complete weather horizon, SoilGrids/Saxton-Rawls provenance, measured-interval midpoint initial-water semantics, exact zero-based daily output counters, audit fingerprints, frontend trust checks, and immutable PDF evidence. No synthetic agricultural measurements are generated.


## AgriFM research gate

AgriFM is pinned from `flyakon/AgriFM` at commit `13f476e2d5b698387fa8ce068e793cc1c33f8279` under Apache-2.0. It remains `rollout=off` until TarlaPusula has a server-side, reproducible satellite-cube adapter and validated model weights. No AgriFM class, boundary, or crop result may enter production decisions before that gate is complete. The first input adapter intentionally fails closed: existing NDVI statistics are scalar aggregates and are never re-labelled as AgriFM image tensors. The next gate must create real cloud-masked B02/B03/B04/B08 temporal cubes from Copernicus Sentinel-2 L2A on the server. The cube contract requires stored field geometry, 10 m pixels, at least four observations, <=30% scene cloud cover, SCL rejection classes 0/1/3/8/9/10/11, ascending acquisition time, and duplicate-acquisition rejection. Cube schema v1 is float32 reflectance on a common 10 m grid; masked pixels are never zero-filled. Every observation retains STAC item/acquisition provenance, and the complete pixels+mask+dates+scene IDs+geometry+contract evidence is bound by a SHA-256 fingerprint. The server now authenticates to Copernicus, verifies field ownership and stored polygon geometry, and discovers eligible Sentinel-2 L2A scenes over a 365-day window. The pilot cube is bounded to the latest 4-12 eligible unique acquisitions, a fixed 64x64 field-bbox tensor, and an 8 MiB maximum payload. Real selected scenes are now requested from the Copernicus Process API as separate reflectance and validity-mask GeoTIFF responses, with per-scene SHA-256 evidence and an aggregate manifest fingerprint. Input contract v2 therefore proves real multiband scene retrieval. The gateway now also has a fail-closed numeric cube contract for the decoded representation: `[time, 4, 64, 64]` float32 in B02/B03/B04/B08 order, binary validity masks, masked values represented as NaN rather than zero, >=10% valid pixels per scene, 4-12 ordered unique observations, explicit metadata, and a bounded tensor payload. Model execution remains disabled until the Copernicus GeoTIFF archive is actually decoded into that contract and validated against the source manifest. Candidate inputs are the upstream-supported Sentinel-2, Landsat-8/9, and MODIS temporal sources; candidate tasks are cropland mapping, field-boundary delineation, early-season crop mapping, and specific-crop mapping.
