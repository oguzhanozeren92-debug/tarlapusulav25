# CropForge — TarlaPusula shadow/readiness entegrasyonu

Kaynak: `saswatsundar123/CropForge` — MIT, v1.0.0.

CropForge; Python tabanlı tarla simülasyonu, FAO-56 ET0, bitki büyümesi, çok sezonlu rotasyon, arazi fiziği ve erozyon/sediment senaryoları için açık kaynak bir araştırma çalışma zamanıdır.

## TarlaPusula Phase 1

Bu entegrasyon **CropForge'u henüz çalıştırmaz**. Mevcut TarlaPusula server-side adapterlarından gerçek tarla girdilerini birleştirerek bir CropForge deneyinin çekirdek girdilerinin hazır olup olmadığını ölçer:

- tarla konumu
- günlük hava
- ürün parametreleri
- toprak profili
- ekim/dikim tarihi

Girdiler istemciden `available_inputs` olarak güvenilir kabul edilmez; PCSE ve AquaCrop server adapterlarından türetilir. Sonuç `model_engine_readiness_snapshots` tablosunda `cropforge` motoru olarak saklanır.

## Güvenlik kapıları

- `production_authority = false`
- verim otoritesi yok
- sulama/gübre reçetesi otoritesi yok
- runtime execution kapalı
- arazi/erozyon fiziği için doğrulanmış topografya ayrıca zorunlu olacak
- eksik veri sentetik değerle doldurulmaz

Phase 2'de doğrulanmış DEM/topografya sözleşmesi ve benchmark tamamlanırsa model-gateway içinde izole CropForge shadow run eklenebilir. Production karar motoruna geçiş ayrıca doğrulama gerektirir.
