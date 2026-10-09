export const TRIAGE_STORAGE_KEY = 'incident-explorer.triage.v1';
const services = new Set(['Accounts', 'Billing', 'Search', 'Uploads', 'Notifications', 'Integrations']);
const statuses = new Set(['open', 'in_progress', 'resolved']);
const severities = new Set(['critical', 'high', 'medium', 'low']);

function validEntry(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && /^INC-[0-9]{6}$/.test(value.id)
    && typeof value.title === 'string' && value.title.length <= 500
    && services.has(value.service) && statuses.has(value.status) && severities.has(value.severity)
    && typeof value.openedAt === 'string' && Number.isFinite(Date.parse(value.openedAt))
    && typeof value.note === 'string';
}

export function readTriage(storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(TRIAGE_STORAGE_KEY);
    if (raw === null) return {entries: [], message: ''};
    const stored = JSON.parse(raw);
    if (!stored || stored.version !== 1 || !Array.isArray(stored.entries) || !stored.entries.every(validEntry)
      || new Set(stored.entries.map(entry => entry.id)).size !== stored.entries.length) {
      return {entries: [], message: 'Saved triage data is malformed. Your current triage list will still work in this visit.'};
    }
    return {entries: stored.entries.map(entry => ({...entry})), message: ''};
  } catch {
    return {entries: [], message: 'Browser storage is unavailable. Your triage list will last only for this visit.'};
  }
}

export function writeTriage(entries, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify({version: 1, entries}));
    return true;
  } catch { return false; }
}

export function addTriage(entries, incident) {
  if (entries.some(entry => entry.id === incident.id)) return entries;
  const entry = {id: incident.id, title: incident.title, service: incident.service, severity: incident.severity, status: incident.status, openedAt: incident.openedAt, note: ''};
  return validEntry(entry) ? [...entries, entry] : entries;
}

export function updateTriageNote(entries, id, note) {
  if (typeof note !== 'string') return entries;
  let changed = false;
  const next = entries.map(entry => {
    if (entry.id !== id || entry.note === note) return entry;
    changed = true;
    return {...entry, note};
  });
  return changed ? next : entries;
}

export function removeTriage(entries, id) {
  const next = entries.filter(entry => entry.id !== id);
  return next.length === entries.length ? entries : next;
}
