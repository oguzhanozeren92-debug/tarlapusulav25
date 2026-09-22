import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Leaf } from 'lucide-react';
import './PinnedCropSuitabilityNotification.css';

const NOTIFICATION_LIST_SELECTOR =
  'dialog.tp-home-quick-sheet[open][aria-label="Bildirimler"] .tp-home-quick-list';

function findNotificationList() {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(NOTIFICATION_LIST_SELECTOR);
}

export default function PinnedCropSuitabilityNotification() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let frame = 0;

    const scan = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = findNotificationList();
        setPortalTarget((current) => (current === next ? current : next));
      });
    };

    scan();

    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'aria-label'],
    });

    window.addEventListener('tp:notifications-updated', scan);

    return () => {
      observer.disconnect();
      window.removeEventListener('tp:notifications-updated', scan);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!portalTarget) return null;

  const openDetail = () => {
    const dialog = portalTarget.closest('dialog');
    if (!dialog) return;

    const notificationCenterButton = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('.tp-home-quick-link'),
    ).find((button) =>
      String(button.textContent ?? '')
        .toLocaleLowerCase('tr-TR')
        .includes('bildirim merkezine git'),
    );

    notificationCenterButton?.click();
  };

  return createPortal(
    <button
      type="button"
      className="tp-pinned-crop-suitability"
      onClick={openDetail}
      aria-label="Ürün uygunluğu analizini aç"
    >
      <span className="tp-pinned-crop-suitability-dot" aria-hidden="true" />

      <span className="tp-pinned-crop-suitability-icon" aria-hidden="true">
        <Leaf size={17} strokeWidth={2} />
      </span>

      <span className="tp-pinned-crop-suitability-copy">
        <span className="tp-pinned-crop-suitability-title-row">
          <strong>Ürün Uygunluğu</strong>
          <em>SABİT</em>
        </span>
        <small>Uygunluk skoru, karşılaştırma, kaynaklar ve çeşitler</small>
      </span>

      <ChevronRight
        className="tp-pinned-crop-suitability-chevron"
        size={17}
        aria-hidden="true"
      />
    </button>,
    portalTarget,
  );
}
