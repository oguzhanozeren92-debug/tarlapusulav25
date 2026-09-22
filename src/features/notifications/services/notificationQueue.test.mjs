import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistHomeNotifications } from './notificationQueue.ts';

test('süresi dolan saatlik ilaçlama bildirimleri listede kalmaz', () => {
  const stored = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    dispatchEvent: () => {},
  };
  const fieldId = 'bahadirlar-arpa';
  const notification = {
    id: `weather:${fieldId}:spray-window:123`,
    source: 'weather', priority: 83, severity: 'info',
    title: 'İlaçlama için hava aralığı yaklaşıyor', detail: '09:00–11:00',
    iconKey: 'leaf', target: 'spray_weather',
  };

  try {
    persistHomeNotifications({ fieldId, fieldName: 'Bahadırlar-arpa', notifications: [notification] });
    assert.equal(JSON.parse(stored.get('tp_system_notifications_v1')).length, 1);
    persistHomeNotifications({ fieldId, fieldName: 'Bahadırlar-arpa', notifications: [] });
    assert.deepEqual(JSON.parse(stored.get('tp_system_notifications_v1')), []);
  } finally {
    globalThis.window = previousWindow;
  }
});
