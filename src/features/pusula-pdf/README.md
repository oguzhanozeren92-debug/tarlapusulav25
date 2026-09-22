USULAPDF veri katmanı

Bu ilk sürüm PDF çizmekten önce haftalık raporun gerçek veri snapshot'ını üretir.

getOrCreateWeeklyPusulaReport(fieldId) aynı tarla + aynı hafta için yalnızca bir snapshot oluşturur.

buildPusulaPdfSnapshot(fieldId) fields, activities, soil_analyses, resolved ai_diagnosis_sessions,
field_irrigation_kc_snapshots, weather_cache ve gerçek Sentinel geçmişini birleştirir.

Veri bulunmazsa sahte değer üretmez; missing listesine ekler.

Son 30 günlük Sentinel sahnelerinden en fazla 8 doğrulanmış tarih rapor paketine alınır.

PDF renderer bir sonraki katmandır; report_data içindeki bu snapshot'ı kullanacaktır.