/**
 * Scoring math. Run with:  node --test
 *
 * scoring.js is deliberately DOM-free so the numbers that matter can be
 * checked here rather than by squinting at the UI.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as scoring from '../js/scoring.js';

const PAR_18 = [3, 3, 4, 3, 3, 5, 3, 4, 3, 3, 3, 4, 3, 3, 4, 3, 3, 3]; // par 60
const PAR_9 = [3, 3, 4, 3, 3, 5, 3, 4, 3];                              // par 31

const player = (id, name, handicap = 0, isMe = false) => ({ id, name, handicap, isMe });

test('totalPar sums the card', () => {
  assert.equal(scoring.totalPar(PAR_18), 60);
  assert.equal(scoring.totalPar(PAR_9), 31);
});

test('unscored holes count toward neither strokes nor par', () => {
  const scores = [3, 4, null, 3, null, null, null, null, null];
  assert.equal(scoring.totalStrokes(scores), 10);
  assert.equal(scoring.holesPlayed(scores), 3);
  // pars for holes 1, 2 and 4 only: 3 + 3 + 3
  assert.equal(scoring.parThrough(PAR_9, scores), 9);
});

test('zero, negative and non-numeric strokes are treated as unscored', () => {
  const scores = [0, -2, 'x', undefined, NaN, 3, null, null, null];
  assert.equal(scoring.totalStrokes(scores), 3);
  assert.equal(scoring.holesPlayed(scores), 1);
  assert.equal(scoring.parThrough(PAR_9, scores), 5); // only hole 6, par 5
});

test('a full round computes strokes and +/- to par', () => {
  //                 3  3  4  3  3  5  3  4  3   -> par 31
  const scores =    [2, 3, 4, 3, 4, 4, 3, 4, 3];  // 30 strokes
  const s = scoring.standing(player('p1', 'Ben'), scores, PAR_9);
  assert.equal(s.strokes, 30);
  assert.equal(s.thru, 9);
  assert.equal(s.parThru, 31);
  assert.equal(s.relToPar, -1);
  assert.equal(s.complete, true);
});

test('mid-round +/- reflects only the holes played', () => {
  const scores = [4, 4, 4, null, null, null, null, null, null]; // par 3,3,4 = 10
  const s = scoring.standing(player('p1', 'Ben'), scores, PAR_9);
  assert.equal(s.strokes, 12);
  assert.equal(s.thru, 3);
  assert.equal(s.relToPar, 2);
  assert.equal(s.complete, false);
});

test('a positive handicap adds strokes, a negative one removes them', () => {
  const scores = [3, 3, 4, 3, 3, 5, 3, 4, 3]; // level par: 31

  const plus = scoring.standing(player('p1', 'Ben', 3), scores, PAR_9);
  assert.equal(plus.strokes, 31);
  assert.equal(plus.relToPar, 0);
  assert.equal(plus.adjustedStrokes, 34);
  assert.equal(plus.adjustedRelToPar, 3);

  const minus = scoring.standing(player('p2', 'Sam', -5), scores, PAR_9);
  assert.equal(minus.adjustedStrokes, 26);
  assert.equal(minus.adjustedRelToPar, -5);
});

test('a missing or malformed handicap is treated as zero', () => {
  const scores = [3, 3, 4, 3, 3, 5, 3, 4, 3];
  for (const handicap of [undefined, null, '', 'abc', NaN]) {
    const s = scoring.standing({ id: 'p', name: 'X', handicap }, scores, PAR_9);
    assert.equal(s.adjustedStrokes, 31, `handicap ${String(handicap)}`);
  }
});

test('leaderboard sorts by handicap-adjusted score', () => {
  const players = [
    player('a', 'Alice', 0),
    player('b', 'Bob', 5),    // plays well but carries +5
    player('c', 'Cass', -4),
  ];
  const scores = {
    a: [3, 3, 4, 3, 3, 5, 3, 4, 3],  // 31, E   -> adjusted E
    b: [2, 3, 4, 3, 3, 4, 3, 4, 3],  // 29, -2  -> adjusted +3
    c: [4, 3, 4, 3, 3, 5, 3, 4, 3],  // 32, +1  -> adjusted -3
  };

  const board = scoring.leaderboard(players, scores, PAR_9);
  assert.deepEqual(board.map((r) => r.name), ['Cass', 'Alice', 'Bob']);
  assert.deepEqual(board.map((r) => r.adjustedRelToPar), [-3, 0, 3]);
  assert.deepEqual(board.map((r) => r.position), [1, 2, 3]);
  // Raw scores are untouched by the handicap.
  assert.equal(board.find((r) => r.name === 'Bob').strokes, 29);
});

test('leaderboard shares a position between tied players', () => {
  const players = [player('a', 'Alice'), player('b', 'Bob'), player('c', 'Cass')];
  const scores = {
    a: [3, 3, 4, 3, 3, 5, 3, 4, 3], // E
    b: [3, 3, 4, 3, 3, 5, 3, 4, 3], // E
    c: [4, 4, 4, 3, 3, 5, 3, 4, 3], // +2
  };
  const board = scoring.leaderboard(players, scores, PAR_9);
  assert.deepEqual(board.map((r) => r.position), [1, 1, 3]);
  assert.deepEqual(board.map((r) => r.tied), [true, true, false]);
});

test('leaderboard handles an untouched round without throwing', () => {
  const players = [player('a', 'Alice'), player('b', 'Bob')];
  const board = scoring.leaderboard(players, { a: [], b: [] }, PAR_18);
  assert.equal(board.length, 2);
  assert.deepEqual(board.map((r) => r.strokes), [0, 0]);
  assert.deepEqual(board.map((r) => r.relToPar), [0, 0]);
  assert.equal(board.every((r) => r.complete === false), true);
});

test('formatRelToPar uses golf notation', () => {
  assert.equal(scoring.formatRelToPar(0), 'E');
  assert.equal(scoring.formatRelToPar(3), '+3');
  assert.equal(scoring.formatRelToPar(-3), '-3');
});

test('holeResult classifies a hole against its par', () => {
  assert.equal(scoring.holeResult(1, 3), 'eagle');
  assert.equal(scoring.holeResult(2, 3), 'birdie');
  assert.equal(scoring.holeResult(3, 3), 'par');
  assert.equal(scoring.holeResult(4, 3), 'bogey');
  assert.equal(scoring.holeResult(6, 3), 'double');
  assert.equal(scoring.holeResult(null, 3), 'none');
});

test('stravaDescription matches the requested format', () => {
  assert.equal(
    scoring.stravaDescription({ courseName: 'Bicentennial Park', strokes: 54, relToPar: -3 }),
    'Bicentennial Park — 54 (-3)',
  );
  assert.equal(
    scoring.stravaDescription({ courseName: 'Bicentennial Park', strokes: 57, relToPar: 0 }),
    'Bicentennial Park — 57 (E)',
  );
  assert.equal(
    scoring.stravaDescription({ courseName: 'Hilltop', strokes: 62, relToPar: 2 }),
    'Hilltop — 62 (+2)',
  );
});

test('the Strava line ignores the handicap — it reports what you actually threw', () => {
  const scores = [3, 3, 4, 3, 3, 5, 3, 4, 3];
  const me = player('me', 'Ben', 6, true);
  const s = scoring.standing(me, scores, PAR_9);
  assert.equal(
    scoring.stravaDescription({ courseName: 'Hilltop', strokes: s.strokes, relToPar: s.relToPar }),
    'Hilltop — 31 (E)',
  );
});

test('findMe prefers the starred player and falls back to the first', () => {
  const a = player('a', 'Alice');
  const b = player('b', 'Bob', 0, true);
  assert.equal(scoring.findMe([a, b]).id, 'b');
  assert.equal(scoring.findMe([a]).id, 'a');
  assert.equal(scoring.findMe([]), null);
});
