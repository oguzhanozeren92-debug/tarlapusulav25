# pyfao56 bağımsız deneme

Bu klasör, [pyfao56](https://github.com/kthorp/pyfao56) ile yedi günlük **sentetik** hava verisinden referans ET, bitki ET ve kök bölgesi su açığı hesaplar. Uygulamanın sulama kararlarına veya Vercel build'ine bağlı değildir; burada görülen sayılar gerçek tarlaya öneri değildir.

```bash
python -m venv /tmp/tarlapusula-pyfao56-venv
/tmp/tarlapusula-pyfao56-venv/bin/python -m pip install -r tools/pyfao56-poc/requirements.txt
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/run.py
```

Çıktı, `data_type: synthetic` etiketiyle yedi günlük JSON üretir. pyfao56 referans ET için ASCE standart denklemini kullanır; uygulamadaki Open-Meteo `et0_fao_evapotranspiration` ile farklılıklar beklenebilir. Gerçek karşılaştırma için aynı tarih, koordinat, hava girdileri, ürün evresi, toprak parametreleri ve sulama kayıtlarının doğrulanıp eşleştirilmesi gerekir.

## Aynı tarih ve katsayıyla ET karşılaştırması

`compare.py`, yalnızca yerel JSON'dan iki veya daha çok ardışık gün için referans ET'yi ve **aynı uygulama Kc'siyle** çarpılmış iki ET değerini yan yana hesaplar. Girdi şablonu:

```json
{
  "data_type": "observed",
  "source": "Doğrulanmış meteoroloji kaynağı ve uygulama ET0 dışa aktarımı",
  "station": { "latitude": 39.9, "elevation_m": 100, "wind_height_m": 2 },
  "days": [
    { "date": "2026-06-01", "solar_radiation_mj_m2": 22, "tmax_c": 29, "tmin_c": 15, "rhmax_pct": 80, "rhmin_pct": 40, "wind_m_s": 2, "rain_mm": 0, "app_et0_mm": 5.1, "app_kc": 0.5 },
    { "date": "2026-06-02", "solar_radiation_mj_m2": 22, "tmax_c": 29, "tmin_c": 15, "rhmax_pct": 80, "rhmin_pct": 40, "wind_m_s": 2, "rain_mm": 0, "app_et0_mm": 5.1, "app_kc": 0.5 }
  ]
}
```

Bu sayılar yalnızca **girdi biçimi örneğidir**, saha ölçümü değildir. Gerçek kullanıcı verisini repoya commit etmeyin. `app_et0_mm` uygulamadaki Open-Meteo ET₀, `app_kc` aynı güne ait uygulama ürün katsayısı olmalı. Yağış miktarı kaydedilir ancak bu karşılaştırmanın ET hesaplarına katılmaz.

```bash
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/compare.py /yerel/yol/gunluk-veri.json
```

Eksik günlük meteoroloji veya uygulama ET₀ verisini tahmin ederek doldurmaz; hata verir. Kc yoksa ET₀ kıyaslaması sürer, ET₀ × Kc sütunları `null` olur. Çıktıdaki fark iki ayrı referans ET metodunu da içerir; “uygulama hatası” veya sulama miktarı olarak yorumlanamaz. Gerçek sulama kararı karşılaştırması için ayrıca doğrulanmış toprak başlangıç suyu, kök profili ve sulama geçmişi gerekir.

## Open-Meteo yanıtını çevrimdışı dönüştürme

`prepare_open_meteo.py` **yalnızca daha önce yerel dosyaya kaydedilmiş** Open-Meteo JSON yanıtını okur. Konum okumaz, Supabase'e ya da hava servisine istek göndermez. Yanıtta `timezone=UTC`, `wind_speed_unit=ms`, günlük `temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,et0_fao_evapotranspiration,precipitation_sum` ve saatlik `relative_humidity_2m,wind_speed_10m` alanları bulunmalıdır. Her gün için 24 saatlik nemden minimum/maksimum, rüzgârdan günlük ortalama türetilir. Modelde rüzgâr ölçüm yüksekliği 10 metre kullanılır; yerel istasyon ölçümü ile karıştırılmamalıdır.

```bash
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/prepare_open_meteo.py \
  /yerel/yol/open-meteo-yaniti.json \
  --kind historical_model \
  --source 'Open-Meteo Historical Weather API, model verisi' \
  > /tmp/tarlapusula-et-girdi.json
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/compare.py \
  /tmp/tarlapusula-et-girdi.json
```

`historical_model`, bir istasyonda doğrudan gözlemlenmiş hava ölçümü anlamına gelmez. Kayıtlı JSON'da uygulamanın **aynı istek ve aynı tarihlerdeki** ET₀'si kullanılmalıdır. Farklı bir hava modelinin ya da güncelleme zamanının ET₀'siyle eşleştirerek uygulamanın doğruluğu hakkında hüküm vermeyin. Uygulamanın o güne ait gerçek Kc değeri ayrıca biliniyorsa, dönüştürülmüş yerel dosyanın ilgili gününe `app_kc` eklenebilir; güncel Kc değerini eski günlere kopyalamayın. Özel tarla koordinatlarını dış servise gönderecek otomatik kod burada yoktur.
