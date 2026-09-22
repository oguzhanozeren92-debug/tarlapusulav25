# Türkçe Bilgi Kütüphanesi

Güncel ana daldaki boş Bilgi Rehberi yüzeyine Türkçe kütüphane eklendi.
Son alt navigasyon ve ortak uygulama kabuğu korunur. Kütüphane; Türkçe karakter duyarlı arama,
ürün/konu/kaynak filtresi, özgün ad, kaynak sürümü, atıf ve lisans bağlantısı sunar.

## Gerçekte aktarılan içerik

PlantVillage veri kartının `7f7ecc7e1eaca78107e3affe7cb5abd9427e139a`
sürümündeki 38 sınıf adı Türkçeleştirildi. Bunlar **sözlük etiketidir**:
fotoğraf arşivi, hastalık tanısı, belirtiler veya mücadele talimatı aktarılmadı.
Çeviriler uzman onayı olarak işaretlenmez. Etiket uyarlamaları CC BY-SA 3.0
altındadır; atıf ve lisans her kaydın detayında yer alır.

## Kaynakların durumu (16 Eylül 2026)

| Kaynak | İçerik | Eksik bağımlılık |
|---|---|---|
| OpenFarm | Kaynak bağlantısı | Nisan 2025'te kapandı; kullanılabilir veri arşivi gerekli. Veri CC0, yazılım MIT. |
| Plant Disease Ontology | Kaynak bağlantısı | Ön çalışma; Plant Stress Ontology'ye geçiş ve içerik lisansı doğrulanmalı. |
| AgrODSS / PDP-O | Kaynak bağlantısı | Depoda araştırma belgeleri var; ontoloji dosyası ve yeniden kullanım izni doğrulanmalı. |
| AgriPestDatabase | Kaynak bağlantısı | Taslak araştırma veri seti; belge bazında haklar, Türkçe çeviri ve uzman incelemesi gerekli. Resmî USDA API'si değildir. |
| PlantVillage | 38 Türkçe etiket | Görüntü ve model eklenmedi. |
| IP102 | Kaynak bağlantısı | Akademik dışı uygulama kullanımı için hak sahibinden izin gerekli. |

Bağlantı veya kaynak listesi, canlı entegrasyon olarak sayılmaz. Eksik kaynaklarda
başka kaynaktan kayıt gösterilmez. Sayımlar gerçek yerel kayıtlardan hesaplanır.
Henüz Supabase yayını, admin içe aktarma ekranı, canlı senkronizasyon veya AI/RAG
bağlantısı yoktur. Bu değişiklik yeni bir veritabanı veya anahtar gerektirmez.

## Altı kaynak için ortak Türkçe içerik aktarımı

`node tools/knowledge/import.mjs /tam/yol/turkce-paket.json`

Node 24 ile çalıştırılır. Bu bir **normalize edilmiş JSON paket aktarıcısıdır**;
PDF/DOCX/OBO okuyucusu veya otomatik çeviri servisi değildir. Kaynak belge önce
çıkarılmalı, Türkçeye çevrilmeli ve içerik editörü tarafından kontrol edilmelidir.
`KnowledgeEntry` şeması: `src/features/knowledge/types.ts`.

Paketin kök alanları:

- `schemaVersion`: `1`
- `entries`: şemaya uygun kayıtlar; `id` kaynak öneki ile başlar (`openfarm:...`).
- `rights`: kaynak kimlikleriyle anahtarlanır. Her kaynağın `redistribution: true`,
  `evidenceUrl` (HTTPS) ve `checkedBy` alanları gerekir. IP102 için ayrıca
  `permissionForApp: true` ve uygulama kullanım iznine ait kanıt gerekir.

Her kayıt kaynak URL/sürümü/kimliği, atıf, lisans ve lisans URL'si içerir.
`translation: reviewed`, `reviewedBy` ve gerçek `reviewedAt` tarihi zorunludur.
Bu alanlar otomatik hukuki veya bilimsel doğrulama yapmaz; editörün yaptığı
kontrolün kaydıdır. Salt etiketlerden belirtiler/mücadele bilgisi üretilmez.
Kimyasal mücadele metinleri bu şemaya dahil değildir.

İşlem `data/imported.ts` içine kimliğe göre ekler/günceller; mevcut başka kayıtları
silmez. Kaynak kaydı tekrarını reddeder. Kaynak başına hak incelemesi
`tools/knowledge/rights-audit.json` içinde saklanır. İnceleme/derleme sonrası
dosyalar normal Git değişikliği olarak yayımlanır. Tarayıcıdan yayın yetkisi açılmaz.

## Kontroller

```sh
node --test src/features/knowledge/knowledge.test.mjs
npm run build
git diff --check
```

Arama, çoklu filtre, boş kaynak, lisans/atıf, tekrar kimliği, geçersiz tarih/URL,
eksik inceleme ve IP102 izin kontrolleri test edilir.

Tam proje `npm run typecheck` mevcut başka modüllerde hata veriyor; bu değişikliğin
dosyalarında hata görülmedi. Üretim derlemesi başarılı.

## Kaynaklar

- https://github.com/openfarmcc/OpenFarm/blob/mainline/README.md
- https://github.com/Planteome/plant-disease-ontology
- https://github.com/Amalharbi/AgrODSS
- https://github.com/SHAFNehal/AgriPestDatabase_USDA_TextDataBase_for_LLM_Training
- https://github.com/spMohanty/PlantVillage-Dataset/blob/7f7ecc7e1eaca78107e3affe7cb5abd9427e139a/README_HF.md
- https://github.com/xpwu95/IP102
