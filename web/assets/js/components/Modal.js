/**
 * Modal Component
 *
 * Provides programmatic modal dialog control with accessibility features:
 * - Focus trap
 * - Keyboard navigation (ESC to close)
 * - Body scroll lock
 * - Click-outside to close
 * - ARIA attributes
 *
 * Usage:
 *   const modal = new Modal({
 *     title: 'Confirm Delete',
 *     content: 'Are you sure you want to delete this item?',
 *     size: 'sm',
 *     closeOnEscape: true,
 *     closeOnBackdrop: true,
 *     onOpen: () => console.log('Modal opened'),
 *     onClose: () => console.log('Modal closed'),
 *   });
 *
 *   modal.open();
 *   modal.close();
 *
 * Or use existing HTML:
 *   const modal = new Modal({ element: document.getElementById('myModal') });
 *   modal.open();
 */

class Modal {
  constructor(options = {}) {
    this.options = {
      title: options.title || '',
      content: options.content || '',
      footer: options.footer || null,
      size: options.size || 'md', // sm, md, lg, xl
      closeOnEscape: options.closeOnEscape !== false,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      showCloseButton: options.showCloseButton !== false,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      element: options.element || null, // Use existing modal element
    };

    this.isOpen = false;
    this.backdrop = null;
    this.modal = null;
    this.focusedElementBeforeOpen = null;
    this.focusableElements = [];
    this.firstFocusableElement = null;
    this.lastFocusableElement = null;

    // Create or use existing modal
    if (this.options.element) {
      this.modal = this.options.element;
      this.backdrop = document.querySelector('.modal-backdrop');
      if (!this.backdrop) {
        this.backdrop = this.createBackdrop();
      }
    } else {
      this.createModal();
    }

    this.bindEvents();
  }

  /**
   * Create backdrop element.
   */
  createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
    return backdrop;
  }

  /**
   * Create modal elements.
   */
  createModal() {
    // Create backdrop
    this.backdrop = this.createBackdrop();

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = `modal modal-${this.options.size}`;
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    if (this.options.title) {
      this.modal.setAttribute('aria-labelledby', 'modal-title');
    }

    // Build modal HTML
    let html = '';

    // Header
    if (this.options.title || this.options.showCloseButton) {
      html += '<div class="modal-header">';
      if (this.options.title) {
        html += `<h3 class="modal-title" id="modal-title">${this.escapeHtml(
          this.options.title
        )}</h3>`;
      }
      if (this.options.showCloseButton) {
        html += `<button class="modal-close" type="button" aria-label="Close" data-modal-close>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>`;
      }
      html += '</div>';
    }

    // Body
    html += '<div class="modal-body">';
    if (typeof this.options.content === 'string') {
      html += this.options.content;
    }
    html += '</div>';

    // Footer
    if (this.options.footer) {
      html += '<div class="modal-footer">';
      html += this.options.footer;
      html += '</div>';
    }

    this.modal.innerHTML = html;
    document.body.appendChild(this.modal);

    // If content is an element, append it
    if (this.options.content instanceof HTMLElement) {
      const body = this.modal.querySelector('.modal-body');
      body.innerHTML = '';
      body.appendChild(this.options.content);
    }
  }

  /**
   * Bind event handlers.
   */
  bindEvents() {
    // Close button
    const closeBtn = this.modal.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    if (this.options.closeOnBackdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Keyboard events
    this.keydownHandler = (e) => this.handleKeydown(e);
  }

  /**
   * Handle keydown events.
   */
  handleKeydown(e) {
    if (!this.isOpen) return;

    // ESC key
    if (e.key === 'Escape' && this.options.closeOnEscape) {
      e.preventDefault();
      this.close();
      return;
    }

    // TAB key - focus trap
    if (e.key === 'Tab') {
      this.handleTabKey(e);
    }
  }

  /**
   * Handle tab key for focus trap.
   */
  handleTabKey(e) {
    if (this.focusableElements.length === 0) return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusableElement) {
        e.preventDefault();
        this.lastFocusableElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusableElement) {
        e.preventDefault();
        this.firstFocusableElement.focus();
      }
    }
  }

  /**
   * Get focusable elements within modal.
   */
  getFocusableElements() {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    this.focusableElements = Array.from(
      this.modal.querySelectorAll(focusableSelectors)
    );
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement =
      this.focusableElements[this.focusableElements.length - 1];
  }

  /**
   * Lock body scroll.
   */
  lockScroll() {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  /**
   * Unlock body scroll.
   */
  unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  /**
   * Open the modal.
   */
  open() {
    if (this.isOpen) return;

    this.isOpen = true;

    // Store currently focused element
    this.focusedElementBeforeOpen = document.activeElement;

    // Lock scroll
    this.lockScroll();

    // Show backdrop
    this.backdrop.classList.add('show');

    // Show modal
    this.modal.classList.add('show');

    // Set up focus trap
    this.getFocusableElements();

    // Focus first focusable element or modal itself
    requestAnimationFrame(() => {
      if (this.firstFocusableElement) {
        this.firstFocusableElement.focus();
      } else {
        this.modal.focus();
      }
    });

    // Add keyboard listener
    document.addEventListener('keydown', this.keydownHandler);

    // Callback
    if (this.options.onOpen) {
      this.options.onOpen();
    }
  }

  /**
   * Close the modal.
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;

    // Hide modal
    this.modal.classList.remove('show');

    // Hide backdrop
    this.backdrop.classList.remove('show');

    // Unlock scroll
    this.unlockScroll();

    // Remove keyboard listener
    document.removeEventListener('keydown', this.keydownHandler);

    // Restore focus
    if (this.focusedElementBeforeOpen) {
      this.focusedElementBeforeOpen.focus();
    }

    // Callback
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Destroy the modal (remove from DOM).
   */
  destroy() {
    if (this.isOpen) {
      this.close();
    }

    // Remove from DOM if created programmatically
    if (!this.options.element) {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      if (this.backdrop && this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
    }
  }

  /**
   * Update modal content.
   */
  setContent(content) {
    const body = this.modal.querySelector('.modal-body');
    if (!body) return;

    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.innerHTML = '';
      body.appendChild(content);
    }

    // Update focus trap
    if (this.isOpen) {
      this.getFocusableElements();
    }
  }

  /**
   * Update modal title.
   */
  setTitle(title) {
    const titleEl = this.modal.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Escape HTML to prevent XSS.
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Static method: Confirm dialog.
   */
  static confirm(options) {
    return new Promise((resolve) => {
      const footer = `
        <button class="btn btn-ghost" data-modal-close>Cancel</button>
        <button class="btn btn-${options.variant || 'primary'}" data-confirm>
          ${options.confirmText || 'Confirm'}
        </button>
      `;

      const modal = new Modal({
        title: options.title || 'Confirm',
        content: options.message || 'Are you sure?',
        footer,
        size: options.size || 'sm',
        onClose: () => {
          modal.destroy();
          resolve(false);
        },
      });

      modal.open();

      // Bind confirm button
      const confirmBtn = modal.modal.querySelector('[data-confirm]');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          modal.close();
          modal.destroy();
          resolve(true);
        });
      }
    });
  }

  /**
   * Static method: Alert dialog.
   */
  static alert(options) {
    return new Promise((resolve) => {
      const footer = `
        <button class="btn btn-primary" data-modal-close>
          ${options.buttonText || 'OK'}
        </button>
      `;

      const modal = new Modal({
        title: options.title || 'Alert',
        content: options.message || '',
        footer,
        size: options.size || 'sm',
        onClose: () => {
          modal.destroy();
          resolve();
        },
      });

      modal.open();
    });
  }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Modal;
}

// Expose globally
window.Modal = Modal;
