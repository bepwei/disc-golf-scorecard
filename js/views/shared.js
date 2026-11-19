/** Pieces shared by the in-round, summary and history screens. */

import * as scoring from '../scoring.js';
import { h, card, button, toast, copyText, selectContents } from '../ui.js';

function relClass(diff, extra = '') {
  const dir = diff > 0 ? 'over' : diff < 0 ? 'under' : 'even';
  return `rel ${extra} rel--${dir}`.replace(/\s+/g, ' ').trim();
}

/** Sorted standings, handicap-adjusted. */
export function standingsList(round, { showHandicap = true } = {}) {
  const board = scoring.leaderboard(round.players, round.scores, round.pars);
  return h('ol', { class: 'board' },
    board.map((row) => h('li', { class: `board__row${row.isMe ? ' is-me' : ''}` },
      h('span', { class: 'board__pos' }, `${row.tied ? 'T' : ''}${row.position}`),
      h('span', { class: 'board__main' },
        h('span', { class: 'board__name' },
          row.name,
          row.isMe ? h('span', { class: 'chip chip--me', title: 'This is you' }, '★') : null),
        h('span', { class: 'board__meta' },
          row.thru === round.pars.length ? 'Final' : `Thru ${row.thru}`,
          showHandicap && row.handicap
            ? ` · handicap ${scoring.formatRelToPar(row.handicap)}`
            : null)),
      h('span', { class: 'board__scores' },
        h('span', { class: relClass(row.adjustedRelToPar, 'rel--lg') },
          scoring.formatRelToPar(row.adjustedRelToPar)),
        h('span', { class: 'board__strokes' },
          row.handicap ? `${row.strokes} → ${row.adjustedStrokes}` : String(row.strokes))))));
}

/** Read-only scorecard grid. */
export function scorecardGrid(round) {
  const table = h('table', { class: 'grid grid--readonly' },
    h('thead', {},
      h('tr', {},
        h('th', { class: 'grid__corner', scope: 'col' }, 'Hole'),
        round.players.map((p) => h('th', { scope: 'col' },
          h('span', { class: 'grid__name' }, p.name),
          p.isMe ? h('span', { class: 'chip chip--me' }, '★') : null)))),
    h('tbody', {},
      round.pars.map((par, i) => h('tr', {},
        h('th', { class: 'grid__hole', scope: 'row' },
          h('span', { class: 'grid__hole-num' }, String(i + 1)),
          h('span', { class: 'grid__hole-par' }, `par ${par}`)),
        round.players.map((player) => {
          const value = round.scores[player.id][i];
          const scored = scoring.isScored(value);
          const cell = h('span', { class: 'grid__cell' }, scored ? String(value) : '–');
          cell.dataset.result = scored ? scoring.holeResult(value, par) : 'none';
          return h('td', {}, cell);
        })))),
    h('tfoot', {},
      h('tr', {},
        h('th', { class: 'grid__hole', scope: 'row' }, 'Total'),
        round.players.map((p) => h('td', {},
          h('span', { class: 'grid__total' },
            String(scoring.totalStrokes(round.scores[p.id])))))),
      h('tr', {},
        h('th', { class: 'grid__hole', scope: 'row' }, 'To par'),
        round.players.map((p) => {
          const s = scoring.standing(p, round.scores[p.id], round.pars);
          return h('td', {}, h('span', { class: relClass(s.relToPar) },
            scoring.formatRelToPar(s.relToPar)));
        }))));

  return h('div', { class: 'grid-wrap' }, table);
}

/** The Strava description for the starred player, plus a one-tap copy button. */
export function stravaCard(round) {
  const me = scoring.findMe(round.players);
  const stats = scoring.standing(me, round.scores[me.id], round.pars);
  const text = scoring.stravaDescription({
    courseName: round.courseName,
    strokes: stats.strokes,
    relToPar: stats.relToPar,
  });

  const textNode = h('p', { class: 'strava' }, text);

  const copyBtn = button('Copy to clipboard', {
    variant: 'primary',
    onClick: async () => {
      if (await copyText(text)) {
        toast('Copied — paste into Strava');
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1800);
        return;
      }
      // Clipboard blocked: select it so iOS's own Copy button is one tap away.
      selectContents(textNode);
      toast('Selected — tap Copy');
    },
  });

  return card(
    h('p', { class: 'card__eyebrow' }, 'Strava description'),
    textNode,
    h('p', { class: 'hint' },
      `${me.name}'s strokes, before any handicap adjustment.`,
      stats.thru < round.pars.length ? ` Only ${stats.thru} of ${round.pars.length} holes scored.` : null),
    copyBtn);
}
