import test from 'node:test';
import assert from 'node:assert/strict';
import { searchKnowledge } from './services/catalog.ts';
import { plantVillageEntries as knowledgeEntries } from './data/plantVillage.ts';
import { knowledgeSources } from './data/sources.ts';
import { validatePackage } from '../../../tools/knowledge/import.mjs';

test('Türkçe karakterler ve birden fazla arama kelimesi eşleşir', () => {
  assert.equal(searchKnowledge(knowledgeEntries, 'MISIR PAS')[0].titleTr, 'Mısırda adi pas');
  assert.equal(searchKnowledge(knowledgeEntries, 'domates mildiyo')[0].originalTitle, 'Tomato___Late_blight');
  assert.equal(searchKnowledge(knowledgeEntries, 'Tomato___Late_blight').length, 1);
  assert.equal(searchKnowledge(knowledgeEntries, 'olmayan kelime').length, 0);
});
test('Kaynak, ürün ve konu filtreleri birlikte uygulanır; boş kaynak veri uydurmaz', () => {
  assert.equal(searchKnowledge(knowledgeEntries, '', 'plantvillage', 'Domates', 'pest').length, 1);
  for (const source of knowledgeSources.filter((item) => item.id !== 'plantvillage')) {
    assert.equal(searchKnowledge(knowledgeEntries, '', source.id).length, 0);
  }
});
test('PlantVillage etiketlerinin kimliği, lisansı ve kaynak sürümü korunur', () => {
  assert.equal(knowledgeEntries.length, 38);
  assert.equal(new Set(knowledgeEntries.map((entry) => entry.id)).size, 38);
  assert.ok(knowledgeEntries.every((entry) => entry.sourceVersion.length === 40 && entry.license === 'CC BY-SA 3.0'));
  assert.ok(knowledgeEntries.every((entry) => entry.contentType === 'label' && entry.symptomsTr.length === 0));
});
function pack() {
  return { schemaVersion: 1, rights: { openfarm: { redistribution: true, evidenceUrl: 'https://example.org/license', checkedBy: 'Test reviewer' } },
    entries: [{ ...knowledgeEntries[0], id: 'openfarm:test', sourceId: 'openfarm', sourceRecordId: 'test', translation: 'reviewed', reviewedBy: 'Test reviewer', reviewedAt: '2026-01-01' }] };
}
test('İçe aktarma eksik çeviri, kaynak, lisans, tekrar ve tehlikeli bağlantıları reddeder', () => {
  assert.equal(validatePackage(pack()).length, 1);
  for (const change of [{ translation: 'editorial' }, { sourceUrl: 'javascript:alert(1)' }, { sourceVersion: '' }, { reviewedBy: '' }, { reviewedAt: '2026-02-30' }]) {
    const p = pack(); Object.assign(p.entries[0], change); assert.throws(() => validatePackage(p));
  }
  const p = pack(); p.entries.push({ ...p.entries[0] }); assert.throws(() => validatePackage(p));
  const noRights = pack(); noRights.rights = {}; assert.throws(() => validatePackage(noRights));
});
test('IP102 akademik kullanım koşulu uygulama izni yerine geçmez', () => {
  const p = pack(); Object.assign(p.entries[0], { sourceId: 'ip102', id: 'ip102:test' });
  p.rights.ip102 = { redistribution: true, evidenceUrl: 'https://example.org/license', checkedBy: 'Test reviewer' };
  assert.throws(() => validatePackage(p), /özel izin/);
  p.rights.ip102.permissionForApp = true;
  assert.equal(validatePackage(p).length, 1);
});
