// web/assets/js/toast.js

let activeToast = null;
let hideTimer = null;

/**
 * Show a toast message.
 *
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 * @param {number} [ms]
 */
export function showToast(message, type = 'info', ms = 3500) {
  const msg = String(message ?? '').trim();
  if (!msg) return;

  // Remove any existing toast
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  const el = document.createElement('div');
  activeToast = el;

  // Inline styles so it works even without Tailwind
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '9999';
  el.style.maxWidth = 'min(520px, calc(100vw - 24px))';
  el.style.padding = '12px 14px';
  el.style.borderRadius = '12px';
  el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
  el.style.fontSize = '14px';
  el.style.lineHeight = '1.35';
  el.style.opacity = '0';
  el.style.transition = 'opacity 160ms ease';
  el.style.pointerEvents = 'none';

  // Colors
  if (type === 'success') {
    el.style.background = '#16a34a';
    el.style.color = '#ffffff';
  } else if (type === 'error') {
    el.style.background = '#dc2626';
    el.style.color = '#ffffff';
  } else {
    el.style.background = '#111827';
    el.style.color = '#ffffff';
  }

  el.textContent = msg;

  document.body.appendChild(el);

  // Fade in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  hideTimer = window.setTimeout(() => {
    if (el !== activeToast) return;
    el.style.opacity = '0';
    window.setTimeout(() => {
      if (el === activeToast) {
        el.remove();
        activeToast = null;
      }
    }, 180);
  }, Math.max(800, Number(ms) || 3500));
}
