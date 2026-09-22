import { test } from 'node:test';
import assert from 'node:assert/strict';

function browser(reduce = false) {
  globalThis.window = {
    matchMedia: () => ({ matches: reduce }),
  };
}

async function fresh() {
  return import(`./mapOpening.ts?test=${Math.random()}`);
}

function mapDouble() {
  const calls = [];

  return {
    calls,
    cameraForBounds: (bounds) => ({
      center: [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2,
      ],
      zoom: 16,
    }),
    flyTo: (options) => calls.push(['fly', options]),
    jumpTo: (options) => calls.push(['jump', options]),
  };
}

test('her harita girişinde uydu -> tarla açılışı oynatılabilir', async () => {
  browser(false);
  const opening = await fresh();

  assert.equal(opening.shouldPlayMapOpening(), true);

  const firstMap = mapDouble();
  opening.openMapAtField(firstMap, [35, 39], [34, 38, 36, 40], true);
  assert.equal(firstMap.calls[0][0], 'fly');
  assert.deepEqual(firstMap.calls[0][1].center, [35, 39]);

  // Önceki sürümde sessionStorage burada ikinci açılışı engelliyordu.
  assert.equal(opening.shouldPlayMapOpening(), true);

  const secondMap = mapDouble();
  opening.openMapAtField(secondMap, [32, 41], null, true);
  assert.equal(secondMap.calls[0][0], 'fly');
  assert.deepEqual(secondMap.calls[0][1].center, [32, 41]);
});

test('azaltılmış hareket tercihinde animasyon yapılmaz', async () => {
  browser(true);
  const opening = await fresh();

  assert.equal(opening.shouldPlayMapOpening(), false);

  const map = mapDouble();
  opening.openMapAtField(map, [32, 41], null, true);
  assert.equal(map.calls[0][0], 'jump');
  assert.deepEqual(map.calls[0][1].center, [32, 41]);
});
