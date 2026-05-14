/**
 * Skeleton Loader Component
 *
 * Provides skeleton loading placeholders for async content.
 * Uses existing CSS from components.css (.skeleton-* classes).
 *
 * Usage:
 *   // Show skeleton
 *   const container = document.getElementById('registrants-table');
 *   SkeletonLoader.table(container, { rows: 5, columns: 6 });
 *
 *   // Hide skeleton and show real content
 *   SkeletonLoader.hide(container);
 */

const SkeletonLoader = (function () {
  'use strict';

  /**
   * Show table skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function table(container, options = {}) {
    const rows = options.rows || 5;
    const columns = options.columns || 5;

    let html = '<table class="table" style="width:100%;">';

    // Header
    html += '<thead><tr>';
    for (let i = 0; i < columns; i++) {
      html += '<th><div class="skeleton skeleton-text"></div></th>';
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let j = 0; j < columns; j++) {
        html += '<td><div class="skeleton skeleton-text"></div></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Show card skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function card(container, options = {}) {
    const count = options.count || 1;
    const showImage = options.showImage !== false;

    let html = '';

    for (let i = 0; i < count; i++) {
      html += '<div class="card" style="margin-bottom: var(--space-4);">';
      html += '  <div class="card-body">';

      if (showImage) {
        html += '<div class="skeleton skeleton-avatar" style="width: 80px; height: 80px; margin-bottom: var(--space-3);"></div>';
      }

      html += '    <div class="skeleton skeleton-title"></div>';
      html += '    <div class="skeleton skeleton-text"></div>';
      html += '    <div class="skeleton skeleton-text" style="width: 60%;"></div>';
      html += '  </div>';
      html += '</div>';
    }

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Show list skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function list(container, options = {}) {
    const rows = options.rows || 5;
    const showAvatar = options.showAvatar !== false;

    let html = '<div style="display: flex; flex-direction: column; gap: var(--space-3);">';

    for (let i = 0; i < rows; i++) {
      html += '<div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg);">';

      if (showAvatar) {
        html += '<div class="skeleton skeleton-avatar"></div>';
      }

      html += '<div style="flex: 1;">';
      html += '  <div class="skeleton skeleton-text" style="width: 40%; margin-bottom: var(--space-2);"></div>';
      html += '  <div class="skeleton skeleton-text" style="width: 60%;"></div>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Show form skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function form(container, options = {}) {
    const fields = options.fields || 4;

    let html = '<div style="display: flex; flex-direction: column; gap: var(--space-4);">';

    for (let i = 0; i < fields; i++) {
      html += '<div>';
      html += '  <div class="skeleton skeleton-text" style="width: 30%; margin-bottom: var(--space-2);"></div>';
      html += '  <div class="skeleton" style="height: 40px; border-radius: var(--radius-lg);"></div>';
      html += '</div>';
    }

    html += '<div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">';
    html += '  <div class="skeleton skeleton-btn"></div>';
    html += '  <div class="skeleton skeleton-btn"></div>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Show text skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function text(container, options = {}) {
    const lines = options.lines || 3;

    let html = '<div style="display: flex; flex-direction: column; gap: var(--space-2);">';

    for (let i = 0; i < lines; i++) {
      const width = i === lines - 1 ? '60%' : '100%';
      html += `<div class="skeleton skeleton-text" style="width: ${width};"></div>`;
    }

    html += '</div>';

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Show stats/metrics skeleton.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   */
  function stats(container, options = {}) {
    const count = options.count || 3;

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">';

    for (let i = 0; i < count; i++) {
      html += '<div class="card">';
      html += '  <div class="card-body">';
      html += '    <div class="skeleton skeleton-text" style="width: 50%; margin-bottom: var(--space-3);"></div>';
      html += '    <div class="skeleton skeleton-title" style="width: 40%;"></div>';
      html += '  </div>';
      html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  /**
   * Hide skeleton and restore content.
   * @param {HTMLElement} container - Container element
   */
  function hide(container) {
    if (container.hasAttribute('data-skeleton')) {
      container.removeAttribute('data-skeleton');
      // Content should be set by caller after this
    }
  }

  /**
   * Check if element has skeleton.
   * @param {HTMLElement} container - Container element
   * @returns {boolean}
   */
  function isShowing(container) {
    return container.hasAttribute('data-skeleton');
  }

  /**
   * Show custom skeleton from template.
   * @param {HTMLElement} container - Container element
   * @param {string} html - Custom skeleton HTML
   */
  function custom(container, html) {
    container.innerHTML = html;
    container.setAttribute('data-skeleton', 'true');
  }

  // Public API
  return {
    table,
    card,
    list,
    form,
    text,
    stats,
    hide,
    isShowing,
    custom,
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkeletonLoader;
}

// Expose globally
window.SkeletonLoader = SkeletonLoader;
