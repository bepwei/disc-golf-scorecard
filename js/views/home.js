import { state } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, card, button, go, formatDate } from '../ui.js';

export function homeView() {
  const round = state.activeRound;

  return screen({ title: 'Disc Golf', subtitle: 'Scorecard' },
    round ? resumeCard(round) : null,

    h('div', { class: 'stack' },
      button(round ? 'Start a different round' : 'Start a round', {
        variant: round ? 'secondary' : 'primary',
        onClick: () => go('/round/new'),
      }),
      button(`Courses${state.courses.length ? ` (${state.courses.length})` : ''}`, {
        onClick: () => go('/courses'),
      }),
      button(`Round history${state.history.length ? ` (${state.history.length})` : ''}`, {
        onClick: () => go('/history'),
      })),

    !state.courses.length && !round
      ? h('p', { class: 'hint hint--center' },
          'Add a course first — enter its name and the par for each hole, then it is saved for every future round.')
      : null);
}

function resumeCard(round) {
  const me = scoring.findMe(round.players);
  const board = scoring.leaderboard(round.players, round.scores, round.pars);
  const mine = board.find((row) => row.playerId === me?.id);
  const thru = Math.max(...board.map((row) => row.thru), 0);
  const done = !!round.completedAt;

  return card(
    h('p', { class: 'card__eyebrow' }, done ? 'Round complete' : 'Round in progress'),
    h('h2', { class: 'card__title' }, round.courseName),
    h('p', { class: 'card__meta' },
      done ? `Finished ${formatDate(round.completedAt)}` : `Through ${thru} of ${round.pars.length}`,
      ' · ',
      `${round.players.length} player${round.players.length === 1 ? '' : 's'}`),
    mine
      ? h('p', { class: 'card__score' },
          h('strong', {}, String(mine.strokes)),
          h('span', { class: `rel rel--${mine.relToPar > 0 ? 'over' : mine.relToPar < 0 ? 'under' : 'even'}` },
            scoring.formatRelToPar(mine.relToPar)))
      : null,
    button(done ? 'View summary' : 'Resume round', {
      variant: 'primary',
      onClick: () => go(done ? '/summary' : '/play'),
    }));
}
