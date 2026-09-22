import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('./dualKcRuntimeValidation.service.ts', import.meta.url);
const snapshotUrl = new URL('./dualKcProductionComparison.service.ts', import.meta.url);

test('runtime validation uses historical days only from same-run production snapshots', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /const currentAudit = audits\[0\]/);
  assert.match(source, /assessDualKcModelEvidence\(input\.decision, currentAudit\)/);
  assert.match(source, /const snapshot = audit\.comparison/);
  assert.match(source, /if \(!snapshot\) return \[\]/);
  assert.match(source, /snapshot\.promotionEligibleAtCapture/);
  assert.match(source, /snapshot\.productionAuthority === false/);
});

test('comparison snapshot is immutable, exact-window and non-authoritative', async () => {
  const source = await readFile(snapshotUrl, 'utf8');

  assert.match(source, /if \(!audit\.runId \|\| audit\.status !== 'completed' \|\| audit\.comparison\) return false/);
  assert.match(source, /productionForecastWindow\(decision\)/);
  assert.match(source, /production_authority: false/);
  assert.match(source, /projected_5_day_deficit_mm: projected/);
  assert.match(source, /forecast_start_date: window\.startDate/);
  assert.match(source, /forecast_end_date: window\.endDate/);
});

test('runtime validation requires persisted verified soil-water evidence', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /listSoilWaterMeasurements\(fieldId, 100\)/);
  assert.match(source, /verifiedSoilWaterMeasurementCount: measurements\.length/);
});
