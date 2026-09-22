import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { knowledgeSources } from '../../src/features/knowledge/data/sources.ts';
import { plantVillageEntries } from '../../src/features/knowledge/data/plantVillage.ts';

const sourceIds = new Set(knowledgeSources.map((source) => source.id));
const kinds = new Set(['growing', 'disease', 'pest', 'healthy']);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const https = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Offline editorial import. No network calls, secrets, or browser-side publishing. */
export function validatePackage(pack) {
  if (!pack || pack.schemaVersion !== 1 || !Array.isArray(pack.entries) || !pack.entries.length) {
    throw new Error('schemaVersion: 1 ve boş olmayan entries dizisi gerekli.');
  }
  if (pack.entries.length > 10000) throw new Error('Bir pakette en fazla 10000 kayıt olabilir.');
  const used = new Set(plantVillageEntries.map((entry) => entry.id));
  const records = new Set(plantVillageEntries.map((entry) => `${entry.sourceId}:${entry.sourceRecordId}`));
  return pack.entries.map((entry, index) => {
    const fail = (reason) => { throw new Error(`Kayıt ${index + 1}: ${reason}`); };
    if (!entry || typeof entry !== 'object') fail('Nesne bekleniyor.');
    if (!sourceIds.has(entry.sourceId)) fail('Bilinmeyen kaynak.');
    if (!text(entry.id) || !/^[a-z0-9:_-]+$/.test(entry.id) || !entry.id.startsWith(`${entry.sourceId}:`)) fail('Kaynak önekli sabit kimlik gerekli.');
    if (used.has(entry.id)) fail('Tekrarlanan kimlik.');
    used.add(entry.id);
    for (const field of ['sourceRecordId', 'sourceVersion', 'titleTr', 'originalTitle', 'summaryTr', 'attribution', 'license', 'reviewedBy']) {
      if (!text(entry[field])) fail(`${field} gerekli.`);
    }
    const recordKey = `${entry.sourceId}:${entry.sourceRecordId}`;
    if (records.has(recordKey)) fail('Aynı kaynak kaydı iki kez eklenemez.');
    records.add(recordKey);
    for (const field of ['sourceUrl', 'licenseUrl']) if (!https(entry[field])) fail(`${field} HTTPS adresi olmalı.`);
    if (!validDate(entry.reviewedAt)) fail('Geçerli reviewedAt tarihi gerekli.');
    if (entry.reviewedAt > new Date().toISOString().slice(0, 10)) fail('İnceleme tarihi gelecekte olamaz.');
    if (entry.translation !== 'reviewed') fail('Türkçe içerik incelemesi tamamlanmamış.');
    if (!kinds.has(entry.kind) || !['label', 'article'].includes(entry.contentType)) fail('Geçersiz kayıt türü.');
    for (const field of ['crops', 'symptomsTr', 'observationTr', 'aliases']) {
      if (!Array.isArray(entry[field]) || !entry[field].every(text)) fail(`${field} metin dizisi olmalı.`);
    }
    if (!entry.crops.length) fail('En az bir ürün gerekli.');
    if (typeof entry.scientificName !== 'string') fail('scientificName metin olmalı; bilinmiyorsa boş bırakılabilir.');
    if (entry.contentType === 'label' && (entry.symptomsTr.length || entry.observationTr.length)) fail('Etiket kaydı rehber bilgisi içeremez.');
    if (entry.contentType === 'article' && !entry.observationTr.length) fail('Rehber için doğrulanmış gözlem bilgisi gerekli.');
    const rights = pack.rights?.[entry.sourceId];
    if (!rights || rights.redistribution !== true || !https(rights.evidenceUrl) || !text(rights.checkedBy)) fail('Dağıtım hakkı kontrolü ve kanıt bağlantısı gerekli.');
    if (entry.sourceId === 'ip102' && rights.permissionForApp !== true) fail('IP102 uygulama kullanımı için özel izin gerekli.');
    // Whitelist fields: never propagate markup, image URLs or arbitrary payload properties.
    const fields = ['id', 'sourceId', 'sourceRecordId', 'sourceUrl', 'sourceVersion', 'titleTr', 'originalTitle',
      'scientificName', 'crops', 'kind', 'contentType', 'summaryTr', 'symptomsTr', 'observationTr',
      'aliases', 'attribution', 'license', 'licenseUrl', 'translation', 'reviewedBy', 'reviewedAt'];
    return Object.fromEntries(fields.map((field) => [field, entry[field]]));
  });
}

async function run() {
  const [input] = process.argv.slice(2);
  if (!input) throw new Error('Kullanım: node tools/knowledge/import.mjs <Türkçe-paket.json>');
  const pack = JSON.parse(await readFile(input, 'utf8'));
  const incoming = validatePackage(pack);
  const { importedEntries } = await import('../../src/features/knowledge/data/imported.ts');
  const merged = new Map(importedEntries.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const duplicate = [...merged.values()].find((old) => old.id !== entry.id && old.sourceId === entry.sourceId && old.sourceRecordId === entry.sourceRecordId);
    if (duplicate) throw new Error(`Mevcut kaynak kaydı farklı kimlikle eklenemez: ${entry.id}`);
    merged.set(entry.id, entry);
  }
  const entries = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
  const output = fileURLToPath(new URL('../../src/features/knowledge/data/imported.ts', import.meta.url));
  const temporary = `${output}.${process.pid}.tmp`;
  // Keep the editorial rights audit alongside the content, outside the runtime bundle.
  const audit = fileURLToPath(new URL('./rights-audit.json', import.meta.url));
  let previous = [];
  try { previous = JSON.parse(await readFile(audit, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(previous)) throw new Error('Hak kontrol günlüğü geçersiz; içerik değiştirilmedi.');
  await writeFile(audit, `${JSON.stringify([...previous, { importedAt: new Date().toISOString(), ids: incoming.map((entry) => entry.id), rights: pack.rights }], null, 2)}\n`);
  await writeFile(temporary, `import type { KnowledgeEntry } from '../types.ts';\n\nexport const importedEntries: KnowledgeEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
  await rename(temporary, output);
  console.log(`${incoming.length} kayıt işlendi; toplam ${entries.length} aktarılmış kayıt.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
