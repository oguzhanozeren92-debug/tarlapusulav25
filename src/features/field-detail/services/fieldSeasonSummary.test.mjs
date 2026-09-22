import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldSeasonSummaries } from './fieldSeasonSummary.ts';
const season = { id: 's1', year: 2026, crop: 'Arpa', plantingDate: '2025-10-01', harvestDate: '2026-07-10', notes: null };
const op = (id, date, cost, patch = {}) => ({ id, activityDate: date, cost, type: 'Sulama', quantity: null, unit: null, ...patch });
const build = (seasons, activities) => buildFieldSeasonSummaries(seasons, activities, '2026-09-13');
test('takvim yılı yerine ekimden hasada kadar gerçek masrafı toplar', () => {
 const result = build([season], [op('1', '2025-11-01', 100), op('2', '2026-06-01', 200), op('3', '2026-08-01', 900)])[0];
 assert.equal(result.cost.total, 300);
 assert.equal(result.cost.activityCount, 2);
});
test('kg ve ton hasadını birleştirir, birimsiz miktarı gizlice toplamaz', () => {
 const result = build([season], [op('1', '2026-07-10', 0, { type: 'Hasat', quantity: 2, unit: 'ton' }), op('2', '2026-07-10', null, { type: 'Hasat', quantity: 500, unit: 'kg' }), op('3', '2026-07-10', null, { type: 'Hasat', quantity: 10, unit: 'çuval' })])[0];
 assert.equal(result.harvestKg, 2500);
 assert.equal(result.missingHarvestCount, 1);
 assert.equal(result.cost.missingCount, 2);
});
test('çakışan veya eksik tarihli sezonlara yanlış masraf bağlanmaz', () => {
 const overlapping = build([season, { ...season, id: 's2', plantingDate: '2026-04-01' }], [op('1', '2026-06-01', 100)]);
 assert.ok(overlapping.every((s) => s.cost === null && /çakışıyor/.test(s.message)));
 assert.equal(build([{ ...season, plantingDate: null }], [])[0].cost, null);
 assert.equal(build([{ ...season, harvestDate: '2025-09-01' }], [])[0].cost, null);
});
test('devam eden sezon bugüne kadar hesaplanır; tarihsiz hasat hesaba girmez', () => {
 const result = build([{ ...season, harvestDate: null }], [op('1', '2026-09-12', 50), op('2', '2026-09-20', 500), op('3', '2026-02-30', 100, { type: 'Hasat', quantity: 20, unit: 'kg' })])[0];
 assert.equal(result.cost.total, 50);
 assert.equal(result.complete, false);
 assert.equal(result.harvestKg, null);
});
