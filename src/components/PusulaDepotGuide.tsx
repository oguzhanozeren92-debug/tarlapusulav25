import { useEffect, useMemo, useState } from 'react';
import './PusulaDepotGuide.css';

const PUSULA_BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const PUSULA_NEEDLE_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp';

type StepId =
  | 'welcome'
  | 'hasProducts'
  | 'knowPurpose'
  | 'addMethod'
  | 'scanHelp'
  | 'noProducts'
  | 'done';

type PusulaDepotGuideProps = {
  inventoryCount: number;
  activeCropName?: string | null;
  onAddManual?: () => void;
  onScanLabel?: () => void;
  onReviewForField?: () => void;
};

export default function PusulaDepotGuide({
  inventoryCount,
  activeCropName,
  onAddManual,
  onScanLabel,
  onReviewForField,
}: PusulaDepotGuideProps) {
  const isEmpty = inventoryCount <= 0;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepId>('welcome');

  useEffect(() => {
    if (!isEmpty) {
      setOpen(false);
      return;
    }

    const key = 'tp_pusula_depot_intro_seen_v1';
    const seen = window.sessionStorage.getItem(key) === '1';
    if (seen) return;

    const timer = window.setTimeout(() => {
      setStep('welcome');
      setOpen(true);
      window.sessionStorage.setItem(key, '1');
    }, 650);

    return () => window.clearTimeout(timer);
  }, [isEmpty]);

  const filledMessage = useMemo(() => {
    const crop = String(activeCropName ?? '').trim();

    if (crop) {
      return `Deponda ${inventoryCount} ürün var. İstersen bunları ${crop} tarlan için birlikte değerlendirebiliriz.`;
    }

    return `Deponda ${inventoryCount} ürün var. İstersen ürünlerini tarlaların ve kullanım amaçlarıyla birlikte değerlendirebiliriz.`;
  }, [activeCropName, inventoryCount]);

  const openGuide = () => {
    setStep('welcome');
    setOpen(true);
  };

  const renderEmptyStep = () => {
    if (step === 'welcome') {
      return (
        <>
          <p className="tp-pdg-message">
            Depon henüz boş görünüyor. İstersen birlikte birkaç adımda düzenleyelim.
          </p>
          <div className="tp-pdg-actions">
            <button className="primary" type="button" onClick={() => setStep('hasProducts')}>
              Başlayalım
            </button>
            <button className="secondary" type="button" onClick={() => setOpen(false)}>
              Şimdilik geç
            </button>
          </div>
        </>
      );
    }

    if (step === 'hasProducts') {
      return (
        <>
          <p className="tp-pdg-message">Deponda şu anda ilaç veya gübre var mı?</p>
          <div className="tp-pdg-actions">
            <button className="primary" type="button" onClick={() => setStep('knowPurpose')}>
              Evet
            </button>
            <button className="secondary" type="button" onClick={() => setStep('noProducts')}>
              Hayır
            </button>
          </div>
        </>
      );
    }

    if (step === 'knowPurpose') {
      return (
        <>
          <p className="tp-pdg-message">Elindeki ürünün ne işe yaradığını biliyor musun?</p>
          <div className="tp-pdg-actions">
            <button className="primary" type="button" onClick={() => setStep('addMethod')}>
              Evet, biliyorum
            </button>
            <button className="secondary" type="button" onClick={() => setStep('scanHelp')}>
              Tam emin değilim
            </button>
          </div>
        </>
      );
    }

    if (step === 'addMethod') {
      return (
        <>
          <p className="tp-pdg-message">Harika. Ürünü nasıl eklemek istersin?</p>
          <div className="tp-pdg-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                setOpen(false);
                onScanLabel?.();
              }}
            >
              Etiketi tara
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setOpen(false);
                onAddManual?.();
              }}
            >
              Elle ekle
            </button>
          </div>
        </>
      );
    }

    if (step === 'scanHelp') {
      return (
        <>
          <p className="tp-pdg-message">
            Sorun değil. Etiketin fotoğrafını göster; ürün adı, türü, etken madde ve etikette açıkça yazan temel bilgileri birlikte okuyalım.
          </p>
          <div className="tp-pdg-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                setOpen(false);
                onScanLabel?.();
              }}
            >
              Etiketi tara
            </button>
            <button className="secondary" type="button" onClick={() => setStep('knowPurpose')}>
              Geri
            </button>
          </div>
        </>
      );
    }

    if (step === 'noProducts') {
      return (
        <>
          <p className="tp-pdg-message">
            Tamam. İlk ürününü aldığında buraya ekleyebilirsin. Böylece stok durumunu ve hangi tarlayla ilişkili olduğunu birlikte takip ederiz.
          </p>
          <div className="tp-pdg-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                setOpen(false);
                onScanLabel?.();
              }}
            >
              Nasıl eklendiğini göster
            </button>
            <button className="secondary" type="button" onClick={() => setStep('done')}>
              Sonra yaparım
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <p className="tp-pdg-message">
          Tamam. Hazır olduğunda Pusula'ya dokun; depo kurulumuna kaldığımız yerden başlayabiliriz.
        </p>
        <div className="tp-pdg-actions">
          <button className="primary" type="button" onClick={() => setOpen(false)}>
            Tamam
          </button>
        </div>
      </>
    );
  };

  return (
    <section className={`tp-pdg ${open ? 'is-open' : ''} ${isEmpty ? 'is-empty' : 'has-products'}`}>
      <div className="tp-pdg-orbit" aria-hidden="true" />

      <button
        type="button"
        className="tp-pdg-compass"
        onClick={() => (open ? setOpen(false) : isEmpty ? openGuide() : setOpen(true))}
        aria-label="Pusula depo yardımcısını aç"
      >
        <span className="tp-pdg-compass-glow" />
        <img
          className="tp-pdg-body"
          src={PUSULA_BODY_SRC}
          crossOrigin="anonymous"
          alt="Pusula"
          draggable={false}
        />
        <img
          className="tp-pdg-needle"
          src={PUSULA_NEEDLE_SRC}
          crossOrigin="anonymous"
          alt=""
          draggable={false}
        />
      </button>

      <div className="tp-pdg-caption">
        <strong>{isEmpty ? 'Pusula · Depo Rehberi' : 'Pusula · Depo Danışmanı'}</strong>
        <span>
          {isEmpty
            ? 'Deponu birlikte kuralım'
            : `${inventoryCount} kayıtlı ürün · tarlan için değerlendirebilirim`}
        </span>
      </div>

      <div className={`tp-pdg-dialog ${open ? 'show' : ''}`}>
        <button
          type="button"
          className="tp-pdg-close"
          onClick={() => setOpen(false)}
          aria-label="Pusula konuşmasını kapat"
        >
          ×
        </button>

        <div className="tp-pdg-dialog-kicker">
          {isEmpty ? 'DEPONU BİRLİKTE KURALIM' : 'DEPON İÇİN PUSULA'}
        </div>

        {isEmpty ? (
          renderEmptyStep()
        ) : (
          <>
            <p className="tp-pdg-message">{filledMessage}</p>
            <div className="tp-pdg-actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReviewForField?.();
                }}
              >
                Tarlam için değerlendir
              </button>
              <button className="secondary" type="button" onClick={() => setOpen(false)}>
                Şimdilik kapat
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
