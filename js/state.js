/**
 * App state and all mutations. Every change writes straight through to
 * localStorage so quitting Safari mid-round loses nothing.
 *
 * Shapes
 *   Course  { id, name, pars: number[], createdAt, updatedAt }
 *   Player  { id, name, handicap: number, isMe: boolean }
 *   Round   { id, courseId, courseName, pars: number[],   // pars snapshotted
 *             players: Player[], scores: { [playerId]: (number|null)[] },
 *             currentHole: number,                        // 0-indexed
 *             startedAt, completedAt: number|null }
 *
 * `pars` is copied into the round on purpose: editing or deleting a course
 * later must not rewrite the history of rounds already played on it.
 */

import * as storage from './storage.js';

export const MIN_STROKES = 1;
export const MAX_STROKES = 30;
export const MIN_PAR = 2;
export const MAX_PAR = 7;
export const DEFAULT_PAR = 3;
export const MAX_HISTORY = 200;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* ---------------------------------------------------------- load + sanitise */

function sanitiseCourse(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pars = Array.isArray(raw.pars)
    ? raw.pars.map((p) => clamp(Math.round(Number(p)) || DEFAULT_PAR, MIN_PAR, MAX_PAR))
    : [];
  if (pars.length !== 9 && pars.length !== 18) return null;
  return {
    id: String(raw.id || uid('course')),
    name: String(raw.name || 'Unnamed course').slice(0, 60),
    pars,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now(),
  };
}

function sanitiseRound(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pars = Array.isArray(raw.pars) ? raw.pars.map((p) => Number(p) || DEFAULT_PAR) : [];
  const players = Array.isArray(raw.players) ? raw.players : [];
  if (!pars.length || !players.length) return null;

  const cleanPlayers = players.map((p, i) => ({
    id: String(p.id || uid('player')),
    name: String(p.name || `Player ${i + 1}`).slice(0, 30),
    handicap: Math.round(Number(p.handicap)) || 0,
    isMe: !!p.isMe,
  }));
  if (!cleanPlayers.some((p) => p.isMe)) cleanPlayers[0].isMe = true;

  const scores = {};
  for (const p of cleanPlayers) {
    const row = Array.isArray(raw.scores?.[p.id]) ? raw.scores[p.id] : [];
    scores[p.id] = pars.map((_, i) => {
      const v = Math.round(Number(row[i]));
      return Number.isFinite(v) && v > 0 ? clamp(v, MIN_STROKES, MAX_STROKES) : null;
    });
  }

  return {
    id: String(raw.id || uid('round')),
    courseId: raw.courseId ? String(raw.courseId) : null,
    courseName: String(raw.courseName || 'Course').slice(0, 60),
    pars,
    players: cleanPlayers,
    scores,
    currentHole: clamp(Math.round(Number(raw.currentHole)) || 0, 0, pars.length - 1),
    startedAt: Number(raw.startedAt) || Date.now(),
    completedAt: Number(raw.completedAt) || null,
  };
}

export const state = {
  courses: storage.load(storage.KEYS.courses, []).map(sanitiseCourse).filter(Boolean),
  activeRound: sanitiseRound(storage.load(storage.KEYS.activeRound, null)),
  history: storage.load(storage.KEYS.history, []).map(sanitiseRound).filter(Boolean),
  prefs: { myName: '', ...storage.load(storage.KEYS.prefs, {}) },
};

/* ------------------------------------------------------------- persistence */

const persist = {
  courses: () => storage.save(storage.KEYS.courses, state.courses),
  history: () => storage.save(storage.KEYS.history, state.history),
  prefs: () => storage.save(storage.KEYS.prefs, state.prefs),
  activeRound: () => (state.activeRound
    ? storage.save(storage.KEYS.activeRound, state.activeRound)
    : storage.remove(storage.KEYS.activeRound)),
};

/* ----------------------------------------------------------------- courses */

export function getCourse(id) {
  return state.courses.find((c) => c.id === id) || null;
}

export function saveCourse({ id, name, pars }) {
  const clean = {
    id: id || uid('course'),
    name: name.trim() || 'Unnamed course',
    pars: pars.map((p) => clamp(Math.round(Number(p)) || DEFAULT_PAR, MIN_PAR, MAX_PAR)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const existing = state.courses.findIndex((c) => c.id === clean.id);
  if (existing >= 0) {
    clean.createdAt = state.courses[existing].createdAt;
    state.courses[existing] = clean;
  } else {
    state.courses.push(clean);
  }
  state.courses.sort((a, b) => a.name.localeCompare(b.name));
  persist.courses();
  return clean;
}

export function deleteCourse(id) {
  state.courses = state.courses.filter((c) => c.id !== id);
  persist.courses();
}

/* ------------------------------------------------------------------ rounds */

export function startRound({ course, players }) {
  const cleanPlayers = players.map((p, i) => ({
    id: uid('player'),
    name: p.name.trim() || `Player ${i + 1}`,
    handicap: Math.round(Number(p.handicap)) || 0,
    isMe: !!p.isMe,
  }));
  if (!cleanPlayers.some((p) => p.isMe)) cleanPlayers[0].isMe = true;

  const scores = {};
  for (const p of cleanPlayers) scores[p.id] = course.pars.map(() => null);

  state.activeRound = {
    id: uid('round'),
    courseId: course.id,
    courseName: course.name,
    pars: [...course.pars],
    players: cleanPlayers,
    scores,
    currentHole: 0,
    startedAt: Date.now(),
    completedAt: null,
  };
  persist.activeRound();

  const me = cleanPlayers.find((p) => p.isMe);
  if (me && me.name !== state.prefs.myName) {
    state.prefs.myName = me.name;
    persist.prefs();
  }
  return state.activeRound;
}

export function setScore(playerId, holeIndex, strokes) {
  const round = state.activeRound;
  if (!round || !round.scores[playerId]) return;
  round.scores[playerId][holeIndex] = strokes === null
    ? null
    : clamp(Math.round(strokes), MIN_STROKES, MAX_STROKES);
  persist.activeRound();
}

export function setCurrentHole(holeIndex) {
  const round = state.activeRound;
  if (!round) return;
  round.currentHole = clamp(holeIndex, 0, round.pars.length - 1);
  persist.activeRound();
}

/** Mark complete. The round stays "active" so scores can still be corrected. */
export function finishRound() {
  if (!state.activeRound) return;
  state.activeRound.completedAt = Date.now();
  persist.activeRound();
}

export function reopenRound() {
  if (!state.activeRound) return;
  state.activeRound.completedAt = null;
  persist.activeRound();
}

/** Move the finished round into history and clear the active slot. */
export function archiveRound() {
  const round = state.activeRound;
  if (!round) return null;
  if (!round.completedAt) round.completedAt = Date.now();
  state.history = [round, ...state.history.filter((r) => r.id !== round.id)]
    .slice(0, MAX_HISTORY);
  state.activeRound = null;
  persist.history();
  persist.activeRound();
  return round;
}

export function discardRound() {
  state.activeRound = null;
  persist.activeRound();
}

export function getHistoricRound(id) {
  return state.history.find((r) => r.id === id) || null;
}

export function deleteHistoricRound(id) {
  state.history = state.history.filter((r) => r.id !== id);
  persist.history();
}
