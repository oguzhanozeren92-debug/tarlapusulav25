# Sezonluk bitki modelleri için veri hazırlığı

`check.py` yalnızca yerel JSON'u okur; ağa, Supabase'e veya çiftçinin tarlasına istek göndermez. PCSE ve AquaCrop'u çalıştırmaz; iki model için **veri girişlerinin hazır olup olmadığını** raporlar. `pilot_inputs_ready: true`, parametrelerin agronomik doğruluğu veya bir modelin başarılı çalışacağı anlamına gelmez. `field_validation_inputs_ready: true` da henüz karşılaştırma yapıldığı anlamına gelmez.

```bash
python tools/crop-model-readiness/check.py tools/crop-model-readiness/example.template.json
```

`example.template.json` içindeki `null` değerler gerçekten eksik bilgiyi temsil eder, sayı uydurulmaz. Gerçek tarla verisini bu repoya commit etmeyin. Hazırladığınız özel JSON'u repo dışında tutun. `data_type` için `synthetic`, `historical_model` veya gerçek yerinde gözlemler için `observed` kullanın; modelden veya tahminden alınmış veriyi `observed` diye etiketlemeyin.

`field.planting_date` ve `field.end_date` arasındaki **her gün** için `daily_weather` girdisi gerekir. Ortak alanlar: `date` (`YYYY-MM-DD`), `tmin_c`, `tmax_c`, `rain_mm`. PCSE pilotu ayrıca `solar_radiation_mj_m2`, `vapour_pressure_kpa`, `wind_m_s`; AquaCrop pilotu `et0_mm` kullanır. Kaynak, dönem ve birimleri aynı konum için doğrulayın. PCSE için ürün/toprak/site parametreleri ile agromanagement, AquaCrop için ürün/toprak profili, başlangıç toprak suyu ve en az iki ayrı sulama planı gerekir. `*_source` alanları **gerçek ve incelenebilir** parametre/veri kaynağına işaret etmelidir; rastgele yazılmış bir metnin doğruluğu bu araçla sınanamaz. `irrigation_scenarios` öğeleri `{ "name": "...", "plan_source": "..." }` biçimindedir. Bu araç şu anda yalnızca yıllık bitki pilotuna açık; çok yıllık bahçeyi bu model şemasına zorlamaz.

Bir modeli yerinde **doğrulamak** pilot çalıştırmaktan farklıdır. PCSE için en az iki tarihli gerçek fenoloji evresi gözlemi (`observations.stage_dates`: `[{ "date": "YYYY-MM-DD", "stage": "..." }]`), AquaCrop için gerçek hasat verimi (`observations.harvested_yield_t_ha`), sulama geçmişinin kaynağı (`actual_irrigation_log_source`) ve ölçülmüş başlangıç toprak suyunun kaynağı (`initial_soil_water_measurement_source`) gerekir. Bu alanların dolu olması da model doğruluğunu tek başına kanıtlamaz; çıktılar daha sonra ölçümlerle karşılaştırılmalıdır.

Kaynaklar: [PCSE model girdileri](https://pcse.readthedocs.io/en/stable/reference_guide.html), [AquaCrop-OSPy örnek girdileri](https://aquacropos.github.io/aquacrop/), [AquaCrop kapsam notu](https://github.com/aquacropos/aquacrop).
