import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { Field, Screen } from '../types';
import {
  analyzePesticideLabel,
  createInventoryProduct,
  fetchInventoryProducts,
  loadInventoryCache,
  removeInventoryProduct,
  resolveInventoryUser,
  saveInventoryCache,
  updateInventoryProduct,
  uploadPesticideLabelPhoto,
  type InventoryCategory,
  type InventoryProduct,
  type InventoryProductInput,
  type InventoryUnit,
  type PesticideLabelAnalysis,
} from '../services/pestStoreService';
import './PestStoreScreen.css';
import ClassicBottomNav from './ClassicBottomNav';
import {
  addPoints,
  useGamificationStore,
} from '../gamification/useGamificationStore';

const DEPOT_ICON_BASE =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/depot-icons';

const depotIcon = (name: string) => `${DEPOT_ICON_BASE}/${name}`;

type MenuItem = {
  screen: Screen | string;
  label: string;
  badge?: string;
  icon?: string;
};

export interface PestStoreScreenProps {
  fields: Field[];
  onNavigateToField?: (fieldId: string) => void;
  user?: User | null;

  // Global TarlaPusula navigasyonu. App.tsx'teki mevcut yapı kullanılır.
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type IconName =
  | 'brand'
  | 'back'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'box'
  | 'camera'
  | 'scan'
  | 'search'
  | 'filter'
  | 'flask'
  | 'leaf'
  | 'check'
  | 'warning'
  | 'edit'
  | 'trash'
  | 'close'
  | 'menu'
  | 'plus'
  | 'chevron'
  | 'package'
  | 'user';

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
          <path d="M12 21c4.4-3 7-6.6 7-11.1C19 6 16 3 12 3S5 6 5 9.9C5 14.4 7.6 18 12 21Z" />
          <path d="M12 17V8" />
          <path d="M12 12c-2.5-.2-4.1-1.3-5-3M12 10c2.3-.1 4-1 5-2.6" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
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
          <path d="m5 13 .8 2.6 2.7.9-2.7.8L5 20l-.8-2.7-2.7-.8 2.7-.9L5 13Z" />
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
    case 'box':
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 20c.8-4 3.1-6 6.5-6s5.7 2 6.5 6" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'scan':
      return (
        <svg {...common}>
          <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
          <path d="M7 12h10M9 9h6M9 15h6" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...common}>
          <path d="M4 5h16M7 12h10M10 19h4" />
        </svg>
      );
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" />
          <path d="M7.5 15h9" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M20 4c-8 0-14 4-14 10 0 3 2 5 5 5 6 0 9-7 9-15Z" />
          <path d="M5 20c2-5 6-8 11-11" />
        </svg>
      );
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
    case 'edit':
      return (
        <svg {...common}>
          <path d="M4 20h4l11-11-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
  }
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(value);
}

function stockPercent(product: InventoryProduct) {
  if (!Number.isFinite(product.totalAmount) || product.totalAmount <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, (product.remainingAmount / product.totalAmount) * 100),
  );
}

function stockTone(percent: number) {
  if (percent <= 10) return 'critical';
  if (percent <= 25) return 'low';
  return 'normal';
}

function confidenceLabel(value: PesticideLabelAnalysis['confidence']) {
  if (value === 'high') return 'Yüksek okuma güveni';
  if (value === 'medium') return 'Orta okuma güveni';
  return 'Düşük okuma güveni';
}

export default function PestStoreScreen({
  fields,
  onNavigateToField,
  user,
  setScreen,
  setSideMenuOpen = () => undefined,
}: PestStoreScreenProps) {
  const realFields = useMemo(
    () => fields.filter((field) => !field.demo),
    [fields],
  );

  const gamification = useGamificationStore();

  const [resolvedUser, setResolvedUser] = useState<User | null>(user ?? null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [inventoryMessage, setInventoryMessage] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<
    'all' | 'ilac' | 'gubre' | 'low'
  >('all');

  const [stockSort, setStockSort] = useState<'name' | 'stock'>('name');

  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [labelPreview, setLabelPreview] = useState('');
  const [analysis, setAnalysis] =
    useState<PesticideLabelAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');

  const [resultCategory, setResultCategory] =
    useState<InventoryCategory>('ilac');
  const [totalAmount, setTotalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('kg');
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  const [editingProduct, setEditingProduct] =
    useState<InventoryProduct | null>(null);
  const [editDraft, setEditDraft] =
    useState<InventoryProductInput | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const resultRef = useRef<HTMLDivElement | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      try {
        const currentUser = await resolveInventoryUser(user);
        if (!active) return;
        setResolvedUser(currentUser);
      } catch (error) {
        if (!active) return;
        setInventoryMessage(
          error instanceof Error
            ? error.message
            : 'Kullanıcı bilgisi alınamadı.',
        );
        setLoadingProducts(false);
      }
    };

    void resolve();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!resolvedUser) return;

    let active = true;

    const load = async () => {
      const cached = loadInventoryCache(resolvedUser.id);
      if (active && cached.length) setProducts(cached);

      try {
        setLoadingProducts(true);
        const remote = await fetchInventoryProducts(resolvedUser.id);

        if (!active) return;

        setProducts(remote);
        setInventoryMessage('');
      } catch (error) {
        if (!active) return;

        setInventoryMessage(
          `Supabase depo verisi alınamadı. ${
            cached.length
              ? 'Önbellekteki ürünler gösteriliyor.'
              : 'SQL kurulumunu yaptıktan sonra tekrar dene.'
          } ${
            error instanceof Error ? `(${error.message})` : ''
          }`,
        );
      } finally {
        if (active) setLoadingProducts(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [resolvedUser]);

  useEffect(() => {
    return () => {
      if (labelPreview) URL.revokeObjectURL(labelPreview);
    };
  }, [labelPreview]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search.trim());

    return products.filter((product) => {
      const percent = stockPercent(product);

      if (filter === 'ilac' && product.category !== 'ilac') return false;
      if (filter === 'gubre' && product.category !== 'gubre') return false;
      if (filter === 'low' && percent > 25) return false;

      if (!query) return true;

      return normalizeText(
        [
          product.productName,
          product.activeIngredients ?? '',
          product.registrationNumber ?? '',
          product.manufacturer ?? '',
        ].join(' '),
      ).includes(query);
    });
  }, [filter, products, search]);

  // Global üst banttaki TEK Pusula'ya depo durumunu aktar.
  // Burada ikinci bir Pusula logosu render edilmez.
  useEffect(() => {
    const detail = {
      screen: 'inventoryHub',
      loading: loadingProducts,
      productCount: products.length,
      products: products.map((product) => ({
        id: product.id,
        productName: product.productName,
        category: product.category,
        activeIngredients: product.activeIngredients ?? '',
        registrationNumber: product.registrationNumber ?? '',
        remainingAmount: product.remainingAmount,
        totalAmount: product.totalAmount,
        unit: product.unit,
        fieldIds: [...product.fieldIds],
      })),
      fields: realFields.map((field) => ({
        id: String(field.id),
        name: field.name ?? 'Tarla',
        crop: field.crop ?? '',
      })),
    };

    try {
      window.sessionStorage.setItem(
        'tp_pusula_depot_state_v1',
        JSON.stringify(detail),
      );
    } catch {
      // sessionStorage kapalıysa canlı event yine çalışır.
    }

    window.dispatchEvent(
      new CustomEvent('tp-pusula-depot-state', { detail }),
    );
  }, [loadingProducts, products, realFields]);

  // Üst banttaki Pusula'nın aksiyonlarını mevcut depo ekranına bağla.
  useEffect(() => {
    const handleDepotAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        screen?: string;
        action?: 'scan' | 'stock';
      }>;

      if (customEvent.detail?.screen !== 'inventoryHub') return;

      if (customEvent.detail.action === 'scan') {
        const scanCard = document.querySelector(
          '.tp-peststore-scan-card',
        ) as HTMLElement | null;

        scanCard?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        // Kullanıcı Pusula'daki "Etiketi Tara" butonuna bastığı için
        // aynı kullanıcı etkileşimi zincirinde dosya seçiciyi açmayı dene.
        window.setTimeout(() => {
          scanInputRef.current?.click();
        }, 360);

        return;
      }

      if (customEvent.detail.action === 'stock') {
        const stockPanel = document.querySelector(
          '.tp-peststore-stock-panel',
        ) as HTMLElement | null;

        stockPanel?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    };

    window.addEventListener(
      'tp-pusula-depot-action',
      handleDepotAction as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp-pusula-depot-action',
        handleDepotAction as EventListener,
      );
    };
  }, []);

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (labelPreview) {
      URL.revokeObjectURL(labelPreview);
    }

    setLabelFile(file);
    setLabelPreview(file ? URL.createObjectURL(file) : '');
    setAnalysis(null);
    setAnalysisMessage('');
    setTotalAmount('');
    setRemainingAmount('');
    setSelectedFieldIds([]);
  };

  const handleAnalyze = async () => {
    if (!labelFile) return;

    try {
      setAnalysisLoading(true);
      setAnalysisMessage(
        'Etiket okunuyor. Sadece fotoğrafta açıkça görülen bilgiler çıkarılıyor...',
      );

      const result = await analyzePesticideLabel(labelFile);

      setAnalysis(result);
      setResultCategory(
        result.category === 'fertilizer' ? 'gubre' : 'ilac',
      );

      if (result.totalAmountFromLabel != null) {
        const amount = String(result.totalAmountFromLabel);
        setTotalAmount(amount);
        setRemainingAmount(amount);
      }

      if (result.unitFromLabel) {
        setUnit(result.unitFromLabel);
      }

      const dosageCrops = (
        result.resolvedUsage?.crops?.length
          ? result.resolvedUsage.crops
          : result.dosageTable.map((row) => row.crop)
      ).map((crop) => normalizeText(crop));

      const matchingFieldIds = realFields
        .filter((field) => {
          const crop = normalizeText(field.crop ?? '');
          return crop && dosageCrops.some((item) => item.includes(crop) || crop.includes(item));
        })
        .map((field) => String(field.id));

      setSelectedFieldIds(matchingFieldIds);
      if (result.source === 'cache') {
        setAnalysisMessage(
          'AI servisi yanıt vermedi. Aynı etiket fotoğrafının daha önce başarıyla okunmuş yerel kaydı gösteriliyor.',
        );
      } else if (result.source === 'verified-local') {
        setAnalysisMessage(
          'AI servisi yanıt vermedi. Fotoğrafın SHA-256 değeriyle birebir eşleşen doğrulanmış yerel kayıt gösteriliyor.',
        );
      } else if (result.resolvedUsage?.source === 'official-bku') {
        setAnalysisMessage(
          'Ürün ve kullanım satırları resmî BKÜ kaynağında doğrulandı.',
        );
      } else if (result.resolvedUsage?.source === 'label-ocr') {
        setAnalysisMessage(
          'BKÜ kullanım satırı boş döndü; bitki, hedef ve varsa doz bilgileri fotoğraftaki etiketten kullanılıyor.',
        );
      } else if (result.resolvedUsage?.source === 'verified-cache') {
        setAnalysisMessage(
          'Canlı BKÜ kullanım satırı boş döndü; aynı ürün için daha önce kaydedilmiş doğrulanmış kullanım verisi gösteriliyor.',
        );
      } else if (result.resolvedUsage?.source === 'ai-knowledge') {
        setAnalysisMessage(
          'BKÜ ve etiket kullanım tablosu boş kaldı. Genel AI bilgi notu gösteriliyor; bu alanlar resmî tavsiye değildir ve AI doz üretmez.',
        );
      } else {
        setAnalysisMessage(
          'Ürün kimliği bulundu ancak bitki/doz kullanım kaynağı bulunamadı.',
        );
      }

      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : 'Etiket AI ile analiz edilemedi.',
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedFieldIds((current) =>
      current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId],
    );
  };

  const upsertProductState = (
    product: InventoryProduct,
    cacheUserId: string | null = resolvedUser?.id ?? null,
  ) => {
    setProducts((current) => {
      const next = [
        product,
        ...current.filter((item) => item.id !== product.id),
      ];

      if (cacheUserId) {
        saveInventoryCache(cacheUserId, next);
      }

      return next;
    });
  };

  const handleSaveAnalyzed = async () => {
    if (!analysis) {
      setAnalysisMessage('Önce etiketi analiz et.');
      return;
    }

    // Türkiye'de kullanıcılar ondalık değerleri genellikle 0,5 / 1,25
    // şeklinde giriyor. Number('0,5') NaN döndürdüğü için virgülü normalize et.
    const parseAmount = (value: string) => {
      const clean = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');

      return Number(clean);
    };

    const total = parseAmount(totalAmount);
    const remaining = parseAmount(remainingAmount);

    if (!Number.isFinite(total) || total <= 0) {
      setAnalysisMessage('Toplam ambalaj miktarını doğru gir.');
      return;
    }

    if (!Number.isFinite(remaining) || remaining < 0) {
      setAnalysisMessage(
        'Kalan stok miktarını doğru gir. Örn: 0,5 veya 0.5',
      );
      return;
    }

    if (remaining > total) {
      setAnalysisMessage(
        'Kalan stok toplam ambalaj miktarından büyük olamaz.',
      );
      return;
    }

    let currentUser = resolvedUser;

    // Sayfa ilk açıldığında resolvedUser state'i henüz dolmamış olabilir.
    // Butonu kalıcı kilitlemek yerine kaydetme anında oturumu tekrar çöz.
    if (!currentUser) {
      try {
        currentUser = await resolveInventoryUser(user);
        setResolvedUser(currentUser);
      } catch (userError) {
        setAnalysisMessage(
          userError instanceof Error
            ? userError.message
            : 'Ürünü depoya kaydetmek için giriş yapmalısın.',
        );
        return;
      }
    }

    try {
      setSavingProduct(true);
      setAnalysisMessage('Ürün depoya kaydediliyor...');

      let photoPath: string | null = null;

      if (labelFile) {
        try {
          photoPath = await uploadPesticideLabelPhoto(
            currentUser.id,
            labelFile,
          );
        } catch (photoError) {
          console.warn(
            'Etiket fotoğrafı Storage’a yüklenemedi:',
            photoError,
          );
        }
      }

      const input: InventoryProductInput = {
        productName: analysis.productName,
        category: resultCategory,
        activeIngredients: analysis.activeIngredients,
        registrationNumber:
          analysis.bkuLookup?.matchedRegistrationNumber ??
          analysis.registrationNumber,
        formulation:
          analysis.bkuLookup?.matchedFormulation ??
          analysis.formulation,
        manufacturer: analysis.manufacturer,
        totalAmount: total,
        remainingAmount: remaining,
        unit,
        fieldIds: selectedFieldIds,
        photoUrl: photoPath,
      };

      try {
        const saved = await createInventoryProduct(
          currentUser.id,
          input,
        );

        upsertProductState(saved, currentUser.id);

        let pointMessage = '';

        try {
          const reward = await addPoints('ADD_INVENTORY', {
            dedupeKey: `inventory:${saved.id}`,
            metadata: {
              source: 'pest_store',
              productId: saved.id,
              productName: saved.productName,
            },
            toastTitle: 'Depoya ürün ekleme ödülü',
          });

          if (reward.awarded && reward.awardedPoints > 0) {
            pointMessage = ` +${reward.awardedPoints} Puan kazandın.`;
          }
        } catch (pointError) {
          console.warn(
            'Depo puanı verilemedi; ürün kaydı korundu:',
            pointError,
          );
        }

        setAnalysisMessage(
          `Ürün Supabase deposuna kaydedildi ve stok listesine eklendi.${pointMessage}`,
        );
      } catch (remoteError) {
        const now = new Date().toISOString();

        const localProduct: InventoryProduct = {
          id:
            typeof crypto !== 'undefined' &&
            'randomUUID' in crypto
              ? `local-${crypto.randomUUID()}`
              : `local-${Date.now()}`,
          userId: currentUser.id,
          ...input,
          createdAt: now,
          updatedAt: now,
        };

        upsertProductState(localProduct, currentUser.id);

        setAnalysisMessage(
          `Supabase kaydı yapılamadı; ürün geçici olarak cihaz önbelleğine kaydedildi. ${
            remoteError instanceof Error
              ? remoteError.message
              : ''
          }`,
        );
      }
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : 'Ürün depoya kaydedilemedi.',
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const openEdit = (product: InventoryProduct) => {
    setEditingProduct(product);
    setEditDraft({
      productName: product.productName,
      category: product.category,
      activeIngredients: product.activeIngredients,
      registrationNumber: product.registrationNumber,
      formulation: product.formulation,
      manufacturer: product.manufacturer,
      totalAmount: product.totalAmount,
      remainingAmount: product.remainingAmount,
      unit: product.unit,
      fieldIds: [...product.fieldIds],
      photoUrl: product.photoUrl,
    });
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditingProduct(null);
    setEditDraft(null);
  };

  const handleEditSave = async () => {
    if (!editingProduct || !editDraft || !resolvedUser) return;

    if (
      editDraft.totalAmount <= 0 ||
      editDraft.remainingAmount < 0 ||
      editDraft.remainingAmount > editDraft.totalAmount
    ) {
      setInventoryMessage(
        'Stok miktarlarını kontrol et. Kalan miktar toplam miktardan büyük olamaz.',
      );
      return;
    }

    try {
      setEditSaving(true);

      if (editingProduct.id.startsWith('local-')) {
        const updated: InventoryProduct = {
          ...editingProduct,
          ...editDraft,
          updatedAt: new Date().toISOString(),
        };
        upsertProductState(updated);
      } else {
        const updated = await updateInventoryProduct(
          resolvedUser.id,
          editingProduct.id,
          editDraft,
        );
        upsertProductState(updated);
      }

      setInventoryMessage('Ürün bilgileri güncellendi.');
      closeEdit();
    } catch (error) {
      setInventoryMessage(
        error instanceof Error
          ? error.message
          : 'Ürün güncellenemedi.',
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (product: InventoryProduct) => {
    if (!resolvedUser) return;

    if (!window.confirm(`${product.productName} depodan silinsin mi?`)) {
      return;
    }

    try {
      if (!product.id.startsWith('local-')) {
        await removeInventoryProduct(resolvedUser.id, product.id);
      }

      setProducts((current) => {
        const next = current.filter((item) => item.id !== product.id);
        saveInventoryCache(resolvedUser.id, next);
        return next;
      });

      setInventoryMessage('Ürün depodan silindi.');
    } catch (error) {
      setInventoryMessage(
        error instanceof Error ? error.message : 'Ürün silinemedi.',
      );
    }
  };


  const totalProducts = products.length;
  const lowStockProducts = products.filter(
    (product) => stockPercent(product) <= 25,
  ).length;

  const linkedFieldIds = new Set(
    products.flatMap((product) =>
      Array.isArray((product as any).fieldIds)
        ? (product as any).fieldIds.map((value: unknown) => String(value))
        : [],
    ),
  );

  const pesticideCount = products.filter(
    (product) => product.category === 'ilac',
  ).length;

  const fertilizerCount = products.filter(
    (product) => product.category === 'gubre',
  ).length;

  const dashboardProducts = [...filteredProducts].sort((a, b) => {
    if (stockSort === 'stock') {
      return stockPercent(a) - stockPercent(b);
    }

    return String(a.productName || '').localeCompare(
      String(b.productName || ''),
      'tr',
    );
  });

  // Depo ekranında Pusula tek bir aktif tarlayı değil kullanıcının TÜM gerçek
  // tarlalarını ve depodaki TÜM ürünleri birlikte değerlendirir.
  const fieldProductCoverage = realFields.map((field) => {
    const fieldId = String(field.id);
    const linkedProducts = products.filter((product) =>
      product.fieldIds?.some((id) => String(id) === fieldId),
    );

    return {
      id: fieldId,
      name: field.name,
      crop: field.crop,
      productCount: linkedProducts.length,
      lowStockCount: linkedProducts.filter(
        (product) => stockPercent(product) <= 25,
      ).length,
    };
  });

  const fieldsWithProducts = fieldProductCoverage.filter(
    (field) => field.productCount > 0,
  );

  const fieldsWithoutProducts = fieldProductCoverage.filter(
    (field) => field.productCount === 0,
  );

  const multiFieldProducts = products.filter(
    (product) => (product.fieldIds?.length ?? 0) > 1,
  ).length;

  const stockHealthText =
    totalProducts === 0
      ? 'Henüz kayıtlı ürün yok'
      : lowStockProducts === 0
        ? 'Stokların dengeli'
        : `${lowStockProducts} ürün azalıyor`;

  const pusulaDashboardText =
    totalProducts === 0
      ? realFields.length > 0
        ? `${realFields.length} tarlanı birlikte değerlendirebilirim. İlk ürünü etiketini taratarak depoya ekle.`
        : 'Depon henüz boş. İlk ürünü etiketini taratarak ekleyebilirsin.'
      : realFields.length === 0
        ? `Deponda ${totalProducts} ürün var. Tarla eklediğinde ürünleri hangi arazilerde geçerli olduklarına göre eşleştirebilirim.`
        : lowStockProducts > 0
          ? `${realFields.length} tarlan ve ${totalProducts} depo ürünün birlikte değerlendirildi. ${lowStockProducts} ürünün stoğu azalıyor; ${multiFieldProducts} ürün birden fazla tarlayla ilişkili.`
          : `${realFields.length} tarlan ve ${totalProducts} depo ürünün birlikte değerlendirildi. ${fieldsWithProducts.length} tarlada ürün eşleşmesi var; stokların şu an dengeli.`;

  const openScanner = () => {
    document
      .querySelector('.tp-peststore-dropzone')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    window.setTimeout(() => {
      const input = document.querySelector(
        '.tp-peststore-dropzone input[type="file"]',
      ) as HTMLInputElement | null;

      input?.click();
    }, 350);
  };

  return (
    <div className="tp-peststore-page">
      {/*
        Sol menü ve üst bant artık uygulama seviyesinde tek kaynaktan gelir:
        AppDrawer + GlobalPusulaBand. Bu ekran kendi menüsünü/header'ını üretmez.
      */}
      <style>{`
        .tp-peststore-page .tp-peststore-content{
          margin-left:0!important;
          min-height:100vh;
          padding-top:66px;
        }
        .tp-peststore-page .tp-peststore-main{
          padding-top:20px;
        }
        @media(max-width:560px){
          .tp-peststore-page .tp-peststore-content{padding-top:64px;}
          .tp-peststore-page .tp-peststore-main{padding-top:10px;}
        }
      `}</style>
      {gamification.lastAward && (
        <div className="tp-peststore-points-toast" role="status">
          <b>+{gamification.lastAward.points} P</b>
          <div>
            <strong>{gamification.lastAward.title}</strong>
            <small>
              Toplam{' '}
              {new Intl.NumberFormat('tr-TR').format(
                gamification.points,
              )}{' '}
              Puan
            </small>
          </div>
        </div>
      )}

      <div className="tp-peststore-content">
        <main className="tp-peststore-main">
          
          <section className="tp-depot-dashboard-head">
            <div className="tp-depot-dashboard-copy">
              <span>DEPO YÖNETİMİ</span>
              <h1>İlaç & Gübre Depom</h1>
              <p>
                Tek deponu tüm tarlalarınla birlikte yönet; ürün, stok ve tarla
                uyumunu tek yerden takip et.
              </p>
            </div>

            <button
              type="button"
              className="tp-depot-report-btn tp-depot-scan-top-btn"
              onClick={openScanner}
            >
              <img
                src={depotIcon('photo-add.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <span>Etiketi Tara</span>
              <Icon name="chevron" size={14} />
            </button>
          </section>

          <section className="tp-depot-stat-grid">
            <button type="button" onClick={() => setFilter('all')}>
              <img
                className="tp-depot-stat-icon"
                src={depotIcon('total-products.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <small>Toplam Ürün</small>
              <strong>{totalProducts}</strong>
              <span>ürün</span>
              <i>Tümünü Gör</i>
            </button>

            <button type="button" onClick={() => setFilter('ilac')}>
              <img
                className="tp-depot-stat-icon"
                src={depotIcon('pesticide.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <small>İlaç</small>
              <strong>{pesticideCount}</strong>
              <span>ürün</span>
              <i>Listeyi Gör</i>
            </button>

            <button type="button" onClick={() => setFilter('low')}>
              <img
                className="tp-depot-stat-icon"
                src={depotIcon('low-stock.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <small>Azalan Stok</small>
              <strong>{lowStockProducts}</strong>
              <span>ürün</span>
              <i>Kontrol Et</i>
            </button>

            <button type="button">
              <img
                className="tp-depot-stat-icon"
                src={depotIcon('linked-fields.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <small>Bağlı Tarlalar</small>
              <strong>{linkedFieldIds.size}</strong>
              <span>tarla</span>
              <i>{realFields.length} tarla kayıtlı</i>
            </button>
          </section>

          <section className="tp-depot-status-card">
            <div className="tp-depot-status-copy">
              <span>DEPO DURUMU</span>
              <strong>
                {totalProducts ? `${totalProducts} ürün kayıtlı` : 'Depo boş'}
              </strong>

              <p>
                {totalProducts
                  ? `${fertilizerCount} gübre · ${pesticideCount} ilaç · ${lowStockProducts} azalan stok`
                  : 'İlk ürününü fotoğrafla veya elle ekleyebilirsin.'}
              </p>

              <div className="tp-depot-status-bar">
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(8, totalProducts ? 100 - lowStockProducts * 18 : 8),
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="tp-depot-status-visual">
              <img
                className="tp-depot-status-image"
                src={depotIcon('warehouse.webp')}
                alt="Depo"
                crossOrigin="anonymous"
              />

              <div className="tp-depot-health-copy">
                <span>STOK SAĞLIĞI</span>
                <b>{stockHealthText}</b>

                <ul>
                  <li>
                    <i className="good" />
                    <span>
                      {Math.max(0, totalProducts - lowStockProducts)} ürün yeterli
                    </span>
                  </li>
                  <li>
                    <i className="warning" />
                    <span>{lowStockProducts} ürün azalıyor</span>
                  </li>
                  <li>
                    <i className="field" />
                    <span>
                      {fieldsWithProducts.length}/{realFields.length} tarlada ürün
                      eşleşmesi
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="tp-depot-tabs">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
            <button type="button" className={filter === 'gubre' ? 'active' : ''} onClick={() => setFilter('gubre')}>Gübre</button>
            <button type="button" className={filter === 'ilac' ? 'active' : ''} onClick={() => setFilter('ilac')}>İlaç</button>
            <button type="button" className={filter === 'low' ? 'active' : ''} onClick={() => setFilter('low')}>Azalan</button>
          </section>

          <section className="tp-depot-toolbar">
            <label>
              <Icon name="search" size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ürün ara..."
              />
            </label>

            <button type="button" onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}>
              <Icon name="filter" size={15} />
              Filtrele
            </button>

            <button
              type="button"
              onClick={() => setStockSort((current) => current === 'name' ? 'stock' : 'name')}
            >
              ↕ Sırala
            </button>
          </section>

          <section className="tp-depot-pusula-note" data-pusula-depot-target>
            <div>
              <span>PUSULA'DAN ÖNERİ</span>
              <strong>{pusulaDashboardText}</strong>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('tp:pusula-depot-open', {
                    detail: {
                      inventoryCount: totalProducts,
                      lowStockCount: lowStockProducts,
                      totalFieldCount: realFields.length,
                      linkedFieldCount: fieldsWithProducts.length,
                      unlinkedFieldCount: fieldsWithoutProducts.length,
                      multiFieldProductCount: multiFieldProducts,
                      fieldCoverage: fieldProductCoverage,
                      mode: 'all-fields-inventory',
                    },
                  }),
                )
              }
            >
              Detaylı Öneriler
            </button>
          </section>

          <section className="tp-depot-action-row">
            <button
              type="button"
              className="primary"
              onClick={openScanner}
            >
              <img
                className="tp-depot-action-icon"
                src={depotIcon('photo-add.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <span>
                <strong>Etiketi Tara</strong>
                <small>Fotoğraf çekerek ürün ekle</small>
              </span>
            </button>

            <button
              type="button"
              onClick={() => document.querySelector('.tp-peststore-analysis')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <img
                className="tp-depot-action-icon"
                src={depotIcon('total-products.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <span>
                <strong>Elle Ürün Ekle</strong>
                <small>Ürün bilgilerini kendin gir</small>
              </span>
            </button>

            <button
              type="button"
              onClick={() => document.querySelector('.tp-peststore-stock-list')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <img
                className="tp-depot-action-icon"
                src={depotIcon('low-stock.webp')}
                alt=""
                crossOrigin="anonymous"
              />
              <span>
                <strong>Stok Güncelle</strong>
                <small>Mevcut ürünü düzenle</small>
              </span>
            </button>
          </section>

          <section className="tp-peststore-top-grid">
            <article className="tp-peststore-card tp-peststore-scan-card">
              <div className="tp-peststore-card-head">
                <span>
                  <Icon name="camera" size={19} />
                </span>
                <div>
                  <small>AI ETİKET OKUMA</small>
                  <h2>Ürün Etiketi Tarama</h2>
                </div>
              </div>

              <label
                className={`tp-peststore-dropzone ${
                  labelFile ? 'has-file' : ''
                }`}
              >
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />

                {labelPreview ? (
                  <img
                    src={labelPreview}
                    alt="Yüklenen ürün etiketi önizlemesi"
                  />
                ) : (
                  <span>
                    <Icon name="scan" size={26} />
                  </span>
                )}

                <strong>
                  {labelFile?.name ??
                    'İlaç veya gübre etiketinin net fotoğrafını yükle'}
                </strong>
                <p>
                  Ürün adı, ruhsat/tescil no, etken madde ve dozaj tablosu
                  mümkün olduğunca net görünmeli.
                </p>
              </label>

              <button
                type="button"
                className="tp-peststore-primary"
                disabled={!labelFile || analysisLoading}
                onClick={() => void handleAnalyze()}
              >
                {analysisLoading ? (
                  <>
                    <span className="tp-peststore-spinner" />
                    BKÜ Etiketi AI ile Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <Icon name="scan" size={16} />
                    BKÜ Verisi İçin Etiketi Tara & Analiz Et
                  </>
                )}
              </button>

              {analysisMessage && (
                <div className="tp-peststore-inline-message">
                  {analysisMessage}
                </div>
              )}
            </article>

            <article className="tp-peststore-card tp-peststore-stock-panel">
              <div className="tp-peststore-card-head">
                <span>
                  <Icon name="box" size={19} />
                </span>
                <div>
                  <small>STOK TAKİBİ</small>
                  <h2>Depom</h2>
                </div>
                <b>{products.length} ürün</b>
              </div>

              <div className="tp-peststore-toolbar">
                <label>
                  <Icon name="search" size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Depoda ürün ara..."
                  />
                </label>

                <label>
                  <Icon name="filter" size={15} />
                  <select
                    value={filter}
                    onChange={(event) =>
                      setFilter(event.target.value as typeof filter)
                    }
                  >
                    <option value="all">Tüm Ürünler</option>
                    <option value="ilac">İlaçlar</option>
                    <option value="gubre">Gübreler</option>
                    <option value="low">Azalanlar</option>
                  </select>
                </label>
              </div>

              {inventoryMessage && (
                <div className="tp-peststore-inline-message">
                  {inventoryMessage}
                </div>
              )}

              {loadingProducts && products.length === 0 ? (
                <div className="tp-peststore-empty">
                  <span className="tp-peststore-spinner light" />
                  <strong>Depo yükleniyor...</strong>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="tp-peststore-empty">
                  <Icon name="box" size={24} />
                  <strong>
                    {products.length
                      ? 'Bu filtrede ürün bulunamadı.'
                      : 'Deponuzda henüz kayıtlı ürün bulunmuyor.'}
                  </strong>
                  <p>
                    Etiket taratarak ilk ilaç veya gübre kaydını
                    oluşturabilirsin.
                  </p>
                </div>
              ) : (
                <div className="tp-peststore-stock-list">
                  {dashboardProducts.map((product) => {
                    const percent = stockPercent(product);
                    const tone = stockTone(percent);

                    return (
                      <article
                        className="tp-peststore-stock-item"
                        key={product.id}
                      >
                        <div className="tp-peststore-stock-title">
                          <div className="tp-peststore-product-main">
                            <div className="tp-peststore-product-visual" aria-hidden="true">
                              <img
                                src={depotIcon(
                                  product.category === 'ilac'
                                    ? 'pesticide.webp'
                                    : 'fertilizer.webp',
                                )}
                                alt=""
                                crossOrigin="anonymous"
                              />
                              <span className={`stock-visual-level ${tone}`}>
                                <i style={{ height: `${percent}%` }} />
                              </span>
                            </div>

                            <div>
                            <span
                              className={`tp-peststore-kind ${product.category}`}
                            >
                              {product.category === 'ilac'
                                ? 'İLAÇ'
                                : 'GÜBRE'}
                            </span>
                            <strong>{product.productName}</strong>
                            <small>
                              {product.activeIngredients ||
                                product.manufacturer ||
                                'Etken madde / üretici bilgisi yok'}
                            </small>
                            </div>
                          </div>

                          <div className="tp-peststore-stock-actions">
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              aria-label="Ürünü düzenle"
                            >
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(product)}
                              aria-label="Ürünü sil"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="tp-peststore-stock-numbers">
                          <strong>
                            {formatAmount(product.remainingAmount)}{' '}
                            {product.unit}
                          </strong>
                          <span>
                            / {formatAmount(product.totalAmount)}{' '}
                            {product.unit}
                          </span>
                          <i className={tone}>
                            {tone === 'critical'
                              ? 'Kritik stok'
                              : tone === 'low'
                                ? 'Azalıyor'
                                : `%${Math.round(percent)}`}
                          </i>
                        </div>

                        <div className="tp-peststore-progress">
                          <span
                            className={tone}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="tp-peststore-registration">
                          {product.category === 'ilac' ? (
                            <>
                              <Icon
                                name={
                                  product.registrationNumber
                                    ? 'check'
                                    : 'warning'
                                }
                                size={13}
                              />
                              <span>
                                {product.registrationNumber
                                  ? `Etiketten ruhsat no: ${product.registrationNumber}`
                                  : 'Ruhsat no etiketten okunamadı'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Icon
                                name={
                                  product.registrationNumber
                                    ? 'check'
                                    : 'warning'
                                }
                                size={13}
                              />
                              <span>
                                {product.registrationNumber
                                  ? `Gübre tescil/beyan no: ${product.registrationNumber}`
                                  : 'Gübre tescil/beyan no okunamadı'}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="tp-peststore-field-relevance">
                          <span>TARLA UYUMU</span>
                          <strong>
                            {product.fieldIds.length > 1
                              ? `${product.fieldIds.length} tarlada geçerli`
                              : product.fieldIds.length === 1
                                ? '1 tarlada geçerli'
                                : 'Henüz tarla ile eşleşmedi'}
                          </strong>
                        </div>

                        {product.fieldIds.length > 0 && (
                          <div className="tp-peststore-field-chips">
                            {product.fieldIds.map((fieldId) => {
                              const field = realFields.find(
                                (item) => String(item.id) === fieldId,
                              );

                              if (!field) return null;

                              return (
                                <button
                                  key={fieldId}
                                  type="button"
                                  onClick={() =>
                                    onNavigateToField?.(fieldId)
                                  }
                                >
                                  {field.name} · {field.crop}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          </section>

          {analysis && (
            <section
              className="tp-peststore-analysis"
              ref={resultRef}
            >
              <div className="tp-peststore-analysis-heading">
                <span>
                  {analysis.source === 'cache'
                    ? 'YEREL YEDEK · AYNI FOTOĞRAFIN ÖNCEKİ AI KAYDI'
                    : analysis.source === 'verified-local'
                      ? 'DOĞRULANMIŞ YEREL KAYIT · BİREBİR FOTOĞRAF EŞLEŞMESİ'
                      : 'AI ETİKET ÇIKTISI · RESMÎ EŞLEŞME BEKLENİYOR'}
                </span>
                <h2>BKÜ Etiket Analizi & Stok Kaydı</h2>
                <p>
                  Bu sonuç canlı Bakanlık sorgusu değildir. Yalnızca
                  yüklediğin etikette okunabilen veriler gösterilir; kullanımda
                  ürünün güncel resmî etiketi ve yetkili kayıtları esas
                  alınmalıdır.
                </p>
              </div>

              <div
                className={`tp-peststore-analysis-source ${
                  analysis.source ?? 'ai'
                }`}
              >
                <Icon
                  name={analysis.source === 'ai' ? 'ai' : 'warning'}
                  size={15}
                />
                <div>
                  <strong>
                    {analysis.source === 'cache'
                      ? 'Yerel önbellek sonucu'
                      : analysis.source === 'verified-local'
                        ? 'Doğrulanmış yerel kayıt'
                        : analysis.bkuLookup?.status === 'exact'
                          ? analysis.bkuLookup?.usageSource === 'official-bku'
                            ? 'Canlı AI + Resmî BKÜ kullanım verisi'
                            : 'Canlı AI + BKÜ ruhsat doğrulaması'
                          : 'Canlı AI etiket okuma'}
                  </strong>
                  <span>
                    {analysis.source === 'cache'
                      ? 'Yalnızca aynı fotoğrafın daha önce başarılı şekilde analiz edilmiş kaydı kullanıldı. Yeni doz veya ruhsat bilgisi üretilmedi.'
                      : analysis.source === 'verified-local'
                        ? 'Kayıt yalnızca fotoğraf hash’i birebir eşleştiği için kullanıldı.'
                        : analysis.bkuLookup?.status === 'exact'
                          ? analysis.bkuLookup?.usageSource === 'official-bku'
                            ? 'Ürün etiketten tanındı; bitki, hedef ve doz bilgileri doğrudan T.C. Tarım ve Orman Bakanlığı BKÜ kullanım detaylarından okundu.'
                            : 'Ürün kimliği resmî BKÜ ruhsat kaydıyla doğrulandı; kullanım/doz satırları doğrudan BKÜ Tavsiye Arama üzerinden bekleniyor.'
                          : 'AI etiketi okudu ancak resmî BKÜ eşleşmesi henüz kesinleşmedi.'}
                  </span>
                </div>
              </div>

              <div
                className={`tp-peststore-smart-summary ${
                  analysis.resolvedUsage?.source ?? 'identity-only'
                }`}
              >
                <div className="tp-peststore-smart-summary-head">
                  <span>
                    <Icon
                      name={
                        analysis.resolvedUsage?.source === 'official-bku'
                          ? 'check'
                          : analysis.resolvedUsage?.source === 'ai-knowledge'
                            ? 'ai'
                            : 'leaf'
                      }
                      size={16}
                    />
                  </span>

                  <div>
                    <small>
                      {analysis.resolvedUsage?.source === 'official-bku'
                        ? 'RESMÎ BKÜ KULLANIM ÖZETİ'
                        : analysis.resolvedUsage?.source === 'label-ocr'
                          ? 'ETİKETTEN OKUNAN KULLANIM ÖZETİ'
                          : analysis.resolvedUsage?.source === 'verified-cache'
                            ? 'DOĞRULANMIŞ YEREL YEDEK KAYIT'
                            : analysis.resolvedUsage?.source === 'ai-knowledge'
                              ? 'AI BİLGİ NOTU · RESMÎ DEĞİL'
                              : 'ÜRÜN KİMLİĞİ ÖZETİ'}
                    </small>

                    <strong>
                      {analysis.resolvedUsage?.summary ||
                        analysis.bkuLookup?.matchedGroup ||
                        analysis.productType ||
                        analysis.purpose ||
                        'Ürün kimliği tespit edildi'}
                    </strong>
                  </div>

                  <b
                    className={`tp-peststore-source-pill ${
                      analysis.resolvedUsage?.source ?? 'identity-only'
                    }`}
                  >
                    {analysis.resolvedUsage?.source === 'official-bku'
                      ? 'BKÜ'
                      : analysis.resolvedUsage?.source === 'label-ocr'
                        ? 'ETİKET'
                        : analysis.resolvedUsage?.source === 'verified-cache'
                          ? 'CACHE'
                          : analysis.resolvedUsage?.source === 'ai-knowledge'
                            ? 'AI'
                            : 'KİMLİK'}
                  </b>
                </div>

                <div className="tp-peststore-smart-summary-grid">
                  <div>
                    <small>Ne işe yarar?</small>
                    <strong>
                      {analysis.resolvedUsage?.summary ||
                        analysis.bkuLookup?.matchedGroup ||
                        analysis.productType ||
                        analysis.purpose ||
                        'Ürün tipi tespit edildi ancak kullanım açıklaması bulunamadı'}
                    </strong>
                  </div>

                  <div>
                    <small>Kullanılabildiği / olası bitkiler</small>
                    <div
                      className={`tp-peststore-ai-chips ${
                        analysis.resolvedUsage?.source === 'ai-knowledge'
                          ? 'unverified'
                          : ''
                      }`}
                    >
                      {analysis.resolvedUsage?.crops?.length ? (
                        analysis.resolvedUsage.crops.map((crop) => (
                          <span key={crop}>{crop}</span>
                        ))
                      ) : (
                        <em>Bitki kullanım verisi bulunamadı</em>
                      )}
                    </div>
                  </div>

                  <div className="wide">
                    <small>Hedef hastalık / zararlı / yabancı ot</small>
                    <div
                      className={`tp-peststore-ai-chips warning ${
                        analysis.resolvedUsage?.source === 'ai-knowledge'
                          ? 'unverified'
                          : ''
                      }`}
                    >
                      {analysis.resolvedUsage?.targets?.length ? (
                        analysis.resolvedUsage.targets.map((target) => (
                          <span key={target}>{target}</span>
                        ))
                      ) : (
                        <em>Hedef kullanım verisi bulunamadı</em>
                      )}
                    </div>
                  </div>
                </div>

                {analysis.resolvedUsage?.note && (
                  <div
                    className={`tp-peststore-resolution-note ${
                      analysis.resolvedUsage.source
                    }`}
                  >
                    <Icon
                      name={
                        analysis.resolvedUsage.source === 'official-bku'
                          ? 'check'
                          : 'warning'
                      }
                      size={13}
                    />
                    <span>{analysis.resolvedUsage.note}</span>
                  </div>
                )}
              </div>

              {analysis.resolvedUsage?.source === 'verified-cache' &&
                analysis.resolvedUsage.rows.length > 0 && (
                  <div className="tp-peststore-fallback-dose-card">
                    <div className="tp-peststore-dose-head">
                      <div>
                        <small>DOĞRULANMIŞ YEDEK KULLANIM KAYDI</small>
                        <h3>
                          {analysis.resolvedUsage.originalSource ===
                          'official-bku'
                            ? 'Önceki resmî BKÜ kaydı'
                            : 'Önceki etiket okuma kaydı'}
                        </h3>
                      </div>
                    </div>

                    <div className="tp-peststore-dose-list">
                      {analysis.resolvedUsage.rows.map((row, index) => (
                        <article
                          className="tp-peststore-dose-row"
                          key={`${row.crop}-${row.target}-${index}`}
                        >
                          <div>
                            <small>Bitki</small>
                            <strong>{row.crop || '—'}</strong>
                          </div>
                          <div>
                            <small>Hedef</small>
                            <strong>{row.target || '—'}</strong>
                          </div>
                          <div className="dose">
                            <small>Kaydedilmiş doz</small>
                            <strong>{row.dose || 'Doz kaydı yok'}</strong>
                          </div>
                          <div>
                            <small>Hasat aralığı</small>
                            <strong>
                              {row.preHarvestIntervalDays != null
                                ? `${row.preHarvestIntervalDays} gün`
                                : '—'}
                            </strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

              {analysis.resolvedUsage?.source === 'ai-knowledge' && (
                <div className="tp-peststore-ai-knowledge-warning">
                  <Icon name="warning" size={15} />
                  <div>
                    <strong>AI bilgi bankası fallback'i kullanılıyor</strong>
                    <span>
                      Bu bitki ve hedef alanları genel tarımsal bilgi
                      niteliğindedir; resmî ruhsat/tavsiye değildir.
                      Güvenlik nedeniyle AI sayısal doz üretmez.
                    </span>
                  </div>
                </div>
              )}

              {analysis.bkuLookup?.status === 'exact' &&
                analysis.bkuLookup.uses.length > 0 && (
                  <div className="tp-peststore-bku-official">
                    <div className="tp-peststore-bku-official-head">
                      <div>
                        <span>
                          <Icon name="check" size={15} />
                        </span>
                        <div>
                          <small>
                            {analysis.bkuLookup?.usageSource === 'official-bku'
                              ? 'CANLI RESMÎ BKÜ KULLANIM VERİSİ'
                              : 'BKÜ RUHSATI + KAYNAKLI ÜRÜN ETİKETİ'}
                          </small>
                          <h3>
                            {analysis.bkuLookup.matchedProductName ||
                              analysis.productName}
                          </h3>
                        </div>
                      </div>
                      <b>
                        {analysis.bkuLookup?.usageSource === 'official-bku'
                          ? 'BKÜ DOĞRULANDI'
                          : 'ÜRÜN DOĞRULANDI'}
                      </b>
                    </div>

                    <div className="tp-peststore-bku-match">
                      <span>
                        Etken madde:{' '}
                        <strong>
                          {analysis.bkuLookup.matchedActiveIngredients ||
                            analysis.activeIngredients ||
                            '—'}
                        </strong>
                      </span>
                      <span>
                        Formülasyon:{' '}
                        <strong>
                          {analysis.bkuLookup.matchedFormulation ||
                            analysis.formulation ||
                            '—'}
                        </strong>
                      </span>
                      {analysis.bkuLookup.matchedRegistrationNumber && (
                        <span>
                          Ruhsat no:{' '}
                          <strong>
                            {analysis.bkuLookup.matchedRegistrationNumber}
                          </strong>
                        </span>
                      )}
                    </div>

                    <div className="tp-peststore-bku-use-list">
                      {analysis.bkuLookup.uses.map((row, index) => (
                        <article
                          key={`${row.crop}-${row.target}-${row.dose}-${index}`}
                        >
                          <div>
                            <small>Bitki</small>
                            <strong>{row.crop}</strong>
                          </div>
                          <div>
                            <small>Hastalık / Zararlı</small>
                            <strong>{row.target}</strong>
                          </div>
                          <div className="dose">
                            <small>
                              {analysis.bkuLookup?.usageSource === 'official-bku'
                                ? 'Resmî BKÜ dozu'
                                : 'Kaynaklı etiket dozu'}
                            </small>
                            <strong>{row.dose}</strong>
                          </div>
                          <div>
                            <small>Hasat aralığı</small>
                            <strong>
                              {row.preHarvestIntervalDays != null
                                ? `${row.preHarvestIntervalDays} gün`
                                : '—'}
                            </strong>
                          </div>
                          <div>
                            <small>Grup</small>
                            <strong>{row.group || analysis.productType || '—'}</strong>
                          </div>
                          {row.sourceUrl && (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {analysis.bkuLookup?.usageSource === 'official-bku'
                                ? 'BKÜ kaynağını aç'
                                : 'Etiket kaynağını aç'}
                            </a>
                          )}
                        </article>
                      ))}
                    </div>

                    <div className="tp-peststore-bku-footer">
                      <span>
                        Son canlı kontrol:{' '}
                        {analysis.bkuLookup.checkedAt
                          ? new Date(
                              analysis.bkuLookup.checkedAt,
                            ).toLocaleString('tr-TR')
                          : '—'}
                      </span>

                      {analysis.bkuLookup.sourceUrls[0] && (
                        <a
                          href={analysis.bkuLookup.sourceUrls[0]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Resmî BKÜ kaynağı
                        </a>
                      )}
                    </div>
                  </div>
                )}

              {analysis.bkuLookup?.status === 'exact' &&
                analysis.bkuLookup.uses.length === 0 && (
                  <div className="tp-peststore-bku-status exact-empty">
                    <Icon name="check" size={15} />
                    <div>
                      <strong>
                        BKÜ ruhsat kaydı doğrulandı
                      </strong>
                      <span>
                        {analysis.bkuLookup.matchedRegistrationNumber
                          ? `Ruhsat no ${analysis.bkuLookup.matchedRegistrationNumber}. `
                          : ''}
                        {analysis.bkuLookup.note ||
                          'Bitki ve doz kullanım kaynağı henüz bulunamadı.'}
                      </span>
                    </div>
                  </div>
                )}

              {analysis.bkuLookup &&
                analysis.bkuLookup.status !== 'exact' && (
                  <div
                    className={`tp-peststore-bku-status ${analysis.bkuLookup.status}`}
                  >
                    <Icon name="warning" size={15} />
                    <div>
                      <strong>
                        {analysis.bkuLookup.status === 'probable'
                          ? 'BKÜ’de aday eşleşme bulundu, kesin doğrulanamadı'
                          : analysis.bkuLookup.status === 'error'
                            ? 'Canlı BKÜ sorgusu tamamlanamadı'
                            : 'BKÜ’de kesin ürün eşleşmesi bulunamadı'}
                      </strong>
                      <span>
                        {analysis.bkuLookup.note ||
                          'Güvenlik nedeniyle başka bir ürünün doz bilgisi bu ürüne aktarılmadı.'}
                      </span>
                    </div>
                  </div>
                )}

              {analysis.bkuLookup?.diagnostics?.length ? (
                <details className="tp-peststore-bku-diagnostics">
                  <summary>BKÜ bağlantı ayrıntıları</summary>
                  <div>
                    {analysis.bkuLookup.diagnostics.map((item, index) => (
                      <span key={`${item}-${index}`}>{item}</span>
                    ))}
                  </div>
                </details>
              ) : null}

              {analysis.dosageTable?.length > 0 && (
                <div className="tp-peststore-dose-panel tp-peststore-label-dose-panel">
                  <div className="tp-peststore-dose-head">
                    <div>
                      <small>ETİKETTEN OKUNAN DOZAJ</small>
                      <h3>Fotoğrafta görünen kullanım satırları</h3>
                    </div>
                    <b>{analysis.dosageTable.length} kullanım satırı</b>
                  </div>

                  <div className="tp-peststore-dose-list">
                    {analysis.dosageTable.map((row, index) => (
                      <article
                        className="tp-peststore-dose-row"
                        key={`${row.crop}-${row.target}-${index}`}
                      >
                        <div>
                          <small>Bitki</small>
                          <strong>{row.crop || '—'}</strong>
                        </div>

                        <div>
                          <small>Hastalık / Zararlı</small>
                          <strong>{row.target || '—'}</strong>
                        </div>

                        <div className="dose">
                          <small>Etiketteki doz</small>
                          <strong>
                            {row.dosageLabel ||
                              row.dosagePer100L ||
                              'Etiketten okunamadı'}
                          </strong>
                        </div>

                        <div>
                          <small>Uygulama zamanı</small>
                          <strong>{row.applicationTiming || '—'}</strong>
                        </div>

                        <div>
                          <small>Hasat aralığı</small>
                          <strong>
                            {row.preHarvestIntervalDays != null
                              ? `${row.preHarvestIntervalDays} gün`
                              : '—'}
                          </strong>
                        </div>
                      </article>
                    ))}
                  </div>

                  <p className="tp-peststore-dose-notice">
                    Doz değerleri yalnızca yüklediğin etikette okunabilen metindir.
                    Uygulama öncesi ürünün güncel resmî etiketi ve ruhsat bilgisi esas alınmalıdır.
                  </p>
                </div>
              )}

              <div className="tp-peststore-analysis-grid">
                <article className="tp-peststore-card">
                  <div className="tp-peststore-result-status">
                    <div>
                      <span>
                        <Icon name="flask" size={18} />
                      </span>
                      <div>
                        <small>ÜRÜN</small>
                        <h3>{analysis.productName}</h3>
                      </div>
                    </div>

                    <b className={`confidence ${analysis.confidence}`}>
                      {confidenceLabel(analysis.confidence)}
                    </b>
                  </div>

                  <div className="tp-peststore-facts">
                    <div>
                      <small>
                        {resultCategory === 'ilac'
                          ? 'Ruhsat durumu'
                          : 'Tescil / beyan durumu'}
                      </small>
                      <strong>
                        {analysis.bkuLookup?.matchedRegistrationNumber
                          ? `${analysis.bkuLookup.matchedRegistrationNumber} · BKÜ'de doğrulandı`
                          : analysis.registrationNumber
                            ? `${analysis.registrationNumber} · Etiketten okundu`
                            : 'Ruhsat numarası bulunamadı'}
                      </strong>
                      <p>
                        {analysis.bkuLookup?.status === 'exact'
                          ? `${analysis.bkuLookup.matchedGroup || 'BKÜ kaydı'} · Resmî ruhsat kaydı eşleşti`
                          : 'Resmî BKÜ eşleşmesi bekleniyor.'}
                      </p>
                    </div>

                    <div>
                      <small>Etken madde / içerik</small>
                      <strong>
                        {analysis.bkuLookup?.matchedActiveIngredients ||
                          analysis.activeIngredients ||
                          'Henüz doğrulanamadı'}
                      </strong>
                    </div>

                    <div>
                      <small>Formülasyon</small>
                      <strong>
                        {analysis.bkuLookup?.matchedFormulation ||
                          analysis.formulation ||
                          'Henüz doğrulanamadı'}
                      </strong>
                    </div>

                    <div>
                      <small>Üretici / firma</small>
                      <strong>
                        {analysis.manufacturer || 'Etiketten okunamadı'}
                      </strong>
                    </div>

                    <div className="wide">
                      <small>Temel kullanım amacı</small>
                      <strong>
                        {analysis.bkuLookup?.matchedGroup ||
                          analysis.purpose ||
                          analysis.productType ||
                          'Henüz doğrulanamadı'}
                      </strong>
                    </div>

                    {analysis.preHarvestIntervalDays != null && (
                      <div>
                        <small>Hasat aralığı</small>
                        <strong>
                          {analysis.preHarvestIntervalDays} gün
                        </strong>
                      </div>
                    )}
                  </div>

                  {analysis.warnings && (
                    <div className="tp-peststore-warning-box">
                      <Icon name="warning" size={17} />
                      <div>
                        <strong>Etiketten okunan uyarılar</strong>
                        <p>{analysis.warnings}</p>
                      </div>
                    </div>
                  )}
                </article>
              </div>

              <article className="tp-peststore-card tp-peststore-stock-entry">
                <div className="tp-peststore-card-head">
                  <span>
                    <Icon name="package" size={19} />
                  </span>
                  <div>
                    <small>DEPOMA KAYDET</small>
                    <h2>Stok Girişi & Tarla İlişkisi</h2>
                  </div>
                </div>

                <div className="tp-peststore-form-grid">
                  <label>
                    <span>Ürün türü</span>
                    <select
                      value={resultCategory}
                      onChange={(event) =>
                        setResultCategory(
                          event.target.value as InventoryCategory,
                        )
                      }
                    >
                      <option value="ilac">İlaç / BKÜ</option>
                      <option value="gubre">Gübre</option>
                    </select>
                  </label>

                  <label>
                    <span>Toplam ambalaj miktarı</span>
                    <input
                      inputMode="decimal"
                      value={totalAmount}
                      onChange={(event) =>
                        setTotalAmount(event.target.value)
                      }
                      placeholder="Örn. 5"
                    />
                  </label>

                  <label>
                    <span>Şu an kalan miktar</span>
                    <input
                      inputMode="decimal"
                      value={remainingAmount}
                      onChange={(event) =>
                        setRemainingAmount(event.target.value)
                      }
                      placeholder="Örn. 3.5"
                    />
                  </label>

                  <label>
                    <span>Birim</span>
                    <select
                      value={unit}
                      onChange={(event) =>
                        setUnit(event.target.value as InventoryUnit)
                      }
                    >
                      <option value="kg">kg</option>
                      <option value="lt">lt</option>
                      <option value="gr">gr</option>
                      <option value="ml">ml</option>
                    </select>
                  </label>
                </div>

                <div className="tp-peststore-fields-select">
                  <span>KULLANILABİLECEĞİ / İLİŞKİLİ TARLALAR</span>

                  {realFields.length === 0 ? (
                    <p>
                      Henüz kayıtlı gerçek tarla yok. Ürünü tarla seçmeden de
                      depoya kaydedebilirsin.
                    </p>
                  ) : (
                    <div>
                      {realFields.map((field) => {
                        const fieldId = String(field.id);
                        const checked =
                          selectedFieldIds.includes(fieldId);

                        return (
                          <label
                            className={checked ? 'selected' : ''}
                            key={fieldId}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleField(fieldId)}
                            />
                            <span>
                              <strong>{field.name}</strong>
                              <small>{field.crop}</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="tp-peststore-save-product"
                  disabled={savingProduct}
                  onClick={() => void handleSaveAnalyzed()}
                >
                  {savingProduct ? (
                    <>
                      <span className="tp-peststore-spinner" />
                      Depoya kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Icon name="plus" size={17} />
                      BU ÜRÜNÜ DEPOMA KAYDET
                    </>
                  )}
                </button>
              </article>
            </section>
          )}
        </main>
      </div>

      <ClassicBottomNav
        activeScreen="inventoryHub"
        setScreen={setScreen}
      />

      {editingProduct && editDraft && (
        <div className="tp-peststore-modal-layer">
          <button
            type="button"
            className="tp-peststore-modal-backdrop"
            onClick={closeEdit}
            aria-label="Düzenleme penceresini kapat"
          />

          <section
            className="tp-peststore-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Depo ürününü düzenle"
          >
            <div className="tp-peststore-modal-head">
              <div>
                <small>STOK DÜZENLE</small>
                <h2>{editingProduct.productName}</h2>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                aria-label="Kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <div className="tp-peststore-edit-grid">
              <label className="wide">
                <span>Ürün adı</span>
                <input
                  value={editDraft.productName}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      productName: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Tür</span>
                <select
                  value={editDraft.category}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      category: event.target.value as InventoryCategory,
                    })
                  }
                >
                  <option value="ilac">İlaç / BKÜ</option>
                  <option value="gubre">Gübre</option>
                </select>
              </label>

              <label>
                <span>Birim</span>
                <select
                  value={editDraft.unit}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      unit: event.target.value as InventoryUnit,
                    })
                  }
                >
                  <option value="kg">kg</option>
                  <option value="lt">lt</option>
                  <option value="gr">gr</option>
                  <option value="ml">ml</option>
                </select>
              </label>

              <label>
                <span>Toplam miktar</span>
                <input
                  inputMode="decimal"
                  value={editDraft.totalAmount}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      totalAmount: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label>
                <span>Kalan miktar</span>
                <input
                  inputMode="decimal"
                  value={editDraft.remainingAmount}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      remainingAmount: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="wide">
                <span>Etken madde / içerik</span>
                <input
                  value={editDraft.activeIngredients ?? ''}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      activeIngredients: event.target.value || null,
                    })
                  }
                />
              </label>

              <label className="wide">
                <span>Ruhsat / tescil / beyan no</span>
                <input
                  value={editDraft.registrationNumber ?? ''}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      registrationNumber: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>

            <div className="tp-peststore-fields-select compact">
              <span>TARLALAR</span>
              <div>
                {realFields.map((field) => {
                  const fieldId = String(field.id);
                  const checked = editDraft.fieldIds.includes(fieldId);

                  return (
                    <label
                      key={`edit-${fieldId}`}
                      className={checked ? 'selected' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setEditDraft({
                            ...editDraft,
                            fieldIds: checked
                              ? editDraft.fieldIds.filter(
                                  (id) => id !== fieldId,
                                )
                              : [...editDraft.fieldIds, fieldId],
                          })
                        }
                      />
                      <span>
                        <strong>{field.name}</strong>
                        <small>{field.crop}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="tp-peststore-modal-actions">
              <button type="button" onClick={closeEdit}>
                Vazgeç
              </button>
              <button
                type="button"
                className="primary"
                disabled={editSaving}
                onClick={() => void handleEditSave()}
              >
                {editSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
