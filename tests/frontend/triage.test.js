import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAGE_STORAGE_KEY, readTriage, writeTriage, addTriage, updateTriageNote, removeTriage} from '../../public/triage.js';

const incident = (id, overrides = {}) => ({id, title: `Title ${id}`, service: 'Billing', severity: 'high', status: 'open', openedAt: '2026-04-01T12:00:00.000Z', ...overrides});
const memoryStorage = () => {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values};
};

test('triage preserves ordered unique membership, plain text notes, and removal of the note', () => {
  let entries = [];
  entries = addTriage(entries, incident('INC-000001'));
  entries = addTriage(entries, incident('INC-000002'));
  const afterDuplicate = addTriage(entries, incident('INC-000001', {title: 'Changed title'}));
  assert.equal(afterDuplicate, entries);
  assert.deepEqual(entries.map(entry => entry.id), ['INC-000001', 'INC-000002']);
  const note = '<img src=x onerror=alert(1)> keep punctuation & plain text';
  entries = updateTriageNote(entries, 'INC-000001', note);
  assert.equal(entries[0].note, note);
  assert.deepEqual(removeTriage(entries, 'INC-000001').map(({id, note: text}) => [id, text]), [['INC-000002', '']]);
});

test('versioned browser persistence reloads recognition fields and notes under its own key', () => {
  const storage = memoryStorage();
  let entries = addTriage([], incident('INC-000010'));
  entries = updateTriageNote(entries, 'INC-000010', 'follow up');
  assert.equal(writeTriage(entries, storage), true);
  const stored = JSON.parse(storage.values.get(TRIAGE_STORAGE_KEY));
  assert.equal(stored.version, 1);
  assert.equal(stored.entries[0].note, 'follow up');
  assert.deepEqual(readTriage(storage), {entries, message: ''});
});

test('malformed data and unavailable storage report limitations without preventing this visit state', () => {
  const malformed = memoryStorage();
  malformed.values.set(TRIAGE_STORAGE_KEY, JSON.stringify({version: 1, entries: [incident('INC-000001'), {...incident('INC-000001'), note: 'duplicate'}]}));
  assert.deepEqual(readTriage(malformed), {entries: [], message: 'Saved triage data is malformed. Your current triage list will still work in this visit.'});
  assert.equal(readTriage({getItem() { throw new Error('blocked'); }}).entries.length, 0);
  const unavailable = {setItem() { throw new Error('quota'); }};
  let entries = addTriage([], incident('INC-000003'));
  entries = updateTriageNote(entries, 'INC-000003', 'kept in memory');
  assert.equal(writeTriage(entries, unavailable), false);
  assert.equal(entries[0].note, 'kept in memory');
  assert.deepEqual(addTriage(entries, incident('INC-000004')).map(entry => entry.id), ['INC-000003', 'INC-000004']);
});
