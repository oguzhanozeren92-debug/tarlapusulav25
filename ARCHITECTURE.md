# TarlaPusula Kod Mimarisi

Bu dosya refactor sonrasında korunacak temel kuralları tanımlar.

## Ana kural

`src/App.tsx` ve `src/pages/Home/HomeScreen.tsx` veri üretim merkezi değildir.

- `App.tsx`: uygulama kabuğu, ekran yönlendirme ve feature controller'larını bir araya getirme.
- `HomeScreen.tsx`: ana ekran yerleşimi ve feature bileşenlerinin kompozisyonu.
- Feature davranışı: `src/features/<feature>/` altında tutulur.
- Harici API/Supabase erişimi: mümkün olduğunca service veya feature hook katmanında tutulur.
- Uygulama genelinde gerçekten ortak olmayan state global store'a taşınmaz.

## Feature yapısı

Yeni bir özellik mümkün olduğunda aşağıdaki düzende eklenir:

```text
src/features/<feature>/
  components/
  hooks/
  services/
  types.ts (gerektiğinde)
```

Her feature bu klasörlerin tamamına sahip olmak zorunda değildir. Gereksiz soyutlama yapılmaz.

## Veri doğruluğu

- Gerçek veri yoksa gerçekmiş gibi rastgele, demo veya sabit sayısal değer gösterilmez.
- `DEMO_FIELD` gibi örnek kayıtlar production veri akışına fallback olarak bağlanmaz.
- API başarısızsa UI açık bir `veri alınamadı / henüz veri yok` durumuna geçer.
- Görsel placeholder ile sayısal veri fallback'i birbirinden ayrılır.
- Uydu, SoilGrids, hava, iklim ve diğer katmanların kaynakları birbirine karıştırılmaz.

## Refactor yöntemi

- Çalışan davranışı koruyarak küçük ve doğrulanabilir adımlarla ilerle.
- Önce sorumluluğu ayır, sonra iş mantığını değiştir.
- Bir modül sabitlenmeden sonraki büyük modüle agresif refactor yapma.
- Eski kod gerekiyorsa silmek yerine `legacy/` altında sakla; aktif `src` derleme alanında bırakma.

## Mevcut checkpoint'ler

Git geçmişinde refactor öncesi baseline ve Home refactor checkpoint'i bulunur. Büyük refactor adımlarında yeni checkpoint oluşturulmalıdır.

## Doğrulama

Her büyük taşıma sonrasında en az:

1. TS/TSX syntax taraması,
2. relative import yolu taraması,
3. `git diff --check`,
4. bağımlılıklar mevcutsa `npm run build`

çalıştırılmalıdır.
