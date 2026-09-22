import type { FieldSeason, FieldActivity } from '../../../types';
import { buildFieldCostSummary } from './fieldCostSummary.ts';

const validDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);

export function buildFieldSeasonSummaries(seasons: FieldSeason[], activities: FieldActivity[], today: string) {
  const ranges = [...new Map(seasons.map((item) => [item.id, item])).values()].map((season) => {
    const start = validDate(season.plantingDate) ? season.plantingDate : null;
    const harvest = validDate(season.harvestDate) ? season.harvestDate : null;
    const end = harvest && harvest <= today ? harvest : today;
    const usable = Boolean(start && start <= today && end >= start &&
      (!season.harvestDate || harvest && harvest >= start));
    return { season, start, end, usable, complete: Boolean(harvest && harvest <= today) };
  });
  return ranges.sort((a, b) => b.season.year - a.season.year).map((range) => {
    const overlap = range.usable && ranges.some((other) => other.season.id !== range.season.id && other.usable &&
      range.start! <= other.end && other.start! <= range.end);
    const eligible = range.usable && !overlap;
    const selected = eligible ? activities.filter((item) => validDate(item.activityDate) && item.activityDate >= range.start! && item.activityDate <= range.end) : [];
    const cost = eligible ? buildFieldCostSummary(selected, null, null, today) : null;
    const harvests = [...new Map(selected.filter((item) => item.type === 'Hasat').map((item) => [item.id, item])).values()];
    const weighed = harvests.flatMap((item) => {
      if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity < 0) return [];
      const unit = item.unit?.trim().toLocaleLowerCase('tr-TR');
      if (unit === 'kg' || unit === 'kilogram') return [item.quantity];
      if (unit === 'ton' || unit === 't') return [item.quantity * 1000];
      return [];
    });
    return {
      id: range.season.id, crop: range.season.crop, year: range.season.year,
      start: range.start, end: range.end, complete: range.complete,
      message: overlap ? 'Sezon tarihleri başka bir sezonla çakışıyor. Masraf ve hasadı yanlış ürüne bağlamamak için hesap yapılmadı.'
        : !range.usable ? 'Ekim ve hasat tarihlerini kontrol et. Tarih aralığı belirlenmeden sezon hesabı yapılamaz.' : null,
      cost, harvestKg: weighed.length ? weighed.reduce((sum, value) => sum + value, 0) : null,
      missingHarvestCount: harvests.length - weighed.length,
    };
  });
}
