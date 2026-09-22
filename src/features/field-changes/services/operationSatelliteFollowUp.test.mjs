import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationSatelliteFollowUp } from './operationSatelliteFollowUp.ts';
const now = new Date('2026-09-13T12:00:00Z');
const points = ['2026-08-25', '2026-09-05', '2026-09-12'].map((date, index) => ({ date, average: .4 + index * .05, sampleCount: 20, min: null, max: null, noDataCount: 0 }));
const op = { id: 'op1', fieldId: 'f1', type: 'Sulama', date: '2026-09-08', createdAt: '2026-09-08T10:00:00Z' };
const input = { fieldId: 'f1', operations: [op], points, quality: 'usable', phenology: { stage: 'vegetative', dataStatus: 'usable' } };
test('işlem öncesi ve sonrası gerçek görüntüleri tarihle karşılaştırır', () => {
 const result = buildOperationSatelliteFollowUp(input, now);
 assert.ok(result);
 assert.match(result.evidence.join(' '), /5 Eylül.*12 Eylül/);
 assert.match(result.evidence.join(' '), /arttı/);
 assert.match(result.detail, /tek başına kanıtlamaz/);
});
test('işlem sonrası görüntü yoksa sonuç yerine bekleme durumu verir', () => {
 const result = buildOperationSatelliteFollowUp({ ...input, operations: [{ ...op, date: '2026-09-13' }] }, now);
 assert.match(result.summary, /henüz gelmedi/);
 assert.doesNotMatch(result.evidence.join(' '), /arttı|azaldı/);
});
test('başka tarla, kalitesiz veri, hasat sonrası ve öncesiz seri karşılaştırılmaz', () => {
 for (const patch of [{ operations: [{ ...op, fieldId: 'f2' }] }, { quality: 'insufficient' }, { phenology: { stage: 'post_harvest', dataStatus: 'usable' } }, { operations: [{ ...op, date: '2026-08-20' }] }, { points: points.slice(1) }, { operations: [{ ...op, date: '2026-09-20' }] }]) {
  assert.equal(buildOperationSatelliteFollowUp({ ...input, ...patch }, now), null);
 }
});
test('arada başka işlem varsa değişimi tek işleme bağlamaz', () => {
 const result = buildOperationSatelliteFollowUp({ ...input, operations: [op, { ...op, id: 'op2', type: 'Gübreleme', date: '2026-09-09' }] }, now);
 assert.match(result.evidence.join(' '), /başka işlem/);
});
