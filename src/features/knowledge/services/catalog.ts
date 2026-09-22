import type { KnowledgeEntry } from '../types.ts';
import { plantVillageEntries } from '../data/plantVillage.ts';
import { importedEntries } from '../data/imported.ts';

export const normalizeKnowledgeText = (value: string) => value
  .toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();

export const knowledgeEntries: KnowledgeEntry[] = [...plantVillageEntries, ...importedEntries];

export function searchKnowledge(entries: KnowledgeEntry[], query: string, source = 'all', crop = 'all', kind = 'all') {
  const words = normalizeKnowledgeText(query).split(' ').filter(Boolean);
  return entries.filter((entry) => {
    if (source !== 'all' && entry.sourceId !== source) return false;
    if (crop !== 'all' && !entry.crops.includes(crop)) return false;
    if (kind !== 'all' && entry.kind !== kind) return false;
    const haystack = normalizeKnowledgeText([
      entry.titleTr, entry.originalTitle, entry.scientificName, entry.summaryTr,
      ...entry.crops, ...entry.aliases, ...entry.symptomsTr,
    ].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}
