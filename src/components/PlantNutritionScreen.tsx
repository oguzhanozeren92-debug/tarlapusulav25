import {
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import type { Field, Screen } from '../types';
import './PlantNutritionScreen.css';

export type NutrientRisk =
  | 'adequate'
  | 'medium_risk'
  | 'low_risk';

export interface NutrientItem {
  id: string;
  name: string;
  symbol: string;
  type: 'macro' | 'micro';
  description: string;
  riskStatus: NutrientRisk;
  cropFieldStatus?: {
    fieldName: string;
    crop: string;
    status: NutrientRisk;
  }[];
  symptoms: {
    title: string;
    imageUrl: string;
  }[];
  consequences: string;
  excessSymptoms: string;
  fertilizerSources: {
    name: string;
    percentage: string;
    imageUrl?: string;
  }[];
  recommendations: string[];
  heroImage: string;
}

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface PlantNutritionScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type CropFilter =
  | 'wheat'
  | 'barley'
  | 'corn'
  | 'almond'
  | 'all';

type DetailTab =
  | 'general'
  | 'deficiency'
  | 'excess'
  | 'sources'
  | 'recommendations';

type IconName =
  | 'brand'
  | 'back'
  | 'menu'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'leaf'
  | 'search'
  | 'crop'
  | 'seed'
  | 'bag'
  | 'info'
  | 'flask'
  | 'arrowRight'
  | 'close'
  | 'chevron'
  | 'check'
  | 'warning'
  | 'microscope';

const IMAGE = {
  wheat:
    'https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?auto=format&fit=crop&w=1200&q=82',
  leaf:
    'https://images.unsplash.com/photo-1531058240690-006c446962d8?auto=format&fit=crop&w=1000&q=82',
  crop:
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=1000&q=82',
  green:
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=82',
  soil:
    'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?auto=format&fit=crop&w=1000&q=82',
  fertilizer:
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1000&q=82',
};

const NUTRIENTS: NutrientItem[] = [
  {
    id: 'nitrogen',
    name: 'Azot',
    symbol: 'N',
    type: 'macro',
    description:
      'Bitkide aminoasit, protein, klorofil ve yeşil aksam gelişiminin temel bileşenlerinden biridir.',
    riskStatus: 'medium_risk',
    heroImage: IMAGE.wheat,
    symptoms: [
      {
        title: 'Yaşlı yapraklarda sararma',
        imageUrl: IMAGE.wheat,
      },
      {
        title: 'Genel gelişimde yavaşlama',
        imageUrl: IMAGE.crop,
      },
      {
        title: 'Yapraklar küçük ve soluk kalır',
        imageUrl: IMAGE.leaf,
      },
      {
        title: 'Kardeşlenme azalabilir',
        imageUrl: IMAGE.green,
      },
    ],
    consequences:
      'Eksiklik uzadığında yaprak alanı ve fotosentez kapasitesi düşebilir; bitki zayıf gelişebilir ve verim potansiyeli sınırlanabilir.',
    excessSymptoms:
      'Aşırı azot, aşırı ve yumuşak vejetatif gelişime, yatma riskinin artmasına, olgunlaşmanın gecikmesine ve bazı hastalıklara hassasiyetin yükselmesine katkıda bulunabilir.',
    fertilizerSources: [
      {
        name: 'Üre',
        percentage: '%46 N',
        imageUrl: IMAGE.fertilizer,
      },
      {
        name: 'Amonyum Nitrat',
        percentage: 'yaklaşık %33 N',
        imageUrl: IMAGE.fertilizer,
      },
      {
        name: 'Amonyum Sülfat',
        percentage: 'yaklaşık %21 N',
        imageUrl: IMAGE.fertilizer,
      },
      {
        name: 'CAN',
        percentage: 'yaklaşık %26 N',
        imageUrl: IMAGE.fertilizer,
      },
    ],
    recommendations: [
      'Azot kararını toprak analizi, ürün gelişim dönemi ve hedef verimle birlikte değerlendirin.',
      'Tek seferde yüksek uygulama yerine ürün ve toprak koşullarına uygun bölünmüş uygulama gerekebilir.',
      'Yağış ve sulama koşulları azot kayıplarını etkileyebilir.',
    ],
  },
  {
    id: 'phosphorus',
    name: 'Fosfor',
    symbol: 'P',
    type: 'macro',
    description:
      'Enerji transferi, kök gelişimi, çiçeklenme ve erken dönem bitki gelişimi için önemli bir makro besindir.',
    riskStatus: 'low_risk',
    heroImage: IMAGE.soil,
    symptoms: [
      { title: 'Zayıf kök gelişimi', imageUrl: IMAGE.soil },
      { title: 'Yavaş ve bodur gelişim', imageUrl: IMAGE.crop },
      { title: 'Koyu yeşil / morumsu tonlar', imageUrl: IMAGE.leaf },
      { title: 'Geç olgunlaşma eğilimi', imageUrl: IMAGE.wheat },
    ],
    consequences:
      'Kök gelişimi zayıflayabilir, erken dönem gelişim yavaşlayabilir ve çiçeklenme/olgunlaşma süreçleri olumsuz etkilenebilir.',
    excessSymptoms:
      'Aşırı fosfor doğrudan toksisite yerine demir ve çinko gibi mikro besinlerin alımını baskılayabilir.',
    fertilizerSources: [
      { name: 'DAP', percentage: '%18 N + %46 P₂O₅', imageUrl: IMAGE.fertilizer },
      { name: 'MAP', percentage: '%11 N + %52 P₂O₅', imageUrl: IMAGE.fertilizer },
      { name: 'TSP', percentage: 'yaklaşık %46 P₂O₅', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Fosforun toprakta hareketliliği düşüktür; uygulama yeri ve kök bölgesine erişim önemlidir.',
      'Toprak pH değeri fosfor yarayışlılığını güçlü biçimde etkiler.',
      'Doz kararı için mutlaka toprak analizindeki yarayışlı fosfor sonucunu kullanın.',
    ],
  },
  {
    id: 'potassium',
    name: 'Potasyum',
    symbol: 'K',
    type: 'macro',
    description:
      'Su dengesi, stoma hareketleri, dayanıklılık, ürün kalitesi ve birçok enzimatik süreçte rol oynar.',
    riskStatus: 'medium_risk',
    heroImage: IMAGE.leaf,
    symptoms: [
      { title: 'Yaşlı yaprak kenarlarında sararma', imageUrl: IMAGE.leaf },
      { title: 'Yaprak kenarlarında yanıklık', imageUrl: IMAGE.crop },
      { title: 'Zayıf sap ve dayanıklılık', imageUrl: IMAGE.wheat },
      { title: 'Kalite ve dolumda düşüş', imageUrl: IMAGE.green },
    ],
    consequences:
      'Bitkinin su kullanım etkinliği, stres toleransı ve kalite özellikleri zayıflayabilir.',
    excessSymptoms:
      'Aşırı potasyum magnezyum ve kalsiyum alımında antagonizmaya neden olabilir.',
    fertilizerSources: [
      { name: 'Potasyum Sülfat', percentage: 'yaklaşık %50 K₂O', imageUrl: IMAGE.fertilizer },
      { name: 'Potasyum Klorür', percentage: 'yaklaşık %60 K₂O', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Klor hassasiyeti olan ürünlerde gübre formunu ürün özelinde değerlendirin.',
      'Potasyum gereksinimi ürünün hasat edilen organına ve hedef kaliteye göre değişir.',
    ],
  },
  {
    id: 'calcium',
    name: 'Kalsiyum',
    symbol: 'Ca',
    type: 'macro',
    description:
      'Hücre duvarı yapısı, hücre bölünmesi ve yeni dokuların sağlıklı gelişimi için önemlidir.',
    riskStatus: 'adequate',
    heroImage: IMAGE.green,
    symptoms: [
      { title: 'Genç dokularda bozulma', imageUrl: IMAGE.green },
      { title: 'Uç yanıklığı', imageUrl: IMAGE.leaf },
      { title: 'Kök uçlarında gelişim sorunu', imageUrl: IMAGE.soil },
      { title: 'Meyvede fizyolojik bozukluk', imageUrl: IMAGE.crop },
    ],
    consequences:
      'Yeni büyüme noktaları ve hızlı gelişen dokular etkilenebilir; bazı ürünlerde uç yanıklığı ve meyve dokusu bozuklukları görülebilir.',
    excessSymptoms:
      'Yüksek kalsiyum seviyeleri magnezyum ve potasyum dengesini etkileyebilir.',
    fertilizerSources: [
      { name: 'Kalsiyum Nitrat', percentage: 'Ca + N kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Kireçtaşı / Kalsit', percentage: 'Toprak düzenleyici Ca kaynağı', imageUrl: IMAGE.soil },
    ],
    recommendations: [
      'Kalsiyum taşınımı su hareketine bağlıdır; sulama düzeni kritik olabilir.',
      'Toprak pH düzenleme amacıyla kireçleme yapılacaksa analiz sonucu esas alınmalıdır.',
    ],
  },
  {
    id: 'magnesium',
    name: 'Magnezyum',
    symbol: 'Mg',
    type: 'macro',
    description:
      'Klorofil molekülünün merkez atomudur ve fotosentez ile birçok enzimatik reaksiyonda rol oynar.',
    riskStatus: 'adequate',
    heroImage: IMAGE.leaf,
    symptoms: [
      { title: 'Yaşlı yapraklarda damar arası sararma', imageUrl: IMAGE.leaf },
      { title: 'Damarların yeşil kalması', imageUrl: IMAGE.crop },
      { title: 'Fotosentezde zayıflama', imageUrl: IMAGE.green },
      { title: 'İleri durumda nekroz', imageUrl: IMAGE.wheat },
    ],
    consequences:
      'Klorofil üretimi ve fotosentez kapasitesi düşebilir; özellikle yaşlı yapraklarda damar arası kloroz görülebilir.',
    excessSymptoms:
      'Çok yüksek magnezyum potasyum ve kalsiyum dengesini bozabilir.',
    fertilizerSources: [
      { name: 'Magnezyum Sülfat', percentage: 'Mg + S kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Dolomit', percentage: 'Ca + Mg kaynağı', imageUrl: IMAGE.soil },
    ],
    recommendations: [
      'K ve Mg arasındaki dengeyi birlikte değerlendirin.',
      'pH ve katyon değişim kapasitesi sonucu, Mg yorumunu daha güvenilir hale getirir.',
    ],
  },
  {
    id: 'sulfur',
    name: 'Kükürt',
    symbol: 'S',
    type: 'macro',
    description:
      'Bazı aminoasitlerin, proteinlerin ve enzimlerin yapısında bulunur; azot kullanım verimliliği ile ilişkilidir.',
    riskStatus: 'low_risk',
    heroImage: IMAGE.wheat,
    symptoms: [
      { title: 'Genç yapraklarda açık renk', imageUrl: IMAGE.wheat },
      { title: 'Genel sararma', imageUrl: IMAGE.leaf },
      { title: 'İnce ve zayıf gelişim', imageUrl: IMAGE.crop },
      { title: 'Protein oluşumunda sınırlanma', imageUrl: IMAGE.green },
    ],
    consequences:
      'Protein sentezi ve azotun etkin kullanımı sınırlanabilir; genç dokularda açık renkli gelişim görülebilir.',
    excessSymptoms:
      'Aşırı sülfat tuzluluğu artırabilir; elementel kükürt aşırı kullanılırsa pH gereğinden fazla düşebilir.',
    fertilizerSources: [
      { name: 'Amonyum Sülfat', percentage: 'N + S kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Potasyum Sülfat', percentage: 'K + S kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Elementel Kükürt', percentage: 'S kaynağı / pH yönetimi', imageUrl: IMAGE.soil },
    ],
    recommendations: [
      'Kükürt ihtiyacını toprak pH ve organik madde durumu ile birlikte değerlendirin.',
      'Elementel kükürt pH yönetimi için kullanılacaksa doz analiz ve uzman tavsiyesine dayanmalıdır.',
    ],
  },
  {
    id: 'iron',
    name: 'Demir',
    symbol: 'Fe',
    type: 'micro',
    description:
      'Klorofil oluşumu ve elektron taşınımı gibi metabolik süreçlerde görev alan mikro besindir.',
    riskStatus: 'medium_risk',
    heroImage: IMAGE.leaf,
    symptoms: [
      { title: 'Genç yapraklarda damar arası sararma', imageUrl: IMAGE.leaf },
      { title: 'Damarların daha yeşil kalması', imageUrl: IMAGE.green },
      { title: 'İleri kloroz', imageUrl: IMAGE.crop },
      { title: 'Yeni sürgünlerde zayıflama', imageUrl: IMAGE.wheat },
    ],
    consequences:
      'Yeni yapraklarda klorofil oluşumu sınırlanabilir ve belirgin damar arası kloroz görülebilir.',
    excessSymptoms:
      'Asit ve suya doygun koşullarda yüksek Fe bazı bitkilerde toksisite oluşturabilir.',
    fertilizerSources: [
      { name: 'Demir Şelatı', percentage: 'Fe-EDDHA / Fe-EDTA ürününe göre', imageUrl: IMAGE.fertilizer },
      { name: 'Demir Sülfat', percentage: 'Fe kaynağı', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Kireçli ve yüksek pH topraklarda toplam Fe yüksek olsa da bitkiye yarayışlılık düşük olabilir.',
      'Şelat formu seçimi toprak pH değerine göre yapılmalıdır.',
    ],
  },
  {
    id: 'zinc',
    name: 'Çinko',
    symbol: 'Zn',
    type: 'micro',
    description:
      'Enzim aktivitesi, hormon dengesi ve sürgün gelişiminde rol alan önemli bir mikro besindir.',
    riskStatus: 'medium_risk',
    heroImage: IMAGE.crop,
    symptoms: [
      { title: 'Boğum aralarının kısalması', imageUrl: IMAGE.crop },
      { title: 'Küçük yaprak oluşumu', imageUrl: IMAGE.leaf },
      { title: 'Damar arası kloroz', imageUrl: IMAGE.green },
      { title: 'Zayıf sürgün gelişimi', imageUrl: IMAGE.wheat },
    ],
    consequences:
      'Sürgün büyümesi ve yaprak gelişimi zayıflayabilir; özellikle yüksek pH ve yüksek fosforlu koşullarda eksiklik riski artabilir.',
    excessSymptoms:
      'Aşırı çinko demir ve mangan alımını baskılayabilir.',
    fertilizerSources: [
      { name: 'Çinko Sülfat', percentage: 'Zn kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Zn Şelatları', percentage: 'Formülasyona göre', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Toprak ve yaprak analizini birlikte değerlendirmek Zn teşhisini güçlendirir.',
    ],
  },
  {
    id: 'manganese',
    name: 'Mangan',
    symbol: 'Mn',
    type: 'micro',
    description:
      'Fotosentez, enzim aktivitesi ve azot metabolizmasında görev alan mikro elementtir.',
    riskStatus: 'adequate',
    heroImage: IMAGE.green,
    symptoms: [
      { title: 'Damar arası kloroz', imageUrl: IMAGE.leaf },
      { title: 'Küçük beneklenmeler', imageUrl: IMAGE.crop },
      { title: 'Gelişim geriliği', imageUrl: IMAGE.green },
      { title: 'Fotosentezde zayıflama', imageUrl: IMAGE.wheat },
    ],
    consequences:
      'Fotosentez ve metabolizma etkilenebilir; belirtiler çoğu zaman diğer mikro besin eksiklikleriyle karışabilir.',
    excessSymptoms:
      'Asit topraklarda aşırı yarayışlı Mn toksisiteye ve kahverengi beneklere neden olabilir.',
    fertilizerSources: [
      { name: 'Mangan Sülfat', percentage: 'Mn kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Mn Şelatları', percentage: 'Formülasyona göre', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'pH, Fe ve Mn dengesini birlikte yorumlayın.',
    ],
  },
  {
    id: 'copper',
    name: 'Bakır',
    symbol: 'Cu',
    type: 'micro',
    description:
      'Enzimler, lignin oluşumu ve üreme organlarının sağlıklı gelişiminde rol oynayan mikro elementtir.',
    riskStatus: 'adequate',
    heroImage: IMAGE.green,
    symptoms: [
      { title: 'Genç yapraklarda solgunluk', imageUrl: IMAGE.leaf },
      { title: 'Sürgün uçlarında zayıflama', imageUrl: IMAGE.green },
      { title: 'Başak / çiçek gelişiminde sorun', imageUrl: IMAGE.wheat },
      { title: 'Yaprak uçlarında kıvrılma', imageUrl: IMAGE.crop },
    ],
    consequences:
      'Sürgün gelişimi, lignifikasyon ve üreme dokularının gelişimi etkilenebilir.',
    excessSymptoms:
      'Aşırı bakır kök gelişimini baskılayabilir ve demir alımını etkileyebilir.',
    fertilizerSources: [
      { name: 'Bakır Sülfat', percentage: 'Cu kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Cu Şelatları', percentage: 'Formülasyona göre', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Bakır içeren bitki koruma ürünleri kullanılıyorsa toplam Cu yükünü göz önünde bulundurun.',
    ],
  },
  {
    id: 'boron',
    name: 'Bor',
    symbol: 'B',
    type: 'micro',
    description:
      'Hücre duvarı, çiçeklenme, polen canlılığı ve şeker taşınımında önemli rol oynar.',
    riskStatus: 'low_risk',
    heroImage: IMAGE.leaf,
    symptoms: [
      { title: 'Büyüme noktalarında ölüm', imageUrl: IMAGE.green },
      { title: 'Kırılgan genç dokular', imageUrl: IMAGE.leaf },
      { title: 'Çiçeklenme / meyve tutumunda sorun', imageUrl: IMAGE.crop },
      { title: 'Kök uçlarında zayıflama', imageUrl: IMAGE.soil },
    ],
    consequences:
      'Büyüme noktaları ve üreme organları etkilenebilir; eksiklik ile toksisite arasındaki güvenli aralık bazı ürünlerde dardır.',
    excessSymptoms:
      'Bor fazlalığı çoğunlukla yaşlı yaprak uç ve kenarlarında yanıklık ve nekroza yol açabilir.',
    fertilizerSources: [
      { name: 'Boraks', percentage: 'B kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Borik Asit', percentage: 'B kaynağı', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Bor uygulamasında analiz ve ürün hassasiyeti özellikle önemlidir; dar güvenlik aralığı nedeniyle gelişigüzel doz kullanmayın.',
    ],
  },
  {
    id: 'molybdenum',
    name: 'Molibden',
    symbol: 'Mo',
    type: 'micro',
    description:
      'Nitrat indirgenmesi ve baklagillerde biyolojik azot fiksasyonu için gerekli mikro elementtir.',
    riskStatus: 'adequate',
    heroImage: IMAGE.green,
    symptoms: [
      { title: 'Azot eksikliğine benzer solgunluk', imageUrl: IMAGE.wheat },
      { title: 'Zayıf büyüme', imageUrl: IMAGE.crop },
      { title: 'Yapraklarda şekil bozukluğu', imageUrl: IMAGE.leaf },
      { title: 'Baklagillerde nodül işlevinde zayıflama', imageUrl: IMAGE.green },
    ],
    consequences:
      'Nitrat metabolizması ve bazı bitkilerde azot fiksasyonu zayıflayabilir.',
    excessSymptoms:
      'Bitkiler Mo fazlalığına çoğu zaman toleranslıdır ancak yem bitkilerinde hayvan besleme açısından yüksek Mo düzeyleri önem taşıyabilir.',
    fertilizerSources: [
      { name: 'Sodyum Molibdat', percentage: 'Mo kaynağı', imageUrl: IMAGE.fertilizer },
      { name: 'Amonyum Molibdat', percentage: 'Mo kaynağı', imageUrl: IMAGE.fertilizer },
    ],
    recommendations: [
      'Asit topraklarda Mo yarayışlılığı düşebilir; pH yönetimini analizle birlikte değerlendirin.',
    ],
  },
];

const QUICK_GUIDE = [
  { symptom: 'Yaşlı yapraklarda genel sararma', nutrient: 'Azot (N)' },
  { symptom: 'Yaprak kenarlarında yanma', nutrient: 'Potasyum (K)' },
  { symptom: 'Genç yapraklarda damar arası sararma', nutrient: 'Demir (Fe)' },
  { symptom: 'Kötü kök gelişimi / morumsu ton', nutrient: 'Fosfor (P)' },
  { symptom: 'Uç yanıklığı ve genç doku bozukluğu', nutrient: 'Kalsiyum (Ca)' },
];

const CROP_FILTERS: Array<{
  id: CropFilter;
  label: string;
}> = [
  { id: 'wheat', label: 'Buğday' },
  { id: 'barley', label: 'Arpa' },
  { id: 'corn', label: 'Mısır' },
  { id: 'almond', label: 'Badem' },
  { id: 'all', label: 'Tüm Ürünler' },
];

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'brand':
      return (
        <svg {...common}>
          <path d="M12 21c4.3-2.9 7-6.6 7-11.1C19 6 16 3 12 3S5 6 5 9.9C5 14.4 7.7 18.1 12 21Z" />
          <path d="M12 17V8" />
          <path d="M12 12c-2.5-.2-4.1-1.3-5-3M12 10c2.3-.1 4-1 5-2.6" />
        </svg>
      );
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'menu':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 11 9-7 9 7" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </svg>
      );
    case 'field':
      return (
        <svg {...common}>
          <path d="M4 20c4-7 8-11 16-16" />
          <path d="M4 15c4 0 7 1 10 5M9 8c3 0 5 1 7 3" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
          <path d="m18.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M20 4c-8 0-14 4-14 10 0 3 2 5 5 5 6 0 9-7 9-15Z" />
          <path d="M5 20c2-5 6-8 11-11" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case 'crop':
      return (
        <svg {...common}>
          <path d="M12 21V5M12 9c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5Z" />
          <path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
        </svg>
      );
    case 'seed':
      return (
        <svg {...common}>
          <path d="M12 20v-8M12 13c-4 0-7-3-7-7 4 0 7 3 7 7ZM12 15c4 0 7-3 7-7-4 0-7 3-7 7Z" />
        </svg>
      );
    case 'bag':
      return (
        <svg {...common}>
          <path d="M8 3h8l1 4 3 4-2 10H6L4 11l3-4 1-4Z" />
          <path d="M8 7h8" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      );
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" />
          <path d="M7.5 15h9" />
        </svg>
      );
    case 'arrowRight':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'close':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      );
    case 'microscope':
      return (
        <svg {...common}>
          <path d="m9 3 5 5M7 5l5 5M13 8l-4 4M8 12a5 5 0 0 0 7 7M5 21h14" />
          <path d="M15 12a4 4 0 0 1-4 4" />
        </svg>
      );
  }
}

function normalizeText(value: string) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function menuIcon(item: MenuItem): IconName {
  const label = normalizeText(item.label);

  if (item.screen === 'home') return 'home';
  if (label.includes('takvim')) return 'calendar';
  if (label.includes('ai')) return 'ai';
  if (label.includes('tarla')) return 'field';
  if (label.includes('besin')) return 'leaf';

  return 'chevron';
}

function riskLabel(risk: NutrientRisk) {
  if (risk === 'adequate') return 'Yeterli / İyi';
  if (risk === 'medium_risk') return 'Orta Risk';
  return 'Düşük / Kritik';
}

function riskScore(risk: NutrientRisk) {
  if (risk === 'adequate') return 82;
  if (risk === 'medium_risk') return 56;
  return 28;
}

function cropFilterMatches(
  cropName: string,
  filter: CropFilter,
) {
  if (filter === 'all') return true;

  const crop = normalizeText(cropName);

  if (filter === 'wheat') return crop.includes('bugday');
  if (filter === 'barley') return crop.includes('arpa');
  if (filter === 'corn') return crop.includes('misir');
  if (filter === 'almond') return crop.includes('badem');

  return true;
}

function fieldRiskForIndex(index: number): NutrientRisk {
  if (index % 3 === 1) return 'adequate';
  if (index % 3 === 2) return 'low_risk';
  return 'medium_risk';
}

export default function PlantNutritionScreen({
  fields,
  selectedFieldId = '',
  screen = 'nutritionHub',
  desktopMenuItems = [],
  sideMenuOpen = false,
  setScreen,
  setSideMenuOpen = () => undefined,
}: PlantNutritionScreenProps) {
  const realFields = useMemo(
    () => fields.filter((field) => !field.demo),
    [fields],
  );

  const selectedField = useMemo(
    () =>
      realFields.find(
        (field) => String(field.id) === String(selectedFieldId),
      ) ??
      realFields[0] ??
      null,
    [realFields, selectedFieldId],
  );

  const defaultCropFilter = useMemo<CropFilter>(() => {
    const crop = normalizeText(selectedField?.crop ?? '');

    if (crop.includes('bugday')) return 'wheat';
    if (crop.includes('arpa')) return 'barley';
    if (crop.includes('misir')) return 'corn';
    if (crop.includes('badem')) return 'almond';

    return 'all';
  }, [selectedField]);

  const [cropFilter, setCropFilter] =
    useState<CropFilter>(defaultCropFilter);
  const [search, setSearch] = useState('');
  const [selectedNutrientId, setSelectedNutrientId] =
    useState('nitrogen');
  const [detailTab, setDetailTab] =
    useState<DetailTab>('general');

  const guideRef = useRef<HTMLElement | null>(null);
  const deficiencyRef = useRef<HTMLElement | null>(null);
  const sourcesRef = useRef<HTMLElement | null>(null);

  const selectedNutrient =
    NUTRIENTS.find(
      (nutrient) => nutrient.id === selectedNutrientId,
    ) ?? NUTRIENTS[0];

  const mainNutrients = useMemo(() => {
    const query = normalizeText(search);

    return NUTRIENTS.filter(
      (nutrient) =>
        nutrient.type === 'macro' &&
        (!query ||
          normalizeText(
            `${nutrient.name} ${nutrient.symbol} ${nutrient.description}`,
          ).includes(query)),
    );
  }, [search]);

  const microNutrients = useMemo(
    () => NUTRIENTS.filter((nutrient) => nutrient.type === 'micro'),
    [],
  );

  const visibleFieldCards = useMemo(() => {
    const cropFiltered = realFields.filter((field) =>
      cropFilterMatches(field.crop ?? '', cropFilter),
    );

    const base = cropFiltered.length ? cropFiltered : realFields;

    return base.slice(0, 4).map((field, index) => ({
      field,
      status: fieldRiskForIndex(index),
      riskCount:
        fieldRiskForIndex(index) === 'adequate'
          ? 0
          : fieldRiskForIndex(index) === 'medium_risk'
            ? 3
            : 2,
    }));
  }, [realFields, cropFilter]);

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const sidebarItems = desktopMenuItems.filter(
    (item) => item.screen !== 'adminHub',
  );

  const selectNutrient = (id: string) => {
    setSelectedNutrientId(id);
    setDetailTab('general');
    guideRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="tp-nutrition-page">
      <aside className="tp-nutrition-sidebar">
        <div className="tp-nutrition-brand">
          <span><Icon name="brand" size={21} /></span>
          <div>
            <strong>TarlaPusula</strong>
            <small>Akıllı üretici paneli</small>
          </div>
        </div>

        <nav>
          {sidebarItems.map((item, index) => (
            <button
              key={`${item.screen}-${item.label}-${index}`}
              type="button"
              className={item.screen === screen ? 'active' : ''}
              onClick={() => navigate(item.screen as Screen)}
            >
              <span>
                <Icon name={menuIcon(item)} size={17} />
              </span>
              <strong>{item.label}</strong>
              {item.badge && <i>{item.badge}</i>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="tp-nutrition-content">
        <header className="tp-nutrition-topbar">
          <button
            type="button"
            onClick={() => navigate('home')}
            aria-label="Ana sayfaya dön"
          >
            <Icon name="back" size={18} />
          </button>

          <div>
            <strong>Bitki Besin Maddeleri Rehberi</strong>
            <small>
              Besin elementleri · eksiklik belirtileri · gübre kaynakları
            </small>
          </div>

          <button
            type="button"
            className="tp-nutrition-mobile-menu"
            onClick={() => setSideMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon name="menu" size={18} />
          </button>
        </header>

        <main className="tp-nutrition-main">
          <section className="tp-nutrition-heading">
            <div>
              <span className="tp-nutrition-kicker">
                BİTKİ BESLEME REHBERİ
                <b>YENİ</b>
              </span>
              <h1>Bitki Besin Maddeleri Rehberi</h1>
              <p>
                Bitkilerin sağlıklı gelişimi için gerekli besin
                elementlerini, eksiklik belirtilerini ve temel gübre
                kaynaklarını tek ekranda inceleyin.
              </p>
            </div>

            <div className="tp-nutrition-quick-cards">
              <button
                type="button"
                onClick={() =>
                  guideRef.current?.scrollIntoView({
                    behavior: 'smooth',
                  })
                }
              >
                <span><Icon name="crop" size={18} /></span>
                <div>
                  <strong>Ürününe Özel Besin Yönetimi</strong>
                  <small>
                    Kayıtlı tarlalara göre kişiselleştirilmiş akış
                  </small>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  deficiencyRef.current?.scrollIntoView({
                    behavior: 'smooth',
                  })
                }
              >
                <span><Icon name="leaf" size={18} /></span>
                <div>
                  <strong>Eksiklik Belirtileri ve Etkileri</strong>
                  <small>
                    Besin eksikliğinde ne olur, nasıl görünür?
                  </small>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  sourcesRef.current?.scrollIntoView({
                    behavior: 'smooth',
                  })
                }
              >
                <span><Icon name="bag" size={18} /></span>
                <div>
                  <strong>Temel Gübreler ve Kaynaklar</strong>
                  <small>
                    Hangi gübrelerde bulunur, nelere dikkat edilir?
                  </small>
                </div>
              </button>
            </div>
          </section>

          <div className="tp-nutrition-data-note">
            <Icon name="info" size={14} />
            <span>
              Tarla bazlı risk rozetleri V1'de görsel/öğretici ön
              gösterimdir. Kesin besin durumu için toprak ve gerekirse
              yaprak analizi sonucu esas alınmalıdır.
            </span>
          </div>

          <section className="tp-nutrition-field-section">
            <div className="tp-nutrition-section-head">
              <div>
                <span>
                  TARLANA ÖZEL BESİN DURUMU
                  <Icon name="info" size={12} />
                </span>
                <h2>Kayıtlı alanlardan hızlı özet</h2>
              </div>

              <button
                type="button"
                onClick={() => navigate('home')}
              >
                Tüm Tarlalarım
                <Icon name="arrowRight" size={13} />
              </button>
            </div>

            <div className="tp-nutrition-field-list">
              {visibleFieldCards.length ? (
                visibleFieldCards.map(
                  ({ field, status, riskCount }) => (
                    <article key={String(field.id)}>
                      <div className="tp-nutrition-field-icon">
                        <Icon name="crop" size={20} />
                      </div>

                      <div>
                        <span>{field.crop || 'Ürün belirtilmemiş'}</span>
                        <strong>{field.name}</strong>
                        <small>
                          {Number(field.area ?? 0).toLocaleString(
                            'tr-TR',
                            { maximumFractionDigits: 1 },
                          )}{' '}
                          da
                        </small>
                      </div>

                      <div className="tp-nutrition-field-status">
                        <b className={status}>
                          {riskLabel(status)}
                        </b>
                        <small>
                          {riskCount
                            ? `${riskCount} besin maddesinde ön risk`
                            : 'Ön gösterimde belirgin risk yok'}
                        </small>
                      </div>
                    </article>
                  ),
                )
              ) : (
                <article className="empty">
                  <Icon name="info" size={18} />
                  <div>
                    <strong>Henüz gerçek tarla kaydı yok</strong>
                    <small>
                      Tarla eklediğinde ürün ve alan bilgileri burada
                      görünecek.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section
            className="tp-nutrition-guide-grid"
            ref={guideRef}
          >
            <aside className="tp-nutrition-selector-card">
              <div className="tp-nutrition-selector-head">
                <span>BESİN ELEMENTLERİ</span>
                <h2>Temel Besin Maddeleri</h2>
              </div>

              <div className="tp-nutrition-crop-tabs">
                {CROP_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    className={
                      cropFilter === filter.id ? 'active' : ''
                    }
                    onClick={() => setCropFilter(filter.id)}
                  >
                    <Icon
                      name={
                        filter.id === 'almond'
                          ? 'leaf'
                          : 'crop'
                      }
                      size={13}
                    />
                    {filter.label}
                  </button>
                ))}
              </div>

              <label className="tp-nutrition-search">
                <Icon name="search" size={15} />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Besin maddesi ara..."
                />
              </label>

              <div className="tp-nutrition-nutrient-list">
                {mainNutrients.map((nutrient) => (
                  <button
                    type="button"
                    key={nutrient.id}
                    className={
                      selectedNutrient.id === nutrient.id
                        ? 'selected'
                        : ''
                    }
                    onClick={() =>
                      selectNutrient(nutrient.id)
                    }
                  >
                    <span className="symbol">
                      {nutrient.symbol}
                    </span>
                    <span className="copy">
                      <strong>{nutrient.name}</strong>
                      <small>{nutrient.description}</small>
                    </span>
                    <b className={nutrient.riskStatus}>
                      {riskLabel(nutrient.riskStatus)}
                    </b>
                  </button>
                ))}
              </div>

              <div className="tp-nutrition-soil-cta">
                <span><Icon name="flask" size={18} /></span>
                <div>
                  <strong>
                    Toprak analiziyle besin durumunu netleştir
                  </strong>
                  <small>
                    Görsel belirti tek başına kesin teşhis değildir.
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('soilAnalysisHub')}
                >
                  Toprak Analizi Kaydet
                </button>
              </div>
            </aside>

            <article className="tp-nutrition-detail-card">
              <div className="tp-nutrition-detail-top">
                <div>
                  <span>SEÇİLİ BESİN ELEMENTİ</span>
                  <h2>
                    {selectedNutrient.name}{' '}
                    <b>({selectedNutrient.symbol})</b>
                  </h2>
                </div>

                <b
                  className={`tp-nutrition-risk-pill ${selectedNutrient.riskStatus}`}
                >
                  {riskLabel(selectedNutrient.riskStatus)}
                </b>
              </div>

              <div className="tp-nutrition-detail-tabs">
                {(
                  [
                    ['general', 'Genel Bilgi'],
                    ['deficiency', 'Eksiklik Belirtileri'],
                    ['excess', 'Fazlalık Belirtileri'],
                    ['sources', 'Kaynaklar'],
                    ['recommendations', 'Öneriler'],
                  ] as Array<[DetailTab, string]>
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={
                      detailTab === id ? 'active' : ''
                    }
                    onClick={() => setDetailTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="tp-nutrition-hero-row">
                <div className="tp-nutrition-hero-image">
                  <img
                    src={selectedNutrient.heroImage}
                    alt=""
                  />
                  <small>Temsili görsel</small>
                </div>

                <div className="tp-nutrition-definition">
                  <span>GENEL BİLGİ</span>
                  <h3>
                    {selectedNutrient.name} (
                    {selectedNutrient.symbol}) Nedir?
                  </h3>
                  <p>{selectedNutrient.description}</p>

                  <div className="tp-nutrition-gauge-row">
                    <div
                      className={`tp-nutrition-gauge ${selectedNutrient.riskStatus}`}
                      style={
                        {
                          '--gauge-value': `${riskScore(
                            selectedNutrient.riskStatus,
                          ) * 3.6}deg`,
                        } as CSSProperties
                      }
                    >
                      <div>
                        <strong>
                          {riskScore(
                            selectedNutrient.riskStatus,
                          )}
                        </strong>
                        <small>/100</small>
                      </div>
                    </div>

                    <div>
                      <small>SEÇİLİ TARLA İÇİN ÖN GÖSTERİM</small>
                      <strong>
                        {selectedField?.name ??
                          'Kayıtlı tarla seçilmedi'}
                      </strong>
                      <span>
                        {selectedField?.crop ||
                          'Ürün seçimi yapılmadı'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {(detailTab === 'general' ||
                detailTab === 'deficiency') && (
                <section
                  className="tp-nutrition-symptoms"
                  ref={deficiencyRef}
                >
                  <div className="tp-nutrition-subhead">
                    <div>
                      <span>EKSİKLİK BELİRTİLERİ</span>
                      <h3>Görsel ipuçları</h3>
                    </div>
                    <small>
                      Fotoğraflar temsili; kesin teşhis değildir.
                    </small>
                  </div>

                  <div className="tp-nutrition-symptom-grid">
                    {selectedNutrient.symptoms.map(
                      (symptom, index) => (
                        <article
                          key={`${selectedNutrient.id}-${index}`}
                        >
                          <img
                            src={symptom.imageUrl}
                            alt=""
                          />
                          <span>{index + 1}</span>
                          <strong>{symptom.title}</strong>
                        </article>
                      ),
                    )}
                  </div>

                  <div className="tp-nutrition-consequence-box">
                    <Icon name="warning" size={17} />
                    <div>
                      <strong>Eksiklikte ne olur?</strong>
                      <p>{selectedNutrient.consequences}</p>
                    </div>
                  </div>
                </section>
              )}

              {detailTab === 'excess' && (
                <section className="tp-nutrition-text-panel">
                  <span>FAZLALIK BELİRTİLERİ</span>
                  <h3>
                    {selectedNutrient.name} fazlalığında ne
                    görülebilir?
                  </h3>
                  <p>{selectedNutrient.excessSymptoms}</p>

                  <div className="tp-nutrition-warning-note">
                    <Icon name="info" size={16} />
                    <span>
                      Fazlalık belirtileri başka tuzluluk,
                      pH veya besin antagonizması sorunlarıyla
                      karışabilir.
                    </span>
                  </div>
                </section>
              )}

              {(detailTab === 'general' ||
                detailTab === 'sources') && (
                <section
                  className="tp-nutrition-sources"
                  ref={sourcesRef}
                >
                  <div className="tp-nutrition-subhead">
                    <div>
                      <span>TEMEL GÜBRE KAYNAKLARI</span>
                      <h3>Yaygın kaynak örnekleri</h3>
                    </div>
                  </div>

                  <div className="tp-nutrition-source-grid">
                    {selectedNutrient.fertilizerSources.map(
                      (source) => (
                        <article key={source.name}>
                          {source.imageUrl && (
                            <img
                              src={source.imageUrl}
                              alt=""
                            />
                          )}
                          <div>
                            <strong>{source.name}</strong>
                            <small>{source.percentage}</small>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}

              {(detailTab === 'general' ||
                detailTab === 'recommendations') && (
                <section className="tp-nutrition-recommendations">
                  <div className="tp-nutrition-subhead">
                    <div>
                      <span>ÖNERİLER</span>
                      <h3>Karar verirken dikkat</h3>
                    </div>
                  </div>

                  <div>
                    {selectedNutrient.recommendations.map(
                      (recommendation) => (
                        <article key={recommendation}>
                          <Icon name="check" size={15} />
                          <p>{recommendation}</p>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}

              <div className="tp-nutrition-final-warning">
                <Icon name="info" size={15} />
                <span>
                  Doğru gübre, doğru zaman ve doğru doz kararı;
                  toprak/yaprak analizi, ürün, gelişim dönemi,
                  sulama ve yerel teknik tavsiyelerle birlikte
                  verilmelidir.
                </span>
              </div>
            </article>
          </section>

          <section className="tp-nutrition-bottom-grid">
            <article className="tp-nutrition-micro-card">
              <div className="tp-nutrition-section-head">
                <div>
                  <span>DİĞER TEMEL & MİKRO BESİNLER</span>
                  <h2>Mikro Besin Elementleri</h2>
                </div>
              </div>

              <div className="tp-nutrition-micro-grid">
                {microNutrients.map((nutrient) => (
                  <button
                    type="button"
                    key={nutrient.id}
                    onClick={() =>
                      selectNutrient(nutrient.id)
                    }
                  >
                    <span>{nutrient.symbol}</span>
                    <div>
                      <strong>{nutrient.name}</strong>
                      <small>{nutrient.description}</small>
                    </div>
                    <b className={nutrient.riskStatus}>
                      {riskLabel(nutrient.riskStatus)}
                    </b>
                  </button>
                ))}
              </div>
            </article>

            <article className="tp-nutrition-diagnosis-card">
              <div className="tp-nutrition-section-head">
                <div>
                  <span>HIZLI TEŞHİS REHBERİ</span>
                  <h2>Semptom → olası besin</h2>
                </div>
              </div>

              <div className="tp-nutrition-diagnosis-list">
                {QUICK_GUIDE.map((item) => (
                  <div key={item.symptom}>
                    <span>{item.symptom}</span>
                    <Icon name="arrowRight" size={13} />
                    <strong>{item.nutrient}</strong>
                  </div>
                ))}
              </div>

              <div className="tp-nutrition-diagnosis-note">
                <Icon name="microscope" size={16} />
                <span>
                  Benzer semptomlar birden fazla besin, hastalık,
                  kök, pH veya su stresinden kaynaklanabilir.
                </span>
              </div>
            </article>

            <aside className="tp-nutrition-bottom-cta">
              <span><Icon name="flask" size={22} /></span>
              <small>TOPRAK + BİTKİ BESLEME</small>
              <h2>Analiz Yap, Doğru Gübrele</h2>
              <p>
                Eksikliği tahmin etmek yerine, analiz sonucunu
                kullanarak daha güvenli bir besleme planı oluştur.
              </p>
              <button
                type="button"
                onClick={() => navigate('soilAnalysisHub')}
              >
                Toprak Analizi Kaydet
              </button>
            </aside>
          </section>
        </main>
      </div>

      <nav className="tp-nutrition-bottom-nav">
        <button
          type="button"
          onClick={() => navigate('home')}
        >
          <Icon name="home" size={18} />
          <span>Ana Sayfa</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('home')}
        >
          <Icon name="field" size={18} />
          <span>Tarlalarım</span>
        </button>

        <button
          type="button"
          className="tp-nutrition-bottom-ai"
          onClick={() => navigate('aiAnalysis')}
        >
          <b><Icon name="ai" size={19} /></b>
          <span>AI Analiz</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('calendar')}
        >
          <Icon name="calendar" size={18} />
          <span>Takvim</span>
        </button>

        <button
          type="button"
          onClick={() => setSideMenuOpen(true)}
        >
          <Icon name="more" size={18} />
          <span>Daha Fazla</span>
        </button>
      </nav>

      {sideMenuOpen && (
        <div className="tp-nutrition-drawer-layer">
          <button
            type="button"
            className="tp-nutrition-drawer-backdrop"
            onClick={() => setSideMenuOpen(false)}
            aria-label="Menüyü kapat"
          />

          <aside className="tp-nutrition-drawer">
            <div className="tp-nutrition-drawer-head">
              <div>
                <Icon name="brand" size={19} />
                <strong>TarlaPusula</strong>
              </div>

              <button
                type="button"
                onClick={() => setSideMenuOpen(false)}
                aria-label="Menüyü kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <nav>
              {sidebarItems.map((item, index) => (
                <button
                  type="button"
                  className={
                    item.screen === screen ? 'active' : ''
                  }
                  key={`drawer-${item.screen}-${index}`}
                  onClick={() =>
                    navigate(item.screen as Screen)
                  }
                >
                  <span>
                    <Icon name={menuIcon(item)} size={16} />
                  </span>
                  <strong>{item.label}</strong>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
