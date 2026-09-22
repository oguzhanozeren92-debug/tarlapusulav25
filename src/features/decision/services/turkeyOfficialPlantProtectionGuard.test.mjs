import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('./turkeyOfficialPlantProtectionGuard.ts', import.meta.url),
  'utf8',
);

assert.match(source, /verifiedOfficialMatch === true/);
assert.match(source, /hasTarget && hasTreatment/);
assert.match(source, /canRecommendChemicalUse: verified/);
assert.match(source, /Resmi BKÜ eşleşmesi doğrulanmadan/);
assert.match(source, /https:\/\/bku\.tarimorman\.gov\.tr\//);
assert.doesNotMatch(source, /Math\.random/);

console.log('turkeyOfficialPlantProtectionGuard: fail-closed source contract OK');
