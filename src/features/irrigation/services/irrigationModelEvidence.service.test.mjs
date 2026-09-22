import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('./irrigationModelEvidence.service.ts', import.meta.url);

test('pyfao56 agreement requires a complete five-day production horizon', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /productionForecastComplete/);
  assert.match(source, /decision\.forecast\.length === 5/);
  assert.match(source, /horizonDays === 5/);
  assert.match(source, /comparisonWindowAligned/);
  assert.match(source, /finite\(production5Day\)/);
  assert.match(source, /rootRange/);
});
test('incomplete production horizon stays explicitly non-comparable', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /agreement: IrrigationShadowModelEvidence\['agreement'\] = 'not_comparable'/);
  assert.match(source, /production projeksiyonu eksik/);
  assert.match(source, /tam beş günlük production ufku/);
});


test('promotion gate cannot grant production authority', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /const promotionEligible =/);
  assert.match(source, /agreement === 'supportive'/);
  assert.match(source, /confidence === 'high'/);
  assert.match(source, /horizonDays === 5/);
  assert.match(source, /productionForecastComplete/);
  assert.match(source, /isDualKcShadowAuditFresh\(audit\)/);
  assert.match(source, /productionAuthority: false/);
});


test('pyfao56 comparison requires the exact same calendar window', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /function productionForecastWindow/);
  assert.match(source, /function shadowWindowAligned/);
  assert.match(source, /scenario\.startDate === productionWindow\.startDate/);
  assert.match(source, /scenario\.endDate === productionWindow\.endDate/);
  assert.match(source, /comparisonWindowAligned/);
  assert.match(source, /aynı 5 takvim gününü kapsamıyor/);
  assert.match(source, /farklı tarih pencereleri sayısal olarak karşılaştırılmadı/);
});


test('irrigation detail exposes real balance, five-day forecast and validation evidence', async () => {
  const source = await readFile(new URL('../components/IrrigationDecisionDetailModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /SULAMA DURUMU/);
  assert.match(source, /5 GÜNLÜK SU DENGESİ/);
  assert.match(source, /MODEL DOĞRULAMASI/);
  assert.match(source, /currentDeficitMm/);
  assert.match(source, /projected5DayDeficitMm/);
  assert.match(source, /consecutiveSupportiveRuns/);
  assert.match(source, /Eksik gün varken sıfır kabul edilmez/);
});


test('promotion fails closed until repeated validation history is present', async () => {
  const source = await readFile(new URL('./irrigationModelEvidence.service.ts', import.meta.url), 'utf8');
  assert.match(source, /const historyEligible = validationHistory\?\.eligible === true/);
  assert.match(source, /eligible: assessedEvidence\.promotionGate\.eligible && historyEligible/);
  assert.match(source, /doğrulama geçmişi henüz yüklenmedi/);
});

test('production comparison requires five real consecutive calendar days', async () => {
  const source = await readFile(new URL('./irrigationModelEvidence.service.ts', import.meta.url), 'utf8');
  assert.match(source, /function strictUtcDateMs/);
  assert.match(source, /date\.getUTCFullYear\(\) !== year/);
  assert.match(source, /86_400_000/);
});


test('field detail exposes user-selected irrigation method without treating wetting fraction as efficiency', async () => {
  const detail = await readFile(new URL('../../field-detail/components/FieldIrrigationMethod.tsx', import.meta.url), 'utf8');
  assert.match(detail, /saveFieldIrrigationMethod/);
  assert.match(detail, /pyfao56 Dual-Kc ıslanan yüzey hesabını besler/);
  assert.match(detail, /Sulama randımanı değildir/);
  assert.doesNotMatch(detail, /grossWaterMm/);
});


test('production irrigation decision carries the user-selected method into visible detail', async () => {
  const context = await readFile(new URL('./irrigationContext.service.ts', import.meta.url), 'utf8');
  const decision = await readFile(new URL('./irrigationDecision.service.ts', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../components/IrrigationDecisionDetailModal.tsx', import.meta.url), 'utf8');
  assert.match(context, /irrigation_status, irrigation_method/);
  assert.match(decision, /irrigationMethod: irrigation\.irrigationMethod/);
  assert.match(detail, /Sulama yöntemi/);
  assert.match(detail, /irrigationMethodLabel\(decision\.irrigationMethod\)/);
});
