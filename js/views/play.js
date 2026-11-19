import { state, setScore, setCurrentHole, finishRound, discardRound, MIN_STROKES, MAX_STROKES } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, button, go, toast, confirmAction, empty } from '../ui.js';
import { standingsList } from './shared.js';

/** @param {'hole'|'grid'|'board'} mode */
export function playView(mode) {
  const round = state.activeRound;
  if (!round) {
    return screen({ title: 'Round', back: '#/' },
      empty('No round in progress.',
        button('Start a round', { variant: 'primary', onClick: () => go('/round/new') })));
  }

  const body = mode === 'grid' ? gridPanel(round)
    : mode === 'board' ? boardPanel(round)
    : holePanel(round);

  return screen({
    title: round.courseName,
    subtitle: `${round.players.length} player${round.players.length === 1 ? '' : 's'} · par ${scoring.totalPar(round.pars)}`,
    back: '#/',
    actions: button('Finish', { variant: 'ghost', onClick: () => tryFinish(round) }),
    footer: body.footer,
  },
    tabs(mode),
    body.content);
}

function tabs(active) {
  const items = [
    ['hole', 'Holes', '/play'],
    ['grid', 'Card', '/play/grid'],
    ['board', 'Standings', '/play/board'],
  ];
  return h('nav', { class: 'tabs', role: 'tablist' },
    items.map(([key, label, path]) => h('button', {
      class: `tabs__btn${key === active ? ' is-active' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(key === active),
      onClick: () => go(path),
    }, label)));
}

function tryFinish(round) {
  const remaining = round.players.reduce((n, p) => n + round.pars.length - scoring.holesPlayed(round.scores[p.id]), 0);
  if (remaining > 0 && !confirmAction(
    `${remaining} hole${remaining === 1 ? '' : 's'} still unscored. Finish the round anyway?`)) return;
  finishRound();
  go('/summary');
}

/* ------------------------------------------------------------- hole-by-hole */

function holePanel(round) {
  const holeCount = round.pars.length;
  let hole = round.currentHole;

  const holeTitle = h('h2', { class: 'hole__number' });
  const holePar = h('p', { class: 'hole__par' });
  const pillStrip = h('div', { class: 'pills' });
  const cardList = h('div', { class: 'stack stack--tight' });
  const prevBtn = button('‹ Prev', { onClick: () => moveTo(hole - 1) });
  const nextBtn = button('', { variant: 'primary', onClick: () => {
    if (hole === holeCount - 1) tryFinish(round);
    else moveTo(hole + 1);
  } });

  function moveTo(index) {
    hole = Math.min(holeCount - 1, Math.max(0, index));
    setCurrentHole(hole);
    drawHole();
  }

  function drawHole() {
    holeTitle.textContent = `Hole ${hole + 1}`;
    holePar.textContent = `Par ${round.pars[hole]} · hole ${hole + 1} of ${holeCount}`;
    prevBtn.disabled = hole === 0;
    nextBtn.textContent = hole === holeCount - 1 ? 'Finish round' : 'Next ›';
    cardList.replaceChildren(...round.players.map((player) => playerScoreCard(round, player, hole, drawPills)));
    drawPills();
  }

  function drawPills() {
    pillStrip.replaceChildren(...round.pars.map((_, i) => {
      const allScored = round.players.every((p) => scoring.isScored(round.scores[p.id][i]));
      const anyScored = round.players.some((p) => scoring.isScored(round.scores[p.id][i]));
      const status = allScored ? 'full' : anyScored ? 'part' : 'empty';
      return h('button', {
        class: `pill pill--${status}${i === hole ? ' is-current' : ''}`,
        type: 'button', 'aria-label': `Go to hole ${i + 1}`,
        onClick: () => moveTo(i),
      }, String(i + 1));
    }));
    pillStrip.children[hole]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  drawHole();

  return {
    content: h('div', { class: 'hole' },
      h('div', { class: 'hole__head' }, holeTitle, holePar),
      pillStrip,
      cardList),
    footer: h('div', { class: 'row row--nav' }, prevBtn, nextBtn),
  };
}

function playerScoreCard(round, player, hole, onScoreChange) {
  const par = round.pars[hole];
  const scores = round.scores[player.id];

  const valueNode = h('button', {
    class: 'stepper__value stepper__value--tap',
    type: 'button',
    'aria-label': `Score for ${player.name} on hole ${hole + 1}`,
    onClick: () => { if (!scoring.isScored(scores[hole])) apply(par); },
  });
  const totalNode = h('span', { class: 'score-card__total' });
  const relNode = h('span', { class: 'rel' });

  function apply(next) {
    setScore(player.id, hole, Math.min(MAX_STROKES, Math.max(MIN_STROKES, next)));
    paint();
    onScoreChange();
  }

  function step(delta) {
    const current = scores[hole];
    apply(scoring.isScored(current) ? current + delta : par + delta);
  }

  function paint() {
    const current = scores[hole];
    const scored = scoring.isScored(current);
    const shown = scored ? current : par;
    valueNode.textContent = String(shown);
    valueNode.classList.toggle('is-ghost', !scored);
    valueNode.dataset.result = scored ? scoring.holeResult(current, par) : 'none';

    const s = scoring.standing(player, scores, round.pars);
    totalNode.textContent = s.thru ? `${s.strokes} thru ${s.thru}` : 'No scores yet';
    relNode.textContent = scoring.formatRelToPar(s.relToPar);
    relNode.className = `rel rel--${s.relToPar > 0 ? 'over' : s.relToPar < 0 ? 'under' : 'even'}`;
  }

  paint();

  return h('div', { class: 'score-card' },
    h('div', { class: 'score-card__head' },
      h('span', { class: 'score-card__name' },
        player.name,
        player.isMe ? h('span', { class: 'chip chip--me', title: 'This is you' }, '★') : null,
        player.handicap ? h('span', { class: 'chip' }, scoring.formatRelToPar(player.handicap)) : null),
      h('span', { class: 'score-card__meta' }, totalNode, relNode)),
    h('div', { class: 'stepper' },
      h('button', {
        class: 'stepper__btn', type: 'button',
        'aria-label': `One fewer stroke for ${player.name}`,
        onClick: () => step(-1),
      }, '−'),
      valueNode,
      h('button', {
        class: 'stepper__btn', type: 'button',
        'aria-label': `One more stroke for ${player.name}`,
        onClick: () => step(1),
      }, '+')));
}

/* -------------------------------------------------------------- grid / card */

function gridPanel(round) {
  const totalCells = new Map();
  const relCells = new Map();

  function repaintTotals() {
    for (const player of round.players) {
      const s = scoring.standing(player, round.scores[player.id], round.pars);
      totalCells.get(player.id).textContent = String(s.strokes);
      const rel = relCells.get(player.id);
      rel.textContent = scoring.formatRelToPar(s.relToPar);
      rel.className = `rel rel--${s.relToPar > 0 ? 'over' : s.relToPar < 0 ? 'under' : 'even'}`;
    }
  }

  const head = h('thead', {},
    h('tr', {},
      h('th', { class: 'grid__corner', scope: 'col' }, 'Hole'),
      round.players.map((p) => h('th', { scope: 'col' },
        h('span', { class: 'grid__name' }, p.name),
        p.isMe ? h('span', { class: 'chip chip--me' }, '★') : null))));

  const rows = round.pars.map((par, i) => h('tr', {},
    h('th', { class: 'grid__hole', scope: 'row' },
      h('span', { class: 'grid__hole-num' }, String(i + 1)),
      h('span', { class: 'grid__hole-par' }, `par ${par}`)),
    round.players.map((player) => {
      const current = round.scores[player.id][i];
      const input = h('input', {
        class: 'grid__input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*',
        maxLength: 2, value: scoring.isScored(current) ? String(current) : '',
        'aria-label': `${player.name}, hole ${i + 1}`,
        onFocus: (e) => e.target.select(),
        onInput: (e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          e.target.value = raw;
          const parsed = Number.parseInt(raw, 10);
          const next = Number.isFinite(parsed) && parsed > 0
            ? Math.min(MAX_STROKES, parsed)
            : null;
          setScore(player.id, i, next);
          e.target.dataset.result = next === null ? 'none' : scoring.holeResult(next, par);
          repaintTotals();
        },
        onBlur: (e) => {
          const stored = round.scores[player.id][i];
          e.target.value = scoring.isScored(stored) ? String(stored) : '';
        },
      });
      input.dataset.result = scoring.isScored(current) ? scoring.holeResult(current, par) : 'none';
      return h('td', {}, input);
    })));

  const foot = h('tfoot', {},
    h('tr', {},
      h('th', { class: 'grid__hole', scope: 'row' }, 'Total'),
      round.players.map((p) => {
        const node = h('span', { class: 'grid__total' });
        totalCells.set(p.id, node);
        return h('td', {}, node);
      })),
    h('tr', {},
      h('th', { class: 'grid__hole', scope: 'row' }, 'To par'),
      round.players.map((p) => {
        const node = h('span', { class: 'rel' });
        relCells.set(p.id, node);
        return h('td', {}, node);
      })));

  const table = h('table', { class: 'grid' }, head, h('tbody', {}, rows), foot);
  repaintTotals();

  return {
    content: h('div', {},
      h('p', { class: 'hint' }, 'Tap any cell to type a score. Clear a cell to mark the hole unplayed.'),
      h('div', { class: 'grid-wrap' }, table)),
    footer: h('div', { class: 'row row--nav' },
      button('Back to holes', { onClick: () => go('/play') }),
      button('Finish round', { variant: 'primary', onClick: () => tryFinish(round) })),
  };
}

/* ------------------------------------------------------------- leaderboard */

function boardPanel(round) {
  return {
    content: h('div', {},
      standingsList(round),
      h('p', { class: 'hint' },
        'Sorted by handicap-adjusted score against the par of the holes played so far.')),
    footer: h('div', { class: 'row row--nav' },
      button('Back to holes', { onClick: () => go('/play') }),
      button('Finish round', { variant: 'primary', onClick: () => tryFinish(round) })),
  };
}

export function discardActiveRound() {
  if (!confirmAction('Discard this round? Scores entered so far are lost.')) return;
  discardRound();
  toast('Round discarded');
  go('/');
}
