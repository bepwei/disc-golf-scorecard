/**
 * Pure scoring math — no DOM, no storage.
 *
 * Everything the app needs to turn "strokes per hole" into totals, +/- to par
 * and a sorted leaderboard lives here so it can be unit tested under node
 * (see test/scoring.test.js).
 *
 * Conventions:
 *   - A hole with no score yet is `null`. Unscored holes never count toward
 *     strokes *or* par, so +/- always reflects only the holes actually played.
 *   - `handicap` is a signed integer applied to a player's round total.
 *     Positive adds strokes, negative removes them.
 */

export function isScored(strokes) {
  return typeof strokes === 'number' && Number.isFinite(strokes) && strokes > 0;
}

/** Sum of strokes actually entered. */
export function totalStrokes(scores) {
  let sum = 0;
  for (const s of scores) if (isScored(s)) sum += s;
  return sum;
}

/** How many holes have a score entered. */
export function holesPlayed(scores) {
  let n = 0;
  for (const s of scores) if (isScored(s)) n += 1;
  return n;
}

/** Par for only the holes that have a score entered. */
export function parThrough(pars, scores) {
  let sum = 0;
  for (let i = 0; i < pars.length; i += 1) if (isScored(scores[i])) sum += pars[i];
  return sum;
}

export function totalPar(pars) {
  let sum = 0;
  for (const p of pars) sum += p;
  return sum;
}

/** Everything worth knowing about one player's round so far. */
export function standing(player, scores = [], pars = []) {
  const strokes = totalStrokes(scores);
  const thru = holesPlayed(scores);
  const parThru = parThrough(pars, scores);
  const handicap = Number(player.handicap) || 0;
  return {
    playerId: player.id,
    name: player.name,
    isMe: !!player.isMe,
    handicap,
    strokes,
    thru,
    parThru,
    relToPar: strokes - parThru,
    adjustedStrokes: strokes + handicap,
    adjustedRelToPar: strokes + handicap - parThru,
    complete: pars.length > 0 && thru === pars.length,
  };
}

/**
 * Standings sorted best-first by handicap-adjusted score relative to par.
 * Ties share a position and are flagged with `tied`.
 */
export function leaderboard(players, scoresByPlayer = {}, pars = []) {
  const rows = players.map((p) => standing(p, scoresByPlayer[p.id] || [], pars));

  rows.sort((a, b) => (
    a.adjustedRelToPar - b.adjustedRelToPar ||
    a.adjustedStrokes - b.adjustedStrokes ||
    b.thru - a.thru ||
    a.name.localeCompare(b.name)
  ));

  let position = 0;
  rows.forEach((row, i) => {
    if (i === 0 || row.adjustedRelToPar !== rows[i - 1].adjustedRelToPar) position = i + 1;
    row.position = position;
  });
  rows.forEach((row) => {
    row.tied = rows.filter((other) => other.position === row.position).length > 1;
  });

  return rows;
}

/** 0 -> "E", 3 -> "+3", -2 -> "-2". */
export function formatRelToPar(diff) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

/** Classification of a single hole, used for the score colours. */
export function holeResult(strokes, par) {
  if (!isScored(strokes)) return 'none';
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
}

export const HOLE_RESULT_LABELS = {
  eagle: 'Eagle or better',
  birdie: 'Birdie',
  par: 'Par',
  bogey: 'Bogey',
  double: 'Double bogey +',
};

/**
 * Strava activity description, e.g. "Bicentennial Park — 54 (-3)".
 * Uses raw strokes, not the handicap-adjusted total — Strava should reflect
 * what you actually threw.
 */
export function stravaDescription({ courseName, strokes, relToPar }) {
  return `${courseName} — ${strokes} (${formatRelToPar(relToPar)})`;
}

/** The player marked as "me", falling back to the first player. */
export function findMe(players = []) {
  return players.find((p) => p.isMe) || players[0] || null;
}
