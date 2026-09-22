import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import { getEntitlementSnapshot } from '../../../entitlements/useEntitlementStore';
import { reorderUserFields } from '../services/fieldOrder.service';
import './HomeFieldsSheet.css';

type FieldOption = { id: string | number; name?: string | null; crop?: string | null; demo?: boolean };

type HomeFieldsSheetProps = {
  open: boolean;
  fields: FieldOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDetail: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onAdd: () => void;
  onClose: () => void;
  onReorder?: (orderedIds: string[]) => void;
};

export default function HomeFieldsSheet({
  open,
  fields,
  selectedId,
  onSelect,
  onDetail,
  onDelete,
  onAdd,
  onClose,
  onReorder,
}: HomeFieldsSheetProps) {
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    fields.map((field) => String(field.id)),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState('');
  const [orderError, setOrderError] = useState('');
  const dragStartOrderRef = useRef<string[]>([]);
  const orderedIdsRef = useRef<string[]>(
    fields.map((field) => String(field.id)),
  );

  const pendingField = fields.find((field) => String(field.id) === fieldToDelete);

  const orderedFields = useMemo(() => {
    const byId = new Map(fields.map((field) => [String(field.id), field]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean) as FieldOption[];

    for (const field of fields) {
      if (!orderedIds.includes(String(field.id))) ordered.push(field);
    }

    return ordered;
  }, [fields, orderedIds]);

  useEffect(() => {
    const currentIds = fields.map((field) => String(field.id));
    setOrderedIds((previous) => {
      const sameMembers =
        previous.length === currentIds.length &&
        previous.every((id) => currentIds.includes(id));

      const next = sameMembers ? previous : currentIds;
      orderedIdsRef.current = next;
      return next;
    });
  }, [fields]);

  const moveField = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setOrderedIds((current) => {
      const next = [...current];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return current;

      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      orderedIdsRef.current = next;
      return next;
    });
  };

  const saveFieldOrder = async (ids: string[]) => {
    setOrderMessage('');
    setOrderError('');

    try {
      await reorderUserFields(ids);
      setOrderMessage('Sıralama kaydedildi.');
      window.setTimeout(() => setOrderMessage(''), 1600);
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : 'Tarla sıralaması kaydedilemedi.',
      );
    }
  };

  const startDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    setOrderMessage('');
    setOrderError('');
    dragStartOrderRef.current = [...orderedIdsRef.current];
    setDraggingId(id);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture desteklenmiyorsa document hit-test yine çalışır.
    }
  };

  const dragOver = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingId) return;

    event.preventDefault();
    const hit = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-field-sort-id]');

    const targetId = hit?.dataset.fieldSortId;
    if (targetId) moveField(draggingId, targetId);
  };

  const finishDrag = async (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!draggingId) return;

    event.preventDefault();

    /*
     * PointerMove ile state çok hızlı değişebildiği için son sırayı ref'ten al.
     * Böylece bırakıldığı anda gördüğün sıra neyse aynen global listeye gider.
     */
    const finalIds = [...orderedIdsRef.current];
    const previousIds = [...dragStartOrderRef.current];
    const changed = finalIds.join('|') !== previousIds.join('|');

    setDraggingId(null);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op
    }

    if (!changed) return;

    /*
     * Önce uygulamanın ortak field listesini güncelle.
     * Böylece ana haritadaki açılır tarla listesi ANINDA aynı sırayı alır.
     */
    onReorder?.(finalIds);

    try {
      await saveFieldOrder(finalIds);
    } catch {
      orderedIdsRef.current = previousIds;
      setOrderedIds(previousIds);
      onReorder?.(previousIds);
    }
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setFieldToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!pendingField || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(String(pendingField.id));
      setFieldToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Tarla silinemedi. Tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (fieldToDelete) {
          if (!deleting) {
            setFieldToDelete(null);
            setDeleteError('');
          }
        } else onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, fieldToDelete, deleting]);

  if (!open) return null;

  return createPortal(
    <div
      className="tp-fields-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          if (fieldToDelete) closeDeleteConfirmation();
          else onClose();
        }
      }}
    >
      <section className="tp-fields-sheet" role="dialog" aria-modal="true" aria-labelledby={fieldToDelete ? 'tp-fields-delete-title' : 'tp-fields-sheet-title'}>
        {fieldToDelete ? (
          <div className="tp-fields-delete-confirmation">
            <span className="tp-fields-delete-kicker">TARLA SİLME</span>
            <h2 id="tp-fields-delete-title">Emin misin?</h2>
            <p><strong>{pendingField?.name || 'Bu tarla'}</strong> ve ona bağlı kayıtlar kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            {!getEntitlementSnapshot().isPremium && (
              <p className="tp-fields-delete-warning">Ücretsiz planda tarla değiştirme hakkı 7 günde bir yenilenir. İlk eklemeden sonraki 24 saatlik düzeltme süresi istisnadır.</p>
            )}
            {deleteError && <p className="tp-fields-delete-error" role="alert">{deleteError}</p>}
            <div className="tp-fields-delete-actions">
              <button type="button" onClick={closeDeleteConfirmation} disabled={deleting}>Vazgeç</button>
              <button type="button" className="danger" onClick={() => void confirmDelete()} disabled={deleting || !pendingField}>
                {deleting ? 'Siliniyor…' : 'Evet, Tarlayı Sil'}
              </button>
            </div>
          </div>
        ) : (
          <>
        <div className="tp-fields-sheet-head">
          <div>
            <small>TARLALARIN</small>
            <h2 id="tp-fields-sheet-title">Tarlalarım</h2>
            <span className="tp-fields-sheet-sort-help">
              Sıralamak için tutup sürükle
            </span>
          </div>
          <button type="button" className="tp-fields-sheet-close" aria-label="Tarlalarımı kapat" onClick={onClose}>×</button>
        </div>
        {orderMessage ? (
          <p className="tp-fields-sheet-order-message">{orderMessage}</p>
        ) : null}
        {orderError ? (
          <p className="tp-fields-sheet-order-error" role="alert">{orderError}</p>
        ) : null}

        <div className={`tp-fields-sheet-list${draggingId ? ' is-sorting' : ''}`}>
          {orderedFields.length ? orderedFields.map((field) => {
            const id = String(field.id);
            const selected = id === selectedId;
            return (
              <div
                key={id}
                data-field-sort-id={id}
                className={`tp-fields-sheet-field${selected ? ' is-selected' : ''}${draggingId === id ? ' is-dragging' : ''}`}
              >
                <button
                  type="button"
                  className="tp-fields-sheet-drag"
                  onPointerDown={(event) => startDrag(event, id)}
                  onPointerMove={dragOver}
                  onPointerUp={(event) => void finishDrag(event)}
                  onPointerCancel={(event) => void finishDrag(event)}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasını sıralamak için tutup sürükle`}
                  title="Tut ve sürükle"
                >
                  <GripVertical size={18} strokeWidth={1.9} />
                </button>

                {!field.demo && <button
                  type="button"
                  className="tp-fields-sheet-delete"
                  onClick={() => {
                    setDeleteError('');
                    setFieldToDelete(id);
                  }}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasını sil`}
                >Sil</button>}
                <button
                  type="button"
                  className="tp-fields-sheet-field-select"
                  onClick={() => onSelect(id)}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasını seç`}
                >
                  <span className="tp-fields-sheet-field-icon" aria-hidden="true">✦</span>
                  <span className="tp-fields-sheet-field-copy">
                    <strong>{field.name || 'Adsız Tarla'}</strong>
                    <small>{field.crop || 'Ürün belirtilmedi'}</small>
                  </span>
                  {selected && <span className="tp-fields-sheet-field-status">Seçili</span>}
                </button>
                <button
                  type="button"
                  className="tp-fields-sheet-detail"
                  onClick={() => onDetail(id)}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasının detayını aç`}
                >Detay</button>
              </div>
            );
          }) : <p className="tp-fields-sheet-empty">Henüz kayıtlı tarlan yok.</p>}
        </div>
        <button type="button" className="tp-fields-sheet-add" onClick={onAdd}>+ Yeni tarla ekle</button>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
