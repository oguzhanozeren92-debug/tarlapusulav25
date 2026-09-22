import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldCostSummary } from './fieldCostSummary.ts';
const activity = (id, cost, patch = {}) => ({ id, cost, type: 'Sulama', activityDate: '2026-09-12', ...patch });
const summarize = (items, area = 10, year = 2026) => buildFieldCostSummary(items, area, year, '2026-09-13');
test('kuruşları doğru toplar, sıfır tutarı gerçek kayıt sayar ve dönüme böler', () => {
 const result = summarize([activity('1', .1), activity('2', .2), activity('3', 0)]);
 assert.equal(result.total, .3);
 assert.equal(result.perDecare, .03);
 assert.equal(result.recordedCount, 3);
});
test('eksik veya geçersiz tutar toplamı azaltmış gibi gizlenmez', () => {
 const result = summarize([activity('1', null), activity('2', -10), activity('3', NaN), activity('4', 100)]);
 assert.equal(result.total, 100);
 assert.equal(result.missingCount, 3);
 assert.equal(summarize([activity('1', null)]).recordedCount, 0);
});
test('yıl seçimi, ileri tarih ve okunamayan tarih ayrı tutulur', () => {
 const items = [activity('1', 100), activity('2', 50, { activityDate: '2025-09-12' }), activity('3', 500, { activityDate: '2026-09-20' }), activity('4', 30, { activityDate: '2026-02-30' })];
 assert.equal(summarize(items).total, 100);
 assert.equal(summarize(items, 10, null).total, 150);
 assert.equal(summarize(items).futureCount, 1);
 assert.equal(summarize(items).undatedCount, 1);
});
test('alan bilinmiyorsa hesap üretmez; tekrar eden işlem iki kez sayılmaz', () => {
 const items = [activity('1', 100), activity('1', 100)];
 assert.equal(summarize(items).total, 100);
 for (const area of [0, null, undefined, NaN, -2]) assert.equal(buildFieldCostSummary(items, area, 2026, '2026-09-13').perDecare, null);
});
