import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  deleteSoilWaterMeasurement,
  listSoilWaterMeasurements,
  recordSoilWaterMeasurement,
} from '../services/soilWaterMeasurement.service';

import type {
  SoilWaterMeasurement,
  SoilWaterMeasurementSource,
} from '../types/soilWaterMeasurement';

import './FieldWaterMeasurements.css';

type Props = {
  fieldId: string;
};

const WATER_MEASUREMENT_FOCUS_KEY = 'tp_focus_field_water_measurement';
const WATER_MEASUREMENT_FOCUS_MAX_AGE_MS = 15_000;

const SOURCE_OPTIONS: Array<{
  value: SoilWaterMeasurementSource;
  label: string;
}> = [
  { value: 'manual_verified', label: 'Elle ölçüldü / doğrulandı' },
  { value: 'sensor', label: 'Sensör' },
  { value: 'laboratory', label: 'Laboratuvar' },
];

function localDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMeasuredAt(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function sourceLabel(source: SoilWaterMeasurementSource) {
  return SOURCE_OPTIONS.find((item) => item.value === source)?.label ?? source;
}

function shouldFocusSurfaceMeasurement(fieldId: string) {
  try {
    const raw = window.sessionStorage.getItem(WATER_MEASUREMENT_FOCUS_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as {
      fieldId?: unknown;
      createdAt?: unknown;
    };
    const markerFieldId = String(parsed?.fieldId ?? '').trim();
    const createdAt = Number(parsed?.createdAt ?? 0);
    const fresh = Number.isFinite(createdAt) &&
      Date.now() - createdAt >= 0 &&
      Date.now() - createdAt <= WATER_MEASUREMENT_FOCUS_MAX_AGE_MS;

    if (markerFieldId === String(fieldId) && fresh) {
      window.sessionStorage.removeItem(WATER_MEASUREMENT_FOCUS_KEY);
      return true;
    }

    if (!fresh) {
      window.sessionStorage.removeItem(WATER_MEASUREMENT_FOCUS_KEY);
    }
  } catch {
    // sessionStorage kapalıysa normal kullanım devam eder.
  }

  return false;
}

export default function FieldWaterMeasurements({ fieldId }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<SoilWaterMeasurement[]>([]);
  const [measuredAt, setMeasuredAt] = useState(localDateTimeInputValue());
  const [waterPercent, setWaterPercent] = useState('');
  const [depthFromCm, setDepthFromCm] = useState('0');
  const [depthToCm, setDepthToCm] = useState('30');
  const [source, setSource] = useState<SoilWaterMeasurementSource>('manual_verified');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const reload = async () => {
    const result = await listSoilWaterMeasurements(fieldId, 20);
    setItems(result);
  };

  useEffect(() => {
    let active = true;
    setItems([]);
    setError('');
    setSavedMessage('');

    void listSoilWaterMeasurements(fieldId, 20)
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Toprak nem ölçümleri yüklenemedi.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [fieldId]);

  useEffect(() => {
    if (!shouldFocusSurfaceMeasurement(fieldId)) return;

    setDepthFromCm('0');
    setDepthToCm('15');
    if (detailsRef.current) detailsRef.current.open = true;

    const timer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sectionRef.current
        ?.querySelector<HTMLInputElement>('input[type="datetime-local"]')
        ?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [fieldId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const percent = Number(String(waterPercent).replace(',', '.'));
    const from = Number(String(depthFromCm).replace(',', '.'));
    const to = Number(String(depthToCm).replace(',', '.'));

    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      setError('Toprak nemini yüzde olarak 0 ile 100 arasında gir.');
      return;
    }

    if (!Number.isFinite(from) || from < 0) {
      setError('Başlangıç derinliği 0 cm veya daha büyük olmalı.');
      return;
    }

    if (!Number.isFinite(to) || to <= from || to > 300) {
      setError('Bitiş derinliği başlangıçtan büyük ve en fazla 300 cm olmalı.');
      return;
    }

    const parsedMeasuredAt = new Date(measuredAt);
    if (!measuredAt || !Number.isFinite(parsedMeasuredAt.getTime())) {
      setError('Ölçüm tarihini ve saatini kontrol et.');
      return;
    }

    if (parsedMeasuredAt.getTime() > Date.now() + 60_000) {
      setError('Ölçüm zamanı gelecekte olamaz.');
      return;
    }

    setBusy(true);
    setError('');
    setSavedMessage('');

    try {
      await recordSoilWaterMeasurement({
        fieldId,
        measuredAt: parsedMeasuredAt.toISOString(),
        volumetricWaterContent: percent / 100,
        depthFromCm: from,
        depthToCm: to,
        source,
        notes,
      });

      await reload();
      setWaterPercent('');
      setNotes('');
      setMeasuredAt(localDateTimeInputValue());
      setSavedMessage('Toprak nem ölçümü kaydedildi. Model hazırlığı yeniden kontrol ediliyor.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Toprak nem ölçümü kaydedilemedi.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (measurement: SoilWaterMeasurement) => {
    if (!window.confirm('Bu toprak nem ölçümünü silmek istiyor musun?')) return;

    setBusy(true);
    setError('');
    setSavedMessage('');

    try {
      await deleteSoilWaterMeasurement(measurement.id);
      await reload();
      setSavedMessage('Ölçüm silindi. Model hazırlığı yeniden kontrol ediliyor.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Toprak nem ölçümü silinemedi.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="field-water-measurements"
      ref={sectionRef}
      className="tp-field-water-measurements"
      aria-label="Toprak nem ölçümleri"
    >
      <details ref={detailsRef}>
        <summary>
          Toprak nem ölçümü
          <span aria-hidden="true">⌄</span>
        </summary>

        <div className="tp-field-water-measurements-body">
          <small>GERÇEK SAHA VERİSİ · SU DENGESİ</small>
          <h3>Toprakta ne kadar su ölçtün?</h3>
          <p>
            Buraya yalnız gerçekten ölçülmüş değeri gir. Bu kayıt tahmin değildir;
            sulama ve pyfao56 hazırlığında ölçüm kanıtı olarak kullanılır.
          </p>

          <form onSubmit={(event) => void save(event)}>
            <label>
              Ölçüm zamanı
              <input
                type="datetime-local"
                value={measuredAt}
                max={localDateTimeInputValue()}
                onChange={(event) => setMeasuredAt(event.target.value)}
                required
              />
            </label>

            <div className="tp-field-water-measurements-grid">
              <label>
                Başlangıç derinliği (cm)
                <input
                  type="number"
                  min="0"
                  max="299"
                  step="1"
                  inputMode="decimal"
                  value={depthFromCm}
                  onChange={(event) => setDepthFromCm(event.target.value)}
                  required
                />
              </label>

              <label>
                Bitiş derinliği (cm)
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  inputMode="decimal"
                  value={depthToCm}
                  onChange={(event) => setDepthToCm(event.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              Hacimsel toprak nemi (%)
              <input
                type="number"
                min="0.1"
                max="99.9"
                step="0.1"
                inputMode="decimal"
                value={waterPercent}
                placeholder="Örn. 24.5"
                onChange={(event) => setWaterPercent(event.target.value)}
                required
              />
            </label>

            <label>
              Ölçüm kaynağı
              <select
                value={source}
                onChange={(event) => setSource(event.target.value as SoilWaterMeasurementSource)}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Not (isteğe bağlı)
              <textarea
                value={notes}
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Cihaz, nokta veya ölçüm koşulu"
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? 'Kaydediliyor…' : 'Ölçümü kaydet'}
            </button>
          </form>

          {savedMessage && <p className="tp-field-water-success" role="status">{savedMessage}</p>}
          {error && <p className="tp-field-water-error" role="alert">{error}</p>}

          {items.length > 0 ? (
            <div className="tp-field-water-measurements-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>
                      %{(item.volumetricWaterContent * 100).toLocaleString('tr-TR', {
                        maximumFractionDigits: 1,
                      })}
                    </strong>
                    <span>
                      {item.depthFromCm}–{item.depthToCm} cm · {sourceLabel(item.source)}
                    </span>
                    <span>{formatMeasuredAt(item.measuredAt)}</span>
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item)}
                    aria-label={`${formatMeasuredAt(item.measuredAt)} ölçümünü sil`}
                  >
                    Sil
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>Bu tarla için henüz gerçek toprak nem ölçümü yok.</p>
          )}
        </div>
      </details>
    </section>
  );
}
