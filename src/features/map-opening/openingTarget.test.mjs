import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpeningTarget } from './openingTarget.ts';

test('tarla varsa GPS konumu farklı olsa da doğrudan tarla seçilir', async () => {
  let requests = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    geolocation: { getCurrentPosition() { requests++; throw Error('GPS must not be requested'); } },
  } });
  const target = await resolveOpeningTarget(true, [35, 39], [34, 38, 36, 40]);
  assert.deepEqual(target, { center: [35, 39], bbox: [34, 38, 36, 40], zoom: 16 });
  assert.equal(requests, 0);
});
test('tarla yoksa GPS kullanılır; izin reddedildiğinde konum uydurulmaz', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    geolocation: { getCurrentPosition(success) { success({ coords: { longitude: 29, latitude: 41 } }); } },
  } });
  assert.deepEqual(await resolveOpeningTarget(false, [35, 39], null), { center: [29, 41], bbox: null, zoom: 13 });
  navigator.geolocation.getCurrentPosition = (_, failure) => failure();
  assert.equal(await resolveOpeningTarget(false, [35, 39], null), null);
});
