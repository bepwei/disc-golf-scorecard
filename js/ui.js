/** Small DOM helpers — enough structure to keep the views readable, no framework. */

/**
 * Hyperscript. `h('button', { class: 'btn', onClick: fn }, 'Save')`
 * Props starting with `on` become listeners; everything else is set as a
 * property when the element has one, otherwise as an attribute.
 */
export function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'for') node.htmlFor = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && typeof value !== 'object') node[key] = value;
    else node.setAttribute(key, value);
  }
  append(node, children);
  return node;
}

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Navigate. The router redraws on `hashchange`. */
export function go(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === target) refresh();
  else window.location.hash = target;
}

/** Redraw the current route in place — used after a state change. */
export function refresh() {
  document.dispatchEvent(new Event('app:render'));
}

/** Standard screen chrome: sticky header, scrolling body, optional sticky footer. */
export function screen({ title, subtitle, back, actions, footer }, ...content) {
  return h('div', { class: 'screen' },
    h('header', { class: 'topbar' },
      back
        ? h('button', {
            class: 'topbar__back',
            type: 'button',
            'aria-label': 'Back',
            onClick: () => { window.location.hash = back; },
          }, '‹')
        : h('span', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__titles' },
        h('h1', { class: 'topbar__title' }, title),
        subtitle ? h('p', { class: 'topbar__subtitle' }, subtitle) : null),
      h('div', { class: 'topbar__actions' }, actions || null)),
    h('main', { class: 'body', id: 'scroll-body' }, ...content),
    footer ? h('footer', { class: 'footer' }, footer) : null);
}

export function button(label, { onClick, variant = 'secondary', type = 'button', ...rest } = {}) {
  return h('button', { class: `btn btn--${variant}`, type, onClick, ...rest }, label);
}

export function card(...content) {
  return h('section', { class: 'card' }, ...content);
}

export function empty(message, action) {
  return h('div', { class: 'empty' }, h('p', {}, message), action || null);
}

let toastTimer;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('toast--visible'), 2200);
}

/**
 * Confirmation via the native dialog — one line, and on iOS it renders as a
 * proper system sheet with big tap targets.
 */
export function confirmAction(message) {
  return window.confirm(message);
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Copy text to the clipboard.
 *
 * The async Clipboard API only exists in a secure context, so opening the app
 * over plain http on the LAN (phone testing) always lands on the legacy path.
 * That path is written the long way round because iOS Safari ignores
 * `.select()` on a readonly/offscreen textarea — it needs a real Range on an
 * editable, on-screen (if invisible) element.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }

  try {
    const area = h('textarea', { value: text });
    area.contentEditable = 'true';
    area.readOnly = false;
    // Must be rendered and in the viewport for iOS; 1px + transparent hides it.
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
    document.body.append(area);

    const range = document.createRange();
    range.selectNodeContents(area);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    area.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    selection.removeAllRanges();
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Last resort: select the text so the user can tap iOS's own Copy button. */
export function selectContents(node) {
  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch {
    return false;
  }
}
