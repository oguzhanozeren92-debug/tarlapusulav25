import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRiskRadarDecision } from './buildRiskRadarDecision.ts';

const now = new Date('2026-09-15T06:00:00+03:00');

test('düşük veya desteklenmeyen Risk Radar sonucu bildirim üretmez', () => {
  assert.equal(buildRiskRadarDecision('field-1', { supported: false }, now), null);
  assert.equal(buildRiskRadarDecision('field-1', {
    supported: true,
    overall: { score: 12, level: 'low', levelLabel: 'Düşük' },
    topThreats: [{ name: 'Elma karalekesi', score: 12, level: 'low' }],
  }, now), null);
});

test('yüksek Risk Radar sonucu Today, bildirim ve Pusula kanallarına tek kanonik olay üretir', () => {
  const event = buildRiskRadarDecision('field-42', {
    supported: true,
    overall: {
      score: 78,
      level: 'high',
      levelLabel: 'Yüksek',
      headline: 'Elma karalekesi riski yüksek',
      recommendation: 'Saha kontrolü yap.',
    },
    topThreats: [{
      name: 'Elma karalekesi',
      score: 78,
      level: 'high',
      peakScore7d: 91,
      peakDate: '2026-09-17',
      trend: 'rising',
      reasons: ['Nem yüksek.', 'Yaprak ıslaklığı arttı.', 'Yağış bekleniyor.', 'fazla kanıt'],
      action: 'Belirti kontrolünü önceliklendir.',
    }],
  }, now);

  assert.ok(event);
  assert.equal(event.group, 'risk-radar');
  assert.equal(event.source, 'risk-radar');
  assert.equal(event.priority, 110);
  assert.equal(event.severity, 'danger');
  assert.deepEqual(event.channels, ['today', 'notification', 'pusula']);
  assert.match(event.id, /^risk-radar:field-42:elma-karalekesi:high:/);
  assert.match(event.detail, /Risk skoru %78/);
  assert.match(event.detail, /7 günlük tepe risk %91/);
  assert.equal(event.evidence.length, 3);
});

test('orta risk tehlike yerine uyarı olarak yönlendirilir', () => {
  const event = buildRiskRadarDecision('field-7', {
    supported: true,
    overall: { score: 42, level: 'moderate', levelLabel: 'Orta' },
    topThreats: [{ name: 'Bağ mildiyösü', score: 42, level: 'moderate', action: 'Takip et.' }],
  }, now);

  assert.ok(event);
  assert.equal(event.priority, 97);
  assert.equal(event.severity, 'warning');
  assert.equal(event.today?.tone, 'amber');
});
