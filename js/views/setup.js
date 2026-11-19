import { state, getCourse, startRound } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, card, button, go, toast, confirmAction, empty } from '../ui.js';

const MIN_HANDICAP = -50;
const MAX_HANDICAP = 50;

export function roundSetupView() {
  if (!state.courses.length) {
    return screen({ title: 'New round', back: '#/' },
      empty('You need a course first.',
        button('Add a course', { variant: 'primary', onClick: () => go('/courses/new') })));
  }

  const draft = {
    courseId: state.courses[0].id,
    players: [{ name: state.prefs.myName || '', handicap: 0, isMe: true }],
  };

  const courseSelect = h('select', {
    class: 'input select', id: 'course-select',
    onChange: (e) => { draft.courseId = e.target.value; updateCourseMeta(); },
  }, state.courses.map((c) => h('option', { value: c.id }, c.name)));

  const courseMeta = h('p', { class: 'hint' });
  function updateCourseMeta() {
    const course = getCourse(draft.courseId);
    courseMeta.textContent = course
      ? `${course.pars.length} holes · par ${scoring.totalPar(course.pars)}`
      : '';
  }
  updateCourseMeta();

  const playerList = h('div', { class: 'stack stack--tight' });

  function drawPlayers({ focusLast = false } = {}) {
    playerList.replaceChildren(...draft.players.map(playerRow));
    if (focusLast) playerList.lastElementChild?.querySelector('input[type="text"]')?.focus();
  }

  function playerRow(player, index) {
    const handicapValue = h('span', { class: 'stepper__value' }, formatHandicap(player.handicap));
    const stepHandicap = (delta) => {
      player.handicap = Math.min(MAX_HANDICAP, Math.max(MIN_HANDICAP, player.handicap + delta));
      handicapValue.textContent = formatHandicap(player.handicap);
    };

    const meButton = h('button', {
      class: `star${player.isMe ? ' is-active' : ''}`,
      type: 'button',
      'aria-pressed': String(!!player.isMe),
      'aria-label': `Mark player ${index + 1} as me`,
      title: 'This is me — used for the Strava description',
      onClick: () => {
        draft.players.forEach((p, i) => { p.isMe = i === index; });
        [...playerList.children].forEach((row, i) => {
          const star = row.querySelector('.star');
          star.classList.toggle('is-active', i === index);
          star.setAttribute('aria-pressed', String(i === index));
        });
      },
    }, '★');

    return h('div', { class: 'player-row' },
      h('div', { class: 'player-row__top' },
        meButton,
        h('input', {
          class: 'input player-row__name', type: 'text', value: player.name,
          placeholder: `Player ${index + 1}`, maxLength: 30,
          autocomplete: 'off', enterkeyhint: 'done',
          'aria-label': `Name for player ${index + 1}`,
          onInput: (e) => { player.name = e.target.value; },
        }),
        draft.players.length > 1
          ? h('button', {
              class: 'icon-btn icon-btn--danger', type: 'button',
              'aria-label': `Remove player ${index + 1}`,
              onClick: () => {
                const wasMe = player.isMe;
                draft.players.splice(index, 1);
                if (wasMe && draft.players.length) draft.players[0].isMe = true;
                drawPlayers();
              },
            }, '×')
          : null),
      h('div', { class: 'player-row__bottom' },
        h('span', { class: 'label label--inline' }, 'Handicap'),
        h('div', { class: 'stepper stepper--sm' },
          h('button', {
            class: 'stepper__btn', type: 'button',
            'aria-label': `Decrease handicap for player ${index + 1}`,
            onClick: () => stepHandicap(-1),
          }, '−'),
          handicapValue,
          h('button', {
            class: 'stepper__btn', type: 'button',
            'aria-label': `Increase handicap for player ${index + 1}`,
            onClick: () => stepHandicap(1),
          }, '+'))));
  }

  drawPlayers();

  function begin() {
    const course = getCourse(draft.courseId);
    if (!course) { toast('Pick a course'); return; }
    if (state.activeRound && !confirmAction(
      'A round is already in progress. Starting a new one discards it. Continue?')) return;

    startRound({
      course,
      players: draft.players.map((p, i) => ({ ...p, name: p.name.trim() || `Player ${i + 1}` })),
    });
    go('/play');
  }

  return screen({
    title: 'New round',
    back: '#/',
    footer: button('Start round', { variant: 'primary', onClick: begin }),
  },
    card(
      h('label', { class: 'label', for: 'course-select' }, 'Course'),
      courseSelect,
      courseMeta),

    card(
      h('div', { class: 'row row--between' },
        h('h2', { class: 'card__title' }, 'Players'),
        h('span', { class: 'card__meta' }, '★ = you')),
      h('p', { class: 'hint' },
        'The starred player is the one used for the Strava description. Handicap is a signed adjustment applied to the round total.'),
      playerList,
      button('+ Add player', {
        onClick: () => {
          draft.players.push({ name: '', handicap: 0, isMe: false });
          drawPlayers({ focusLast: true });
        },
      })));
}

function formatHandicap(value) {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : String(value);
}
