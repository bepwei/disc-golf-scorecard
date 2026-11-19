import { state, reopenRound, archiveRound, discardRound } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, card, button, go, toast, confirmAction, empty } from '../ui.js';
import { standingsList, scorecardGrid, stravaCard } from './shared.js';

export function summaryView() {
  const round = state.activeRound;
  if (!round) {
    return screen({ title: 'Summary', back: '#/' },
      empty('No round to summarise.',
        button('Start a round', { variant: 'primary', onClick: () => go('/round/new') })));
  }

  const me = scoring.findMe(round.players);
  const mine = scoring.standing(me, round.scores[me.id], round.pars);

  return screen({
    title: 'Round complete',
    subtitle: round.courseName,
    back: '#/',
    footer: button('Save to history', {
      variant: 'primary',
      onClick: () => {
        const saved = archiveRound();
        toast('Round saved');
        go(saved ? `/history/${saved.id}` : '/history');
      },
    }),
  },
    card(
      h('p', { class: 'card__eyebrow' }, me.name),
      h('div', { class: 'hero' },
        h('span', { class: 'hero__strokes' }, String(mine.strokes)),
        h('span', { class: `rel rel--xl rel--${mine.relToPar > 0 ? 'over' : mine.relToPar < 0 ? 'under' : 'even'}` },
          scoring.formatRelToPar(mine.relToPar))),
      h('p', { class: 'card__meta' },
        `${round.courseName} · par ${scoring.totalPar(round.pars)} · ${mine.thru} of ${round.pars.length} holes scored`,
        mine.handicap ? ` · handicap ${scoring.formatRelToPar(mine.handicap)} → ${mine.adjustedStrokes}` : null)),

    stravaCard(round),

    card(
      h('h2', { class: 'card__title' }, 'Final standings'),
      standingsList(round)),

    card(
      h('h2', { class: 'card__title' }, 'Scorecard'),
      scorecardGrid(round)),

    card(
      button('Back to scoring', {
        onClick: () => { reopenRound(); go('/play'); },
      }),
      h('div', { class: 'spacer' }),
      button('Discard round', {
        variant: 'danger-ghost',
        onClick: () => {
          if (!confirmAction('Discard this round without saving it to history?')) return;
          discardRound();
          toast('Round discarded');
          go('/');
        },
      })));
}
