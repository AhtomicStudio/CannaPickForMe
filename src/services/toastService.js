// Lazy companion import — toasts should not drag game modules into the eager bundle.
async function _notifyCompanion(type) {
  if (type !== 'success' && type !== 'error') return;
  try {
    const { reactToEvent } = await import('../game/companion.js');
    reactToEvent(type === 'success' ? 'toast-success' : 'toast-error');
  } catch (_) { /* companion is non-critical */ }
}

export function showToast(message, type = 'info') {
  _notifyCompanion(type);
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: var(--z-toast, 2000);
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  
  // Basic styling handled via style.css; setting inline defaults just in case
  toast.style.cssText = `
    background: var(--bg-card, #141b2d);
    color: var(--text-primary, #f1f5f9);
    padding: 12px 24px;
    border-radius: var(--radius-full, 9999px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    font-size: var(--fs-sm, 0.9375rem);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.1));
    opacity: 0;
    transform: translateY(10px);
    transition: all var(--dur-base, 240ms) var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
    pointer-events: auto;
  `;

  if (type === 'error') toast.style.borderLeft = '4px solid var(--danger, #ef4444)';
  if (type === 'success') toast.style.borderLeft = '4px solid var(--green-primary, #22c55e)';

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove after 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
