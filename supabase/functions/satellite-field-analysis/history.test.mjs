import { test } from 'node:test';
import assert from 'node:assert/strict';

let handler;
let catalogDates = [];
let calls = [];
globalThis.Deno = { env: { get: () => 'test' }, serve: callback => { handler = callback; } };
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: init.body instanceof URLSearchParams ? null : JSON.parse(init.body) });
  if (url.includes('openid-connect/token')) return Response.json({ access_token: 'test' });
  if (url.includes('/catalog/')) return Response.json({ features: catalogDates.map((date, i) => ({
    id: String(i), properties: { datetime: date + 'T10:00:00Z', 'eo:cloud_cover': i === 2 ? 90 : 10 },
  })) });
  if (url.includes('/statistics/')) return Response.json({ data: [{ interval: { from: '2026-08-10T00:00:00Z' },
    outputs: { default: { bands: { B0: { stats: { sampleCount: 100, noDataCount: 0, mean: .5, min: .2, max: .7 } } } } },
  }] });
  return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
};
await import('./index.ts');
const geometry = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[35, 39], [35.01, 39], [35.01, 39.01], [35, 39]]] } };
async function invoke(body) {
  calls = [];
  const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ geometry, ...body }) }));
  return { status: response.status, data: await response.json() };
}
test('gerçek çekim tarihleri bulut filtresiyle ve tekrarsız listelenir; görüntü üretmez', async () => {
  catalogDates = ['2026-08-10', '2026-08-10', '2026-08-12', '2026-08-08'];
  const { data } = await invoke({ listScenes: true, daysBack: 180 });
  assert.deepEqual(data.dates, ['2026-08-10', '2026-08-08']);
  assert.equal(calls.filter(c => c.url.includes('/process/') || c.url.includes('/statistics/')).length, 0);
});
test('seçilen tarih görüntü ve istatistik için aynı gün aralığına bağlanır', async () => {
  catalogDates = ['2026-08-10'];
  const { data } = await invoke({ imageDate: '2026-08-10' });
  assert.equal(data.success, true);
  assert.equal(data.latestImageDate, '2026-08-10');
  const range = { from: '2026-08-10T00:00:00Z', to: '2026-08-10T23:59:59Z' };
  for (const call of calls.filter(c => c.url.includes('/process/'))) assert.deepEqual(call.body.input.data[0].dataFilter.timeRange, range);
  assert.deepEqual(calls.find(c => c.url.includes('/statistics/')).body.aggregation.timeRange, range);
});
test('çekim olmayan günde en yeni görüntüye dönmez; bozuk ve gelecekteki tarihleri reddeder', async () => {
  catalogDates = [];
  assert.equal((await invoke({ imageDate: '2026-08-11' })).data.success, false);
  assert.equal(calls.filter(c => c.url.includes('/process/')).length, 0);
  for (const imageDate of ['2026-02-30', '2100-01-01', 'abc']) {
    assert.equal((await invoke({ imageDate })).status, 400);
    assert.equal(calls.length, 0);
  }
});
