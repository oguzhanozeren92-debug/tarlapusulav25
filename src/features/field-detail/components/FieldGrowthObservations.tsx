import { useEffect, useState, type FormEvent } from 'react';

import type { FieldSeason } from '../../../types';
import {
  deleteFieldGrowthObservation,
  listFieldGrowthObservations,
  recordFieldGrowthObservation,
} from '../../phenology/services/fieldGrowthObservation.service';
import type { FieldGrowthObservation } from '../../phenology/types/fieldGrowthObservation';
import type { PhenologyStage } from '../../phenology/types/phenology';

import './FieldGrowthObservations.css';

type Props = {
  fieldId: string;
  seasons: FieldSeason[];
  cropCycle?: 'annual' | 'perennial';
};

type CanonicalStage = Exclude<PhenologyStage, 'unknown'>;

const FIELD_TIME_ZONE = 'Europe/Istanbul';

const STAGE_OPTIONS: Array<{
  value: CanonicalStage;
  label: string;
}> = [
  { value: 'pre_sowing', label: 'Ekim / dikim öncesi' },
  { value: 'establishment', label: 'Çıkış / tutunma' },
  { value: 'vegetative', label: 'Vejetatif gelişim' },
  { value: 'reproductive', label: 'Üreme / başaklanma dönemi' },
  { value: 'maturation', label: 'Olgunlaşma' },
  { value: 'harvest_window', label: 'Hasat dönemi' },
  { value: 'post_harvest', label: 'Hasat sonrası' },
  { value: 'dormancy', label: 'Dinlenme' },
  { value: 'bud_swell', label: 'Tomurcuk kabarması' },
  { value: 'bud_break', label: 'Tomurcuk patlaması' },
  { value: 'flowering', label: 'Çiçeklenme' },
  { value: 'fruit_set', label: 'Meyve tutumu' },
  { value: 'fruit_growth', label: 'Meyve gelişimi' },
  { value: 'veraison', label: 'Ben düşme / renk dönümü' },
  { value: 'leaf_fall', label: 'Yaprak dökümü' },
];

const STAGE_LABEL = new Map(
  STAGE_OPTIONS.map((option) => [option.value, option.label]),
);

function todayLocal() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FIELD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default function FieldGrowthObservations({
  fieldId,
  seasons,
  cropCycle = 'annual',
}: Props) {
  const perennial = cropCycle === 'perennial';
  const [items, setItems] = useState<FieldGrowthObservation[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [observedOn, setObservedOn] = useState(todayLocal());
  const [stage, setStage] = useState<CanonicalStage | ''>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const observedDays = new Set(
    items
      .filter((item) => perennial ? item.seasonId === null : item.seasonId === seasonId)
      .map((item) => item.observedOn),
  ).size;

  const reload = async () => {
    setItems(await listFieldGrowthObservations(fieldId));
  };

  useEffect(() => {
    let active = true;
    setItems([]);
    setError('');
    setSavedMessage('');

    void listFieldGrowthObservations(fieldId)
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Gözlemler yüklenemedi.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [fieldId]);

  useEffect(() => {
    if (perennial) {
      if (seasonId) setSeasonId('');
      return;
    }

    if (!seasons.some((season) => season.id === seasonId)) {
      setSeasonId(seasons[0]?.id ?? '');
    }
  }, [perennial, seasons, seasonId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const season = perennial
      ? null
      : seasons.find((item) => item.id === seasonId) ?? null;

    if ((!perennial && !season) || !observedOn || !stage) {
      setError(
        perennial
          ? 'Gözlem tarihi ve bitkinin evresini seç.'
          : 'Sezon, gözlem tarihi ve bitkinin evresini seç.',
      );
      return;
    }

    if (
      observedOn > todayLocal() ||
      (!perennial && season?.plantingDate && observedOn < season.plantingDate) ||
      (!perennial && season?.harvestDate && observedOn > season.harvestDate)
    ) {
      setError(
        perennial
          ? 'Gözlem tarihi gelecekte olamaz.'
          : 'Gözlem tarihi sezon aralığında olmalı ve gelecekte olamaz.',
      );
      return;
    }

    setBusy(true);
    setError('');
    setSavedMessage('');

    try {
      await recordFieldGrowthObservation({
        fieldId,
        seasonId: perennial ? null : seasonId,
        observedOn,
        stage,
        notes,
      });
      await reload();
      setStage('');
      setNotes('');
      setSavedMessage('Saha gözlemi kaydedildi. Model hazırlığı yeniden kontrol ediliyor.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Gözlem kaydedilemedi.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: FieldGrowthObservation) => {
    if (!window.confirm('Bu gelişim gözlemini silmek istiyor musun?')) return;

    setBusy(true);
    setError('');
    setSavedMessage('');

    try {
      await deleteFieldGrowthObservation(item.id);
      await reload();
      setSavedMessage('Gözlem silindi. Model hazırlığı yeniden kontrol ediliyor.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Gözlem silinemedi.',
      );
    } finally {
      setBusy(false);
    }
  };

  const canRenderForm = perennial || seasons.length > 0;

  return (
    <section className="tp-growth-observations" aria-label="Tarih vererek bitki gelişimi gözlemi ekle">
      <small>SAHADAN GÖZLEM</small>
      <h3>Bitki hangi evredeydi?</h3>
      <p>
        Tarlada gerçekten gördüğün gelişim evresini tarihli kaydet. Bu kayıt model tahmini değildir;
        aynı gün için model farklı bir evre tahmin etse bile gerçek saha gözlemi Kcb doğrulamasında öncelikli kanıttır.
      </p>

      {!canRenderForm ? (
        <p>Önce bu tek yıllık tarla için ürün ve sezon ekle.</p>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          {!perennial && (
            <label>
              Sezon
              <select
                value={seasonId}
                onChange={(event) => setSeasonId(event.target.value)}
                required
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.year} · {season.crop}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Gördüğün tarih
            <input
              type="date"
              value={observedOn}
              max={todayLocal()}
              onChange={(event) => setObservedOn(event.target.value)}
              required
            />
          </label>

          <label>
            Bitkinin evresi
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value as CanonicalStage | '')}
              required
            >
              <option value="">Evre seç</option>
              {STAGE_OPTIONS.map((option) => (
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
              placeholder="Tarlada ne gördün?"
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Gözlemi kaydet'}
          </button>
        </form>
      )}

      {canRenderForm && (
        <p>
          {perennial
            ? `Bu çok yıllık tarlada ${observedDays} ayrı güne ait saha gözlemi var.`
            : `Seçilen sezonda ${observedDays} ayrı güne ait gözlem var.`}{' '}
          Kcb doğrulamasında aynı gün için tek ve açık bir gerçek saha evresi kullanılır; model tahmini farklıysa çelişki ayrıca işaretlenir.
        </p>
      )}

      {savedMessage && <p role="status">{savedMessage}</p>}
      {error && <p role="alert">{error}</p>}

      {items.length > 0 && (
        <div className="tp-growth-observations-list">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{STAGE_LABEL.get(item.stage) ?? item.stage}</strong>
                <span>
                  {item.observedOn} · {item.seasonId
                    ? seasons.find((season) => season.id === item.seasonId)?.crop ?? 'Sezon'
                    : 'Çok yıllık saha gözlemi'}
                </span>
                {item.notes && <p>{item.notes}</p>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(item)}
                aria-label={`${STAGE_LABEL.get(item.stage) ?? item.stage} gözlemini sil`}
              >
                Sil
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
