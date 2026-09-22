import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldChangePresentation } from './fieldChangePresentation.ts';
import { buildHomeSatelliteDecision } from '../../satellite/services/buildHomeSatelliteDecision.ts';
const now = new Date('2026-09-13T12:00:00Z');
const signal = { fieldId: 'f1', status: 'ready', quality: 'usable', direction: 'falling', observationCount: 4, spanDays: 20, latestDate: '2026-09-12' };
const events = (patch = {}) => {
  const event = buildHomeSatelliteDecision('f1', { ...signal, ...patch }, true, now);
  return event ? [event] : [];
};
test('yetersiz, eski veya sabit uydu verisinden logo mesajı üretilmez', () => {
  for (const patch of [{ observationCount: 1 }, { quality: 'insufficient' }, { latestDate: '2026-07-01' }, { direction: 'stable' }]) {
    assert.equal(buildFieldChangePresentation(events(patch), 'f1', signal.latestDate), null);
  }
});
test('aynı değişiklik aynı kimliği korur; yeni görüntü yeni kimlik alır', () => {
  const first = buildFieldChangePresentation(events(), 'f1', signal.latestDate);
  assert.ok(first);
  assert.match(first.summary, /azalıyor/);
  assert.equal(first.key, buildFieldChangePresentation(events({ observationCount: 5 }), 'f1', signal.latestDate).key);
  assert.notEqual(first.key, buildFieldChangePresentation(events(), 'f1', '2026-09-13').key);
  assert.ok(first.evidence.length > 0);
});
