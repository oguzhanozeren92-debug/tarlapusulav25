export type KnowledgeGuideSection = readonly [title: string, body: string];

export type KnowledgeGuideEntry = {
  id: string;
  category: string;
  title: string;
  summary: string;
  sections: readonly KnowledgeGuideSection[];
};

export const KNOWLEDGE_GUIDE: readonly KnowledgeGuideEntry[] = [
  {
    id: 'ndvi',
    category: 'Uydu ve Tarım Teknolojisi',
    title: 'NDVI Nedir, Nasıl Yorumlanır?',
    summary:
      'Bitki örtüsündeki mekânsal ve zamansal değişimi uydu görüntülerinden izlemeye yardımcı olan vejetasyon indeksi.',
    sections: [
      [
        'Nasıl okunur?',
        'TarlaPusula ana NDVI haritasında 0,60 ve üzeri yüksek, 0,30–0,59 orta, 0,30 altı düşük NDVI olarak gösterilir. Bu sınıflar sayısal NDVI düzeyini anlatır; doğrudan “sağlıklı / hasta” teşhisi değildir.',
      ],
      [
        'Tek başına teşhis değildir',
        'NDVI değişimi hastalık, su stresi, beslenme, gelişim dönemi, çıplak toprak, bitki sıklığı veya hasat gibi farklı nedenlerden oluşabilir. Hava, fenoloji ve saha gözlemleriyle birlikte değerlendirilmelidir.',
      ],
      [
        'Göreli fark ne demek?',
        'Pusula “göreli fark” gösterdiğinde bir bölgenin NDVI ortalamasını parselin genel NDVI ortalamasıyla karşılaştırır. Bu, mutlak NDVI sınıfından ayrı bir karşılaştırmadır.',
      ],
    ],
  },
  {
    id: 'radar-vv',
    category: 'Uydu ve Tarım Teknolojisi',
    title: 'Sentinel-1 VV Neyi Gösterir?',
    summary:
      'Radarın VV polarizasyonu yüzeyin geri saçılım davranışını izler; nem, yüzey pürüzlülüğü ve yapı değişimleri bu sinyali etkileyebilir.',
    sections: [
      [
        'Tarımda ne işe yarar?',
        'Bulutlardan bağımsız radar gözlemleriyle parsel içindeki yüzey ve nem sinyali farklılıklarını takip etmeye yardımcı olur. Tek başına doğrudan toprak nem yüzdesi değildir.',
      ],
      [
        'Nasıl yorumlanmalı?',
        'VV değerindeki artış veya azalış; toprak nemi, yüzey pürüzlülüğü, bitki örtüsü ve bakış geometrisi gibi birden fazla etkenden kaynaklanabilir. Aynı tarlanın geçmiş verileriyle karşılaştırmak daha anlamlıdır.',
      ],
    ],
  },
  {
    id: 'radar-vh',
    category: 'Uydu ve Tarım Teknolojisi',
    title: 'Sentinel-1 VH Neyi Gösterir?',
    summary:
      'VH polarizasyonu bitki yapısı, yüzey ve hacim saçılımındaki farklılıkları izlemeye yardımcı olan radar sinyalidir.',
    sections: [
      [
        'Tarımda ne işe yarar?',
        'Bitki örtüsü yapısındaki ve yüzey koşullarındaki değişimlerin parsel içinde nerede farklılaştığını görmek için kullanılabilir.',
      ],
      [
        'Dikkat',
        'VH tek başına bitki sağlığı veya hastalık teşhisi değildir. Ürün dönemi, bitki yoğunluğu, yüzey koşulları ve VV gibi diğer verilerle birlikte değerlendirilmelidir.',
      ],
    ],
  },
  {
    id: 'radar-water',
    category: 'Uydu ve Tarım Teknolojisi',
    title: 'Su Birikimi Riski Nasıl Okunur?',
    summary:
      'Radar verisinde çevresine göre farklı su/yüzey sinyali gösteren alanları saha kontrolü için öne çıkaran katmandır.',
    sections: [
      [
        'Ne anlatır?',
        'Pusula bu katmanda radar geri saçılımındaki mekânsal farklılıkları kullanarak su birikimi veya doygun yüzey şüphesi olan bölgeleri işaretleyebilir.',
      ],
      [
        'Kesin su tespiti değildir',
        'Toprak yapısı, yüzey pürüzlülüğü, bitki örtüsü ve geçici yüzey koşulları benzer radar sinyalleri oluşturabilir. İşaretlenen alan saha gözlemiyle doğrulanmalıdır.',
      ],
    ],
  },
  {
    id: 'ph',
    category: 'Toprak',
    title: 'Toprak pH Değeri Ne Anlama Gelir?',
    summary:
      'Toprağın asitlik ve alkalilik durumunun besin alınabilirliğiyle ilişkisi.',
    sections: [
      [
        'Neden önemli?',
        'pH besin elementlerinin alınabilirliğini ve topraktaki biyolojik süreçleri etkiler. Kesin karar için uygun yöntemle alınmış laboratuvar analizi esas alınmalıdır.',
      ],
      [
        'Harita verisi nasıl kullanılmalı?',
        'SoilGrids gibi harita tabanlı toprak verileri parsel hakkında ön bilgi verir. Gübreleme veya düzeltme kararı için saha örneklemesi ve laboratuvar sonucu daha güçlü kanıttır.',
      ],
    ],
  },
  {
    id: 'organic',
    category: 'Toprak',
    title: 'Toprak Organik Maddesi ve Organik Karbon',
    summary:
      'Organik madde ve organik karbonun toprak yapısı, su tutma ve besin döngüsündeki rolü.',
    sections: [
      [
        'Görevi',
        'Organik madde agregat yapısını, su tutma kapasitesini, biyolojik faaliyeti ve besin döngüsünü destekler. Sonuçlar toprak bünyesi ve yerel koşullarla birlikte değerlendirilmelidir.',
      ],
      [
        'Harita tahmini',
        'Uydu/model tabanlı toprak karbon verileri laboratuvar analizi yerine geçmez; parsel içinde örnekleme planı ve genel karşılaştırma için yardımcı veri olarak kullanılmalıdır.',
      ],
    ],
  },
  {
    id: 'soil-texture',
    category: 'Toprak',
    title: 'Kil, Kum ve Silt Oranları Ne Anlatır?',
    summary:
      'Toprak bünyesini oluşturan kil, kum ve silt oranlarının su tutma, drenaj ve işlenebilirlikle ilişkisi.',
    sections: [
      [
        'Toprak bünyesi',
        'Kumlu topraklar genellikle daha hızlı drene olur; kil oranı yükseldikçe su ve besin tutma kapasitesi artabilir ancak havalanma ve işlenebilirlik değişebilir. Silt ara özellikler gösterebilir.',
      ],
      [
        'Tek başına yeterli değildir',
        'Sulama ve besleme kararı verirken bünye; organik madde, sıkışma, kök derinliği, eğim ve gerçek saha ölçümleriyle birlikte değerlendirilmelidir.',
      ],
    ],
  },
  {
    id: 'soil-moisture',
    category: 'Toprak ve Su',
    title: 'Toprak Nemi Verisi Neyi Gösterir?',
    summary:
      'Toprak profilindeki su durumunu izlemek ve sulama kararını desteklemek için kullanılan nem göstergelerine giriş.',
    sections: [
      [
        'Derinlik önemlidir',
        'Toprak nemi yüzeyde ve kök bölgesinde aynı olmayabilir. Katmanın gösterdiği derinlik ile ürünün etkili kök derinliği birlikte düşünülmelidir.',
      ],
      [
        'Sulama kararı',
        'Tek bir nem değeri yerine yağış, evapotranspirasyon, son sulama, toprak su tutma kapasitesi ve ürünün gelişim dönemiyle birlikte değerlendirme daha güvenlidir.',
      ],
    ],
  },
  {
    id: 'soil-temperature',
    category: 'İklim ve Toprak',
    title: 'Toprak Sıcaklığı Neyi Etkiler?',
    summary:
      'Kök bölgesindeki sıcaklığın çimlenme, kök faaliyeti ve biyolojik süreçlerle ilişkisi.',
    sections: [
      [
        'Neden önemli?',
        'Toprak sıcaklığı çimlenme, kök gelişimi, mikrobiyal faaliyet ve besin dönüşümlerini etkileyebilir. Uygun aralık ürün ve gelişim dönemine göre değişir.',
      ],
      [
        'Katman ne anlatır?',
        'Harita değeri seçilen derinlik ve veri kaynağının çözünürlüğünü temsil eder; bitki dokusu sıcaklığı veya her noktanın birebir saha ölçümü değildir.',
      ],
    ],
  },
  {
    id: 'air-temperature',
    category: 'İklim',
    title: 'Hava Sıcaklığı Tarımda Neyi Anlatır?',
    summary:
      'Bitki gelişimi, fenoloji, don/sıcak stresi ve işlem zamanlamasında kullanılan temel meteorolojik değişken.',
    sections: [
      [
        'Tek anlık değer yeterli değildir',
        'Minimum, maksimum ve saatlik sıcaklıkların süresi; ürün türü ve gelişim dönemiyle birlikte değerlendirilmelidir.',
      ],
      [
        'Tarla kararı',
        'İlaçlama, sulama ve don/sıcak stresi değerlendirmelerinde sıcaklık; rüzgâr, nem, yağış ve ürün bağlamıyla birlikte kullanılır.',
      ],
    ],
  },
  {
    id: 'surface-temperature',
    category: 'Uydu ve İklim',
    title: 'Yüzey Sıcaklığı (LST) Nedir?',
    summary:
      'Uydu veya model verisinden tahmin edilen arazi yüzeyi sıcaklığını gösterir; hava sıcaklığıyla aynı şey değildir.',
    sections: [
      [
        'Ne anlatır?',
        'Yüzey sıcaklığı bitki örtüsü, toprak nemi, güneşlenme ve yüzey özelliklerinden etkilenir. Parsel içinde sıcak bölgeleri karşılaştırmada yararlı olabilir.',
      ],
      [
        'Hava sıcaklığı değildir',
        'LST yüzeyin radyatif sıcaklığıdır. Meteoroloji istasyonundaki standart hava sıcaklığıyla doğrudan aynı değer beklenmemelidir.',
      ],
    ],
  },
  {
    id: 'et',
    category: 'Sulama',
    title: 'Evapotranspirasyon (ET) Nedir?',
    summary:
      'Toprak yüzeyinden buharlaşma ve bitkiden terleme yoluyla gerçekleşen toplam su kaybı.',
    sections: [
      [
        'ET₀ ve ETc',
        'Referans evapotranspirasyon (ET₀) atmosferin referans yüzeyden su talebini temsil eder. Ürün su tüketimi (ETc) için ürün katsayısı, gelişim dönemi ve saha koşulları gibi ek bilgiler gerekir.',
      ],
      [
        'Sulama miktarı değildir',
        'ET₀ değerini doğrudan “şu kadar sulama yap” şeklinde kullanmak doğru değildir. Yağış, toprak su durumu, sulama sistemi verimi ve kök bölgesi de hesaba katılmalıdır.',
      ],
    ],
  },
  {
    id: 'rainfall',
    category: 'İklim ve Su',
    title: 'Yağış Verisi Nasıl Okunur?',
    summary:
      'Belirli bir dönemde düşen yağış miktarını ve tarla su dengesine katkısını anlamaya yardımcı olan meteorolojik veri.',
    sections: [
      [
        'Toplam yağış tek başına yetmez',
        'Aynı toplam yağış farklı süre ve şiddette düştüğünde toprağa giriş, yüzey akışı ve bitkinin yararlanabileceği su miktarı değişebilir.',
      ],
      [
        'Sulamayla birlikte düşün',
        'Yağış; evapotranspirasyon, toprak nemi, son sulama ve hava tahminiyle birlikte değerlendirilerek sulama kararına katkı verir.',
      ],
    ],
  },
  {
    id: 'nitrogen',
    category: 'Bitki Besleme',
    title: 'Azot: Bitkide Görevi ve Eksiklik Şüphesi',
    summary:
      'Azotun büyüme ve klorofil oluşumundaki rolü ile gözlenebilen işaretler.',
    sections: [
      [
        'Dikkat',
        'Yaprak rengi tek başına azot eksikliğini kanıtlamaz. Su stresi, kök sorunu ve başka beslenme sorunları benzer belirti oluşturabilir. Fotoğraftan kesin azot miktarı belirlenemez.',
      ],
    ],
  },
  {
    id: 'irrigation',
    category: 'Sulama',
    title: 'Sulama Zamanı Nasıl Belirlenir?',
    summary:
      'Hava, toprak, ürün dönemi ve kök bölgesini birlikte değerlendirme.',
    sections: [
      [
        'Tek veri yeterli değildir',
        'Sulama zamanı; yağış, evapotranspirasyon, kök bölgesi su durumu, toprağın su tutma kapasitesi, ürünün gelişim dönemi ve son sulama kaydı birlikte değerlendirilerek belirlenir.',
      ],
    ],
  },
  {
    id: 'sampling',
    category: 'Tarla İşlemleri',
    title: 'Toprak Örneği Nasıl Alınır?',
    summary:
      'Laboratuvar sonucunun tarlayı temsil etmesi için doğru örnekleme yaklaşımı.',
    sections: [
      [
        'Temsil edici örnek',
        'Benzer özellikteki bölümden birden fazla noktadan alt örnek alınarak karıştırılır. Yol kenarı, yığın ve su birikintisi gibi sıra dışı noktalar genel örneğe dahil edilmemelidir.',
      ],
    ],
  },
  {
    id: 'scouting',
    category: 'Hastalık ve Zararlılar',
    title: 'Tarla Gözlemi Nasıl Yapılır?',
    summary:
      'Sorunu erken fark etmek için düzenli ve kayıtlı tarla kontrolünün temelleri.',
    sections: [
      [
        'Düzenli izleme',
        'Tarla farklı bölgeleri temsil edecek biçimde gezilmeli; yaprak, gövde, kök ve ürün belirtileri incelenmeli; fotoğraf, tarih ve konum kaydedilmelidir.',
      ],
    ],
  },
  {
    id: 'ipm',
    category: 'Hastalık ve Zararlılar',
    title: 'Entegre Mücadele Nedir?',
    summary:
      'Gözlem, kültürel ve biyolojik yöntemleri birlikte ele alan yaklaşım.',
    sections: [
      [
        'Temel yaklaşım',
        'Doğru teşhis, düzenli izleme ve uygun yöntemin doğru zamanda seçilmesi esastır. Yerel eşikler ve resmî tavsiyeler dikkate alınmalıdır.',
      ],
    ],
  },
  {
    id: 'phenology',
    category: 'Bitkisel Üretim',
    title: 'Fenoloji: Bitkinin Gelişim Dönemini Bilmek',
    summary:
      'Ekim, çıkış, vejetatif gelişim, çiçeklenme ve olgunlaşma dönemlerinin kararlarla ilişkisi.',
    sections: [
      [
        'Neden önemli?',
        'Bitkinin su ve besin ihtiyacı ile bazı riskler gelişim dönemine göre değişir. Takvim tarihi tek başına gelişim dönemini kesin olarak göstermez.',
      ],
    ],
  },
  {
    id: 'salinity',
    category: 'Toprak',
    title: 'Toprak Tuzluluğu Nedir?',
    summary:
      'Çözünmüş tuzların bitki su alımı ve gelişimi üzerindeki etkisine giriş.',
    sections: [
      [
        'Ölçüm önemlidir',
        'Tuzluluk bitkinin su almasını zorlaştırabilir. Kesin değerlendirme için uygun toprak veya sulama suyu analizindeki elektriksel iletkenlik gibi ölçümler kullanılmalıdır.',
      ],
    ],
  },
  {
    id: 'compaction',
    category: 'Toprak',
    title: 'Toprak Sıkışması ve Kök Gelişimi',
    summary:
      'Sıkışmış tabakaların köklenme, su hareketi ve havalanma üzerindeki olası etkileri.',
    sections: [
      [
        'Saha işaretleri',
        'Köklerin belirli derinlikte yön değiştirmesi, suyun yüzeyde kalması ve teker izlerinde gelişim farkları sıkışma şüphesi oluşturabilir. Tek belirti kesin teşhis değildir.',
      ],
    ],
  },
  {
    id: 'infiltration',
    category: 'Toprak',
    title: 'Su İnfiltrasyonu Nedir?',
    summary:
      'Yağış veya sulama suyunun toprak yüzeyinden profile girişini anlamak.',
    sections: [
      [
        'Neyi etkiler?',
        'Toprak yapısı, yüzey kabuklaşması, sıkışma, organik madde, bitki örtüsü ve başlangıç nemi suyun toprağa giriş hızını etkileyebilir.',
      ],
    ],
  },
  {
    id: 'erosion',
    category: 'Toprak',
    title: 'Su ve Rüzgâr Erozyonu',
    summary:
      'Verimli üst toprağın taşınmasına yol açan süreçleri tanıma.',
    sections: [
      [
        'Saha işaretleri',
        'Yüzey akış izleri, küçük yarıntılar, sediment birikimi veya rüzgârla taşınan ince toprak erozyon riskine işaret edebilir.',
      ],
    ],
  },
  {
    id: 'cover',
    category: 'Toprak Sağlığı',
    title: 'Örtü Bitkileri ve Toprak Sağlığı',
    summary:
      'Toprağın çıplak kaldığı dönemleri azaltmaya yönelik koruyucu tarım yaklaşımı.',
    sections: [
      [
        'Planlama',
        'Örtü bitkisi seçimi iklim, toprak, ana ürün, su durumu ve yönetim hedefine göre yapılmalıdır. Her tür her üretim sistemine uygun değildir.',
      ],
    ],
  },
] as const;

export function getKnowledgeGuideEntry(id: string | null | undefined) {
  if (!id) return null;
  return KNOWLEDGE_GUIDE.find((entry) => entry.id === id) ?? null;
}

export type MapKnowledgeContext = {
  activeLayer?: string | null;
  soilProperty?: string | null;
  climateLayer?: string | null;
};

export type MapKnowledgeQuickLink = {
  entryId: string;
  buttonLabel: string;
};

export function resolveMapKnowledgeQuickLink({
  activeLayer,
  soilProperty,
  climateLayer,
}: MapKnowledgeContext): MapKnowledgeQuickLink | null {
  switch (activeLayer) {
    case 'vegetation':
      return { entryId: 'ndvi', buttonLabel: 'NDVI nedir?' };
    case 'radar-vv':
      return { entryId: 'radar-vv', buttonLabel: 'VV neyi gösterir?' };
    case 'radar-vh':
      return { entryId: 'radar-vh', buttonLabel: 'VH neyi gösterir?' };
    case 'radar-water':
      return { entryId: 'radar-water', buttonLabel: 'Su riski nasıl okunur?' };
    case 'surface-temperature':
      return { entryId: 'surface-temperature', buttonLabel: 'Yüzey sıcaklığı nedir?' };
    case 'evapotranspiration':
      return { entryId: 'et', buttonLabel: 'ET₀ nedir?' };
    case 'rainfall-history':
      return { entryId: 'rainfall', buttonLabel: 'Yağış verisi nasıl okunur?' };
    case 'soil':
      if (soilProperty === 'phh2o') {
        return { entryId: 'ph', buttonLabel: 'pH nedir?' };
      }
      if (soilProperty === 'soc') {
        return { entryId: 'organic', buttonLabel: 'Organik karbon nedir?' };
      }
      return { entryId: 'soil-texture', buttonLabel: 'Toprak bünyesi nedir?' };
    case 'climate':
      if (climateLayer === 'soil-moisture') {
        return { entryId: 'soil-moisture', buttonLabel: 'Toprak nemi nedir?' };
      }
      if (climateLayer === 'soil-temperature') {
        return { entryId: 'soil-temperature', buttonLabel: 'Toprak sıcaklığı nedir?' };
      }
      if (climateLayer === 'air-temperature') {
        return { entryId: 'air-temperature', buttonLabel: 'Hava sıcaklığı ne anlatır?' };
      }
      if (climateLayer === 'precipitation') {
        return { entryId: 'rainfall', buttonLabel: 'Yağış verisi nasıl okunur?' };
      }
      return null;
    default:
      return null;
  }
}
