/**
 * Toast Notification System
 *
 * Provides a simple API for showing toast notifications.
 * Automatically manages a queue and handles dismiss timers.
 *
 * Usage:
 *   Toast.success('Registration saved!');
 *   Toast.error('Failed to save registration');
 *   Toast.warning('Registration deadline approaching');
 *   Toast.info('New features available');
 *
 * Advanced:
 *   Toast.show({
 *     type: 'success',
 *     title: 'Success',
 *     message: 'Operation completed',
 *     duration: 5000,
 *     dismissible: true
 *   });
 */

const Toast = (function () {
  'use strict';

  let container = null;
  let toastQueue = [];
  let nextId = 1;

  /**
   * Initialize the toast container if it doesn't exist.
   */
  function initContainer() {
    if (container) return;

    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  /**
   * Get icon HTML for toast type.
   * @param {string} type - Toast type (success, error, warning, info)
   * @returns {string} Icon HTML
   */
  function getIcon(type) {
    const icons = {
      success: '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    };
    return icons[type] || icons.info;
  }

  /**
   * Create toast element.
   * @param {Object} options - Toast options
   * @returns {HTMLElement} Toast element
   */
  function createToastElement(options) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    toast.setAttribute('role', 'alert');
    toast.dataset.toastId = options.id;

    let html = getIcon(options.type);

    html += '<div class="toast-content">';
    if (options.title) {
      html += `<div class="toast-title">${escapeHtml(options.title)}</div>`;
    }
    if (options.message) {
      html += `<div class="toast-message">${escapeHtml(options.message)}</div>`;
    }
    html += '</div>';

    if (options.dismissible) {
      html += `<button class="toast-close" type="button" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`;
    }

    toast.innerHTML = html;

    // Add close handler
    if (options.dismissible) {
      const closeBtn = toast.querySelector('.toast-close');
      closeBtn.addEventListener('click', () => dismiss(options.id));
    }

    return toast;
  }

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Show a toast notification.
   * @param {Object} options - Toast options
   * @returns {number} Toast ID
   */
  function show(options) {
    initContainer();

    // Default options
    const config = {
      id: nextId++,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration !== undefined ? options.duration : 5000,
      dismissible: options.dismissible !== false,
    };

    // Create and add toast
    const toastEl = createToastElement(config);
    container.appendChild(toastEl);

    // Store in queue
    toastQueue.push({
      id: config.id,
      element: toastEl,
      timer: null,
    });

    // Trigger show animation
    requestAnimationFrame(() => {
      toastEl.classList.add('show');
    });

    // Auto-dismiss if duration is set
    if (config.duration > 0) {
      const toastData = toastQueue.find((t) => t.id === config.id);
      if (toastData) {
        toastData.timer = setTimeout(() => {
          dismiss(config.id);
        }, config.duration);
      }
    }

    return config.id;
  }

  /**
   * Dismiss a toast by ID.
   * @param {number} id - Toast ID
   */
  function dismiss(id) {
    const index = toastQueue.findIndex((t) => t.id === id);
    if (index === -1) return;

    const toastData = toastQueue[index];

    // Clear timer
    if (toastData.timer) {
      clearTimeout(toastData.timer);
    }

    // Remove show class
    toastData.element.classList.remove('show');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toastData.element.parentNode) {
        toastData.element.parentNode.removeChild(toastData.element);
      }
      toastQueue.splice(index, 1);

      // Remove container if no toasts left
      if (toastQueue.length === 0 && container && container.parentNode) {
        container.parentNode.removeChild(container);
        container = null;
      }
    }, 300); // Match CSS transition duration
  }

  /**
   * Dismiss all toasts.
   */
  function dismissAll() {
    const ids = toastQueue.map((t) => t.id);
    ids.forEach((id) => dismiss(id));
  }

  /**
   * Show success toast.
   * @param {string} message - Toast message
   * @param {string} [title] - Optional title
   * @param {number} [duration] - Optional duration
   * @returns {number} Toast ID
   */
  function success(message, title, duration) {
    return show({
      type: 'success',
      title: title || 'Success',
      message,
      duration,
    });
  }

  /**
   * Show error toast.
   * @param {string} message - Toast message
   * @param {string} [title] - Optional title
   * @param {number} [duration] - Optional duration (default: 7000)
   * @returns {number} Toast ID
   */
  function error(message, title, duration) {
    return show({
      type: 'error',
      title: title || 'Error',
      message,
      duration: duration !== undefined ? duration : 7000, // Longer for errors
    });
  }

  /**
   * Show warning toast.
   * @param {string} message - Toast message
   * @param {string} [title] - Optional title
   * @param {number} [duration] - Optional duration
   * @returns {number} Toast ID
   */
  function warning(message, title, duration) {
    return show({
      type: 'warning',
      title: title || 'Warning',
      message,
      duration,
    });
  }

  /**
   * Show info toast.
   * @param {string} message - Toast message
   * @param {string} [title] - Optional title
   * @param {number} [duration] - Optional duration
   * @returns {number} Toast ID
   */
  function info(message, title, duration) {
    return show({
      type: 'info',
      title: title || 'Info',
      message,
      duration,
    });
  }

  /**
   * Show loading toast (doesn't auto-dismiss).
   * @param {string} message - Toast message
   * @param {string} [title] - Optional title
   * @returns {number} Toast ID (use with dismiss() when done)
   */
  function loading(message, title) {
    return show({
      type: 'info',
      title: title || 'Loading...',
      message,
      duration: 0, // Don't auto-dismiss
      dismissible: false, // Can't manually dismiss
    });
  }

  // Public API
  return {
    show,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info,
    loading,
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}

// Expose globally
window.Toast = Toast;
