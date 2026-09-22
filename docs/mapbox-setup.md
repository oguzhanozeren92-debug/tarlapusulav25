# Mapbox harita bağlantısı

Ana harita, tarla çizimi, uydu sağlığı ve GL veri haritaları public Mapbox
anahtarı bulunduğunda Mapbox GL JS 3.30.0 ve Mapbox uydu görüntüsünü kullanır.
Anahtar yoksa mevcut MapLibre / Esri haritası çalışmaya devam eder.

1. Kendi Mapbox hesabından public access token oluştur (`pk.` ile başlar).
2. Vercel projesinde Settings → Environment Variables bölümüne
   `VITE_MAPBOX_ACCESS_TOKEN` adıyla ekle. Production ve kullanılan Preview
   ortamlarını seç. Secret token (`sk.`) kullanma.
3. Yeni deployment oluştur; Vite değişkeni build sırasında okur.

URL kısıtlaması kullanılıyorsa `https://tarlapusulanew.vercel.app` adresine ve
kullanılacak preview adreslerine izin verilmelidir. Yerel geliştirmede aynı
değişken `.env.local` dosyasına eklenir. Token kaynak koduna commit edilmez.

Açılışta geniş dünya görünümünden seçili tarlaya 2,4 saniyelik uçuş yapılır.
Aynı sekmenin oturumunda tekrar oynatılmaz; kullanıcı haritaya dokunduğunda
durur. Azaltılmış hareket tercihinde doğrudan tarla gösterilir.

Kaynaklar:
- https://docs.mapbox.com/mapbox-gl-js/guides/install/
- https://docs.mapbox.com/mapbox-gl-js/example/flyto/
