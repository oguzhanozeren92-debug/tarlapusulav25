import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectOperationQuestion } from './operationQuestion.ts';
const now = new Date('2026-09-13T19:00:00');
const reminder = { id: 'r1', fieldId: 'f1', fieldName: 'Dağlık', reminderType: 'Sürme', reminderDate: '2026-09-12', reminderTime: '09:00', completed: false, title: '', notes: null };
const select = (reminders = [reminder], operations = [], prefs = {}) => selectOperationQuestion('f1', reminders, operations, prefs, now);
test('tarihi geçmiş gerçek tarla planından tek soru üretir', () => {
 assert.match(select().title, /sürdün/);
 assert.equal(select([{ ...reminder, fieldId: 'f2' }]), null);
 assert.equal(select([{ ...reminder, reminderDate: '2026-09-14' }]), null);
 assert.equal(select([{ ...reminder, reminderDate: '2026-08-01' }]), null);
 assert.equal(select([{ ...reminder, completed: true }]), null);
});
test('kayıtlı işi ve ertelenmiş soruyu tekrar sormaz', () => {
 assert.equal(select([reminder], [{ fieldId: 'f1', type: 'Sürme', date: '2026-09-12' }]), null);
 assert.equal(select([reminder], [], { [select().key]: now.getTime() + 86400000 }), null);
 assert.ok(select([reminder], [], { [select().key]: now.getTime() - 1 }));
 assert.ok(select([reminder], [{ fieldId: 'f2', type: 'Sürme', date: '2026-09-12' }]));
});
test('bugünkü saat gelmeden, bozuk tarihte veya tanınmayan işlemde soru çıkarmaz', () => {
 assert.equal(select([{ ...reminder, reminderDate: '2026-09-13', reminderTime: '21:00' }]), null);
 assert.equal(select([{ ...reminder, reminderDate: '2026-02-30' }]), null);
 assert.equal(select([{ ...reminder, reminderType: 'Destek başvurusu' }]), null);
});
