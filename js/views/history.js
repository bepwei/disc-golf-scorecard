import { state, getHistoricRound, deleteHistoricRound } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, card, button, go, toast, confirmAction, empty, formatDate } from '../ui.js';
import { standingsList, scorecardGrid, stravaCard } from './shared.js';

export function historyView() {
  return screen({ title: 'Round history', back: '#/' },
    state.history.length
      ? h('div', { class: 'stack' }, state.history.map(historyRow))
      : empty('No finished rounds yet. Rounds land here when you save them from the summary screen.'));
}

function historyRow(round) {
  const me = scoring.findMe(round.players);
  const mine = scoring.standing(me, round.scores[me.id], round.pars);

  return h('button', {
    class: 'card card--tappable',
    type: 'button',
    onClick: () => go(`/history/${round.id}`),
  },
    h('div', { class: 'row row--between' },
      h('div', { class: 'row__text' },
        h('h2', { class: 'card__title' }, round.courseName),
        h('p', { class: 'card__meta' },
          formatDate(round.completedAt || round.startedAt),
          ' · ',
          `${round.players.length} player${round.players.length === 1 ? '' : 's'}`)),
      h('span', { class: 'card__score' },
        h('strong', {}, String(mine.strokes)),
        h('span', { class: `rel rel--${mine.relToPar > 0 ? 'over' : mine.relToPar < 0 ? 'under' : 'even'}` },
          scoring.formatRelToPar(mine.relToPar)))));
}

export function historyDetailView(roundId) {
  const round = getHistoricRound(roundId);
  if (!round) {
    return screen({ title: 'Round', back: '#/history' },
      empty('That round is no longer saved.',
        button('Back to history', { variant: 'primary', onClick: () => go('/history') })));
  }

  return screen({
    title: round.courseName,
    subtitle: formatDate(round.completedAt || round.startedAt),
    back: '#/history',
  },
    stravaCard(round),

    card(
      h('h2', { class: 'card__title' }, 'Standings'),
      standingsList(round)),

    card(
      h('h2', { class: 'card__title' }, 'Scorecard'),
      scorecardGrid(round)),

    card(button('Delete round', {
      variant: 'danger-ghost',
      onClick: () => {
        if (!confirmAction('Delete this round from your history?')) return;
        deleteHistoricRound(round.id);
        toast('Round deleted');
        go('/history');
      },
    })));
}
