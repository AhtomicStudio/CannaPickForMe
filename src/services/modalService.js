// ============================================================
// Modal Service — unified open/close + confirm helper.
//
// Every modal in the app should be opened via `openModal(id, opts)`
// and closed via `closeModal(id)`. This routes all show/hide
// behavior through one place so we can guarantee consistent
// behavior (focus restoration, backdrop-click, Escape to close)
// across every surface.
//
// For anything that was previously a native `confirm(...)` call,
// use `showConfirm(opts)` which returns a Promise<boolean>.
// ============================================================

const modalReturnFocus = new WeakMap();

/**
 * Open a modal by id.
 *
 * @param {string} id             DOM id of the modal root (`.modal`)
 * @param {object} [opts]
 * @param {boolean} [opts.focusFirst=true]            Move focus to the first focusable element
 * @param {boolean} [opts.preventBackdropClose=false] Ignore backdrop clicks
 */
export function openModal(id, opts = {}) {
  const modal = document.getElementById(id);
  if (!modal) return;

  // Remember where focus was so we can return it when the modal closes.
  const prevFocus = document.activeElement;
  if (prevFocus && prevFocus !== document.body) {
    modalReturnFocus.set(modal, prevFocus);
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.dataset.preventBackdropClose = opts.preventBackdropClose ? 'true' : '';

  const focusFirst = opts.focusFirst !== false;
  if (focusFirst) {
    // Next frame — wait for the slide-up animation to mount the content.
    requestAnimationFrame(() => {
      const focusable = modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) focusable[0].focus();
    });
  }

  // Bind the backdrop-close listener once per modal.
  const backdrop = modal.querySelector('.modal__backdrop');
  if (backdrop && !backdrop.dataset.bound) {
    backdrop.addEventListener('click', () => {
      if (modal.dataset.preventBackdropClose !== 'true') {
        closeModal(id);
      }
    });
    backdrop.dataset.bound = 'true';
  }
}

/**
 * Close a modal by id. Restores focus to wherever it was before open.
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');

  const prev = modalReturnFocus.get(modal);
  if (prev && typeof prev.focus === 'function') {
    try { prev.focus(); } catch (_) { /* element may have been removed */ }
    modalReturnFocus.delete(modal);
  }
}

/** Close whichever modal is currently on top. Used by the global Escape handler. */
export function closeTopModal() {
  const openModals = Array.from(document.querySelectorAll('.modal:not(.hidden)'));
  if (!openModals.length) return false;
  const top = openModals[openModals.length - 1];
  if (top.id) closeModal(top.id);
  else top.classList.add('hidden');
  return true;
}

/**
 * Promise-based replacement for native `confirm()`.
 * Uses the reusable #confirm-modal in index.html.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.icon='🤔']           Big emoji at the top
 * @param {string} [opts.confirmLabel='Confirm']
 * @param {string} [opts.cancelLabel='Cancel']
 * @param {'primary'|'danger'|'glow'} [opts.tone='primary']  Visual tone of the confirm button
 * @returns {Promise<boolean>}  true = confirmed, false = cancelled
 */
export function showConfirm({
  title = '',
  message = '',
  icon = '🤔',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      // Graceful fallback — should never happen, but don't crash.
      resolve(window.confirm(message || title || ''));
      return;
    }

    const iconEl    = document.getElementById('confirm-modal-icon');
    const titleEl   = document.getElementById('confirm-modal-title');
    const msgEl     = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const okBtn     = document.getElementById('confirm-modal-ok');

    if (iconEl)  iconEl.textContent  = icon;
    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;
    if (cancelBtn) cancelBtn.textContent = cancelLabel;
    if (okBtn)     okBtn.textContent     = confirmLabel;

    // Tone: reset, then apply the requested one.
    if (okBtn) {
      okBtn.classList.remove('btn--primary', 'btn--danger', 'btn--glow');
      if (tone === 'danger') {
        okBtn.classList.add('btn--primary', 'btn--danger');
      } else if (tone === 'glow') {
        okBtn.classList.add('btn--primary', 'btn--glow');
      } else {
        okBtn.classList.add('btn--primary');
      }
    }

    // Clean up previous listeners by cloning the buttons.
    const newCancel = cancelBtn.cloneNode(true);
    const newOk     = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      escObserver.disconnect();
      modal.removeEventListener('cpfm:backdrop-close', onBackdrop);
      closeModal('confirm-modal');
      resolve(result);
    };

    const onBackdrop = () => done(false);

    newCancel.addEventListener('click', () => done(false));
    newOk.addEventListener('click', () => done(true));

    // Hook backdrop dismissals into our promise.
    const backdrop = modal.querySelector('.modal__backdrop');
    if (backdrop && !backdrop.dataset.confirmHook) {
      backdrop.addEventListener('click', () => {
        modal.dispatchEvent(new CustomEvent('cpfm:backdrop-close'));
      });
      backdrop.dataset.confirmHook = 'true';
    }
    modal.addEventListener('cpfm:backdrop-close', onBackdrop, { once: true });

    // Also resolve(false) if the modal becomes hidden by other means
    // (e.g. global Escape handler calling closeModal directly).
    const escObserver = new MutationObserver(() => {
      if (!settled && modal.classList.contains('hidden')) {
        done(false);
      }
    });
    escObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });

    openModal('confirm-modal', { focusFirst: false });
    // Focus the primary action — safer default for keyboard users.
    requestAnimationFrame(() => { newOk.focus(); });
  });
}
