import { state, getCourse, saveCourse, deleteCourse, DEFAULT_PAR, MIN_PAR, MAX_PAR } from '../state.js';
import * as scoring from '../scoring.js';
import { h, screen, card, button, go, refresh, toast, confirmAction, empty } from '../ui.js';

export function coursesView() {
  return screen({
    title: 'Courses',
    back: '#/',
    actions: button('New', { variant: 'ghost', onClick: () => go('/courses/new') }),
  },
    state.courses.length
      ? h('div', { class: 'stack' }, state.courses.map(courseRow))
      : empty(
          'No courses yet.',
          button('Add your first course', { variant: 'primary', onClick: () => go('/courses/new') })));
}

function courseRow(course) {
  return card(
    h('div', { class: 'row row--between' },
      h('div', {},
        h('h2', { class: 'card__title' }, course.name),
        h('p', { class: 'card__meta' },
          `${course.pars.length} holes · par ${scoring.totalPar(course.pars)}`)),
      h('div', { class: 'row row--gap' },
        button('Edit', { onClick: () => go(`/courses/${course.id}/edit`) }),
        button('Delete', {
          variant: 'danger-ghost',
          'aria-label': `Delete ${course.name}`,
          onClick: () => {
            if (!confirmAction(`Delete "${course.name}"? Rounds already played on it are kept.`)) return;
            deleteCourse(course.id);
            toast('Course deleted');
            refresh();
          },
        }))));
}

/* ------------------------------------------------------------------ editor */

export function courseEditorView(courseId) {
  const existing = courseId ? getCourse(courseId) : null;
  if (courseId && !existing) return notFound();

  // Local draft — the editor updates its own DOM rather than re-rendering, so
  // the name field never loses focus mid-typing.
  const draft = {
    name: existing?.name || '',
    pars: existing ? [...existing.pars] : Array.from({ length: 18 }, () => DEFAULT_PAR),
  };

  const totalNode = h('span', { class: 'stat__value' }, String(scoring.totalPar(draft.pars)));
  const parGrid = h('div', { class: 'par-grid' });

  function setHoleCount(count) {
    if (draft.pars.length === count) return;
    draft.pars = count > draft.pars.length
      ? [...draft.pars, ...Array.from({ length: count - draft.pars.length }, () => DEFAULT_PAR)]
      : draft.pars.slice(0, count);
    drawPars();
    updateTotal();
  }

  function updateTotal() {
    totalNode.textContent = String(scoring.totalPar(draft.pars));
  }

  function drawPars() {
    parGrid.replaceChildren(...draft.pars.map((par, i) => parCell(i, par)));
  }

  function parCell(index, par) {
    const value = h('span', { class: 'par-cell__value' }, String(par));
    const step = (delta) => {
      const next = Math.min(MAX_PAR, Math.max(MIN_PAR, draft.pars[index] + delta));
      draft.pars[index] = next;
      value.textContent = String(next);
      updateTotal();
    };
    return h('div', { class: 'par-cell' },
      h('span', { class: 'par-cell__label' }, `H${index + 1}`),
      h('div', { class: 'par-cell__controls' },
        h('button', {
          class: 'par-cell__btn', type: 'button',
          'aria-label': `Decrease par for hole ${index + 1}`,
          onClick: () => step(-1),
        }, '−'),
        value,
        h('button', {
          class: 'par-cell__btn', type: 'button',
          'aria-label': `Increase par for hole ${index + 1}`,
          onClick: () => step(1),
        }, '+')));
  }

  drawPars();

  const nameInput = h('input', {
    class: 'input', type: 'text', id: 'course-name', value: draft.name,
    placeholder: 'e.g. Bicentennial Park', maxLength: 60,
    autocomplete: 'off', enterkeyhint: 'done',
    onInput: (e) => { draft.name = e.target.value; },
  });

  const holeToggle = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Number of holes' },
    ...[9, 18].map((count) => {
      const btn = h('button', {
        class: `segmented__btn${draft.pars.length === count ? ' is-active' : ''}`,
        type: 'button',
        onClick: () => {
          setHoleCount(count);
          [...holeToggle.children].forEach((child, i) => {
            child.classList.toggle('is-active', [9, 18][i] === count);
          });
        },
      }, `${count} holes`);
      return btn;
    }));

  function submit() {
    if (!draft.name.trim()) {
      toast('Give the course a name');
      nameInput.focus();
      return;
    }
    saveCourse({ id: existing?.id, name: draft.name, pars: draft.pars });
    toast(existing ? 'Course updated' : 'Course saved');
    go('/courses');
  }

  return screen({
    title: existing ? 'Edit course' : 'New course',
    back: '#/courses',
    footer: button(existing ? 'Save changes' : 'Save course', { variant: 'primary', onClick: submit }),
  },
    card(
      h('label', { class: 'label', for: 'course-name' }, 'Course name'),
      nameInput,
      h('div', { class: 'spacer' }),
      h('span', { class: 'label' }, 'Layout'),
      holeToggle),

    card(
      h('div', { class: 'row row--between' },
        h('h2', { class: 'card__title' }, 'Par per hole'),
        h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, 'Total'), totalNode)),
      h('p', { class: 'hint' }, 'Defaults to par 3 — tap to adjust the longer holes.'),
      parGrid),

    existing
      ? card(button('Delete course', {
          variant: 'danger',
          onClick: () => {
            if (!confirmAction(`Delete "${existing.name}"? Rounds already played on it are kept.`)) return;
            deleteCourse(existing.id);
            toast('Course deleted');
            go('/courses');
          },
        }))
      : null);
}

function notFound() {
  return screen({ title: 'Course', back: '#/courses' },
    empty('That course no longer exists.',
      button('Back to courses', { variant: 'primary', onClick: () => go('/courses') })));
}
