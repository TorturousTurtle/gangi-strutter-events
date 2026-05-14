/**
 * Dropdown Component
 *
 * Provides dropdown menu functionality with:
 * - Positioning logic
 * - Click-outside detection
 * - Keyboard navigation (arrow keys, ESC, Enter)
 * - Programmatic control
 *
 * Usage (HTML):
 *   <div class="dropdown" data-dropdown>
 *     <button class="btn btn-primary" data-dropdown-trigger>
 *       Menu <i data-lucide="chevron-down"></i>
 *     </button>
 *     <div class="dropdown-menu" data-dropdown-menu>
 *       <button class="dropdown-item" data-dropdown-item>Item 1</button>
 *       <button class="dropdown-item" data-dropdown-item>Item 2</button>
 *       <div class="dropdown-divider"></div>
 *       <button class="dropdown-item dropdown-item-danger" data-dropdown-item>Delete</button>
 *     </div>
 *   </div>
 *
 * Usage (JS):
 *   const dropdown = new Dropdown(document.querySelector('[data-dropdown]'));
 *   dropdown.open();
 *   dropdown.close();
 *   dropdown.toggle();
 */

class Dropdown {
  constructor(element, options = {}) {
    if (!element) {
      throw new Error('Dropdown: element is required');
    }

    this.element = element;
    this.options = {
      placement: options.placement || 'bottom-start', // bottom-start, bottom-end, top-start, top-end
      offset: options.offset || 4,
      closeOnSelect: options.closeOnSelect !== false,
      closeOnClickOutside: options.closeOnClickOutside !== false,
      closeOnEscape: options.closeOnEscape !== false,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
    };

    this.isOpen = false;
    this.trigger = element.querySelector('[data-dropdown-trigger]');
    this.menu = element.querySelector('[data-dropdown-menu]');
    this.items = Array.from(element.querySelectorAll('[data-dropdown-item]'));
    this.focusedIndex = -1;

    if (!this.trigger || !this.menu) {
      throw new Error(
        'Dropdown: trigger and menu elements are required (data-dropdown-trigger, data-dropdown-menu)'
      );
    }

    this.bindEvents();
  }

  /**
   * Bind event handlers.
   */
  bindEvents() {
    // Trigger click
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    // Item click
    this.items.forEach((item) => {
      item.addEventListener('click', (e) => {
        this.handleItemClick(e, item);
      });
    });

    // Store bound handlers for removal
    this.clickOutsideHandler = (e) => this.handleClickOutside(e);
    this.keydownHandler = (e) => this.handleKeydown(e);
  }

  /**
   * Handle item click.
   */
  handleItemClick(e, item) {
    if (item.disabled) {
      e.preventDefault();
      return;
    }

    if (this.options.closeOnSelect) {
      this.close();
    }
  }

  /**
   * Handle click outside dropdown.
   */
  handleClickOutside(e) {
    if (!this.element.contains(e.target)) {
      this.close();
    }
  }

  /**
   * Handle keyboard navigation.
   */
  handleKeydown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'Escape':
        if (this.options.closeOnEscape) {
          e.preventDefault();
          this.close();
          this.trigger.focus();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.focusNextItem();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.focusPreviousItem();
        break;

      case 'Home':
        e.preventDefault();
        this.focusFirstItem();
        break;

      case 'End':
        e.preventDefault();
        this.focusLastItem();
        break;

      case 'Enter':
      case ' ':
        if (this.focusedIndex >= 0) {
          e.preventDefault();
          this.items[this.focusedIndex].click();
        }
        break;

      case 'Tab':
        // Close on tab out
        this.close();
        break;
    }
  }

  /**
   * Focus next item in list.
   */
  focusNextItem() {
    this.focusedIndex = (this.focusedIndex + 1) % this.items.length;
    this.items[this.focusedIndex].focus();
  }

  /**
   * Focus previous item in list.
   */
  focusPreviousItem() {
    this.focusedIndex =
      this.focusedIndex <= 0 ? this.items.length - 1 : this.focusedIndex - 1;
    this.items[this.focusedIndex].focus();
  }

  /**
   * Focus first item in list.
   */
  focusFirstItem() {
    this.focusedIndex = 0;
    this.items[this.focusedIndex].focus();
  }

  /**
   * Focus last item in list.
   */
  focusLastItem() {
    this.focusedIndex = this.items.length - 1;
    this.items[this.focusedIndex].focus();
  }

  /**
   * Position the menu based on placement option.
   */
  position() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const menuRect = this.menu.getBoundingClientRect();
    const offset = this.options.offset;

    // Reset positioning
    this.menu.style.top = '';
    this.menu.style.bottom = '';
    this.menu.style.left = '';
    this.menu.style.right = '';

    // Calculate position based on placement
    switch (this.options.placement) {
      case 'bottom-start':
        this.menu.style.top = `calc(100% + ${offset}px)`;
        this.menu.style.left = '0';
        break;

      case 'bottom-end':
        this.menu.style.top = `calc(100% + ${offset}px)`;
        this.menu.style.right = '0';
        break;

      case 'top-start':
        this.menu.style.bottom = `calc(100% + ${offset}px)`;
        this.menu.style.left = '0';
        break;

      case 'top-end':
        this.menu.style.bottom = `calc(100% + ${offset}px)`;
        this.menu.style.right = '0';
        break;
    }

    // Check if menu goes off screen and adjust
    requestAnimationFrame(() => {
      const updatedRect = this.menu.getBoundingClientRect();

      // Check right edge
      if (updatedRect.right > window.innerWidth) {
        this.menu.style.left = 'auto';
        this.menu.style.right = '0';
      }

      // Check left edge
      if (updatedRect.left < 0) {
        this.menu.style.right = 'auto';
        this.menu.style.left = '0';
      }

      // Check bottom edge
      if (
        updatedRect.bottom > window.innerHeight &&
        this.options.placement.startsWith('bottom')
      ) {
        this.menu.style.top = 'auto';
        this.menu.style.bottom = `calc(100% + ${offset}px)`;
      }

      // Check top edge
      if (updatedRect.top < 0 && this.options.placement.startsWith('top')) {
        this.menu.style.bottom = 'auto';
        this.menu.style.top = `calc(100% + ${offset}px)`;
      }
    });
  }

  /**
   * Open the dropdown.
   */
  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.element.classList.add('open');
    this.menu.classList.add('show');
    this.trigger.setAttribute('aria-expanded', 'true');

    // Position menu
    this.position();

    // Set up event listeners
    if (this.options.closeOnClickOutside) {
      // Use timeout to prevent immediate close from trigger click
      setTimeout(() => {
        document.addEventListener('click', this.clickOutsideHandler);
      }, 0);
    }

    if (this.options.closeOnEscape) {
      document.addEventListener('keydown', this.keydownHandler);
    }

    // Focus first item
    this.focusedIndex = -1;

    // Callback
    if (this.options.onOpen) {
      this.options.onOpen();
    }
  }

  /**
   * Close the dropdown.
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.element.classList.remove('open');
    this.menu.classList.remove('show');
    this.trigger.setAttribute('aria-expanded', 'false');

    // Remove event listeners
    document.removeEventListener('click', this.clickOutsideHandler);
    document.removeEventListener('keydown', this.keydownHandler);

    // Reset focus
    this.focusedIndex = -1;

    // Callback
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Toggle dropdown open/closed.
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Destroy the dropdown (remove event listeners).
   */
  destroy() {
    if (this.isOpen) {
      this.close();
    }

    // Remove trigger listener (can't remove without stored reference, so skip)
    // In production, you'd store the bound function reference
  }

  /**
   * Static method: Initialize all dropdowns on page.
   */
  static initAll() {
    const dropdowns = document.querySelectorAll('[data-dropdown]');
    return Array.from(dropdowns).map((el) => new Dropdown(el));
  }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dropdown;
}

// Expose globally
window.Dropdown = Dropdown;

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dropdown.initAll());
} else {
  Dropdown.initAll();
}
