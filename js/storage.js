/**
 * Thin localStorage wrapper. Every read/write is guarded — Safari throws on
 * setItem in private browsing and when the origin's quota is full, and a
 * scorecard that crashes mid-round is worse than one that quietly warns.
 */

const PREFIX = 'discgolf.v1.';

export const KEYS = {
  courses: `${PREFIX}courses`,
  activeRound: `${PREFIX}activeRound`,
  history: `${PREFIX}history`,
  prefs: `${PREFIX}prefs`,
};

let writeFailed = false;

export function isAvailable() {
  try {
    const probe = `${PREFIX}__probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (err) {
    console.warn(`[storage] could not read ${key}`, err);
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    writeFailed = false;
    return true;
  } catch (err) {
    console.error(`[storage] could not write ${key}`, err);
    if (!writeFailed) {
      writeFailed = true;
      document.dispatchEvent(new CustomEvent('storage-error', {
        detail: 'Could not save — storage is full or unavailable.',
      }));
    }
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[storage] could not remove ${key}`, err);
    return false;
  }
}
