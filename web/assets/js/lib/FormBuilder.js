/**
 * FormBuilder - Dynamic form renderer from field configuration
 *
 * Reads a field schema and generates HTML form elements.
 * Supports terminology substitution, validation, conditional fields, and various field types.
 */

class FormBuilder {
  /**
   * @param {Object} config - Field configuration object
   * @param {Object} options - Additional options (coaches, eventOptions, etc.)
   */
  constructor(config, options = {}) {
    this.config = config || {};
    this.fields = this.config.fields || [];
    this.sections = this.config.sections || [];
    this.terminology = this.config.terminology || {};
    this.options = options;

    // Runtime data (coaches, etc.) passed from API
    this.coaches = options.coaches || [];
    this.eventOptions = options.eventOptions || [];
    this.facilityFee = options.facilityFee || 0;
    this.optionalProduct = options.optionalProduct || null;

    // Form state
    this.values = {};
    this.errors = {};

    // Conditional fields tracking
    this._conditionalFields = []; // Fields with conditions
    this._container = null; // Reference to mounted container

    // Event listeners
    this._listeners = {
      change: [],
      submit: [],
    };
  }

  /**
   * Replace terminology placeholders like {{instructor}} with actual values.
   * @param {string} text
   * @returns {string}
   */
  replaceTerm(text) {
    if (!text || typeof text !== 'string') return text || '';

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return this.terminology[key] || match;
    });
  }

  /**
   * Get enabled fields sorted by order.
   * @returns {Array}
   */
  getEnabledFields() {
    return this.fields
      .filter((f) => f.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get a field by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getField(id) {
    return this.fields.find((f) => f.id === id) || null;
  }

  /**
   * Generate HTML for a single field.
   * @param {Object} field
   * @returns {string}
   */
  renderField(field) {
    const id = field.id;
    const type = field.type || 'text';
    const label = this.replaceTerm(field.label || '');
    const placeholder = this.replaceTerm(field.placeholder || '');
    const helpText = this.replaceTerm(field.helpText || '');
    const required = field.required === true;
    const requiredAttr = required ? 'required' : '';
    const requiredMark = required ? '<span class="text-red-500">*</span>' : '';

    // Check for conditional display
    const condition = field.condition;
    const hasCondition = condition && condition.field && condition.value !== undefined;
    const conditionData = hasCondition
      ? `data-condition-field="${this.escapeHtml(condition.field)}" data-condition-operator="${this.escapeHtml(condition.operator || 'equals')}" data-condition-value="${this.escapeHtml(String(condition.value))}"`
      : '';
    // Initially hide fields with conditions (they'll be shown when condition is met)
    const conditionalHidden = hasCondition ? 'display: none;' : '';

    // Width class mapping
    const widthClass = {
      full: 'grid-column: span 12;',
      half: 'grid-column: span 6;',
      third: 'grid-column: span 4;',
      quarter: 'grid-column: span 3;',
    }[field.width] || 'grid-column: span 12;';

    let inputHtml = '';

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'date':
        inputHtml = `
          <input
            type="${type}"
            id="${id}"
            name="${id}"
            class="form-control"
            placeholder="${this.escapeHtml(placeholder)}"
            ${requiredAttr}
          />
        `;
        break;

      case 'textarea':
        inputHtml = `
          <textarea
            id="${id}"
            name="${id}"
            class="form-textarea"
            placeholder="${this.escapeHtml(placeholder)}"
            ${requiredAttr}
          ></textarea>
        `;
        break;

      case 'select':
        const options = (field.options || [])
          .map((opt) => {
            const disabled = opt.disabled ? 'disabled' : '';
            const selected = opt.value === '' && field.required ? 'selected' : '';
            return `<option value="${this.escapeHtml(opt.value)}" ${disabled} ${selected}>${this.escapeHtml(opt.label)}</option>`;
          })
          .join('');
        inputHtml = `
          <select id="${id}" name="${id}" class="form-control" ${requiredAttr}>
            ${options}
          </select>
        `;
        break;

      case 'checkbox':
        inputHtml = `
          <label class="flex items-center gap-2">
            <input type="checkbox" id="${id}" name="${id}" />
            <span class="text-sm text-gray-900">${this.escapeHtml(label)}</span>
          </label>
        `;
        // For checkbox, we don't want the label above
        return `
          <div data-field-id="${id}" ${conditionData} style="${widthClass} ${conditionalHidden}">
            ${inputHtml}
            ${helpText ? `<p class="text-xs text-gray-600 mt-1">${this.escapeHtml(helpText)}</p>` : ''}
          </div>
        `;

      case 'coach-select':
        // Special component for multi-select coaches with "Other" option
        inputHtml = `
          <div id="${id}_container" class="coach-select-container">
            <div id="${id}_list" class="coach-options-list" style="display:grid; grid-template-columns: 1fr; gap: 0.5rem 1.25rem;"></div>
            <p id="${id}_empty" class="text-sm text-gray-600 mt-2 hidden">No ${this.replaceTerm('{{instructorPlural}}')} available.</p>
            ${field.allowOther !== false ? `
              <div class="mt-3">
                <label class="flex items-center gap-2">
                  <input type="checkbox" id="${id}_other_enabled" />
                  <span class="text-sm text-gray-900">${this.escapeHtml(this.replaceTerm(field.otherLabel || 'Other'))}</span>
                </label>
                <input
                  type="text"
                  id="${id}_other_name"
                  name="${id}_other_name"
                  class="form-control mt-2"
                  placeholder="${this.escapeHtml(this.replaceTerm(field.otherPlaceholder || 'Enter name'))}"
                  style="display: none;"
                  disabled
                />
              </div>
            ` : ''}
          </div>
        `;
        break;

      default:
        inputHtml = `
          <input
            type="text"
            id="${id}"
            name="${id}"
            class="form-control"
            placeholder="${this.escapeHtml(placeholder)}"
            ${requiredAttr}
          />
        `;
    }

    return `
      <div data-field-id="${id}" ${conditionData} style="${widthClass} ${conditionalHidden}">
        <label class="block font-medium text-gray-800" for="${id}">
          ${this.escapeHtml(label)} ${requiredMark}
        </label>
        ${inputHtml}
        ${helpText ? `<p class="text-xs text-gray-600 mt-1">${this.escapeHtml(helpText)}</p>` : ''}
      </div>
    `;
  }

  /**
   * Render a section with its fields.
   * @param {Object} section
   * @returns {string}
   */
  renderSection(section) {
    const title = this.replaceTerm(section.title || '');
    const fieldIds = section.fields || [];

    const fieldsHtml = fieldIds
      .map((id) => {
        const field = this.getField(id);
        if (!field || field.enabled === false) return '';
        return this.renderField(field);
      })
      .filter(Boolean)
      .join('');

    if (!fieldsHtml) return '';

    const collapsible = section.collapsible === true;
    const collapsed = section.collapsed === true;

    if (collapsible) {
      return `
        <div class="form-section collapsible ${collapsed ? 'collapsed' : ''}" data-section="${section.id}">
          <button type="button" class="section-toggle flex items-center justify-between w-full text-left py-2">
            <h3 class="text-base font-semibold text-gray-900">${this.escapeHtml(title)}</h3>
            <span class="toggle-icon text-gray-500">${collapsed ? '+' : '−'}</span>
          </button>
          <div class="section-content ${collapsed ? 'hidden' : ''}" style="display:grid; gap:1rem; grid-template-columns: repeat(12, 1fr); margin-top:0.75rem;">
            ${fieldsHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="form-section" data-section="${section.id}">
        <h3 class="text-base font-semibold text-gray-900 mb-3">${this.escapeHtml(title)}</h3>
        <div style="display:grid; gap:1rem; grid-template-columns: repeat(12, 1fr);">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render the complete form HTML.
   * @returns {string}
   */
  render() {
    // If we have sections defined, render by section
    if (this.sections.length > 0) {
      const sectionsHtml = this.sections
        .map((section) => this.renderSection(section))
        .filter(Boolean)
        .join('<hr class="hr my-4" />');

      return `
        <div class="form-builder-container">
          ${sectionsHtml}
        </div>
      `;
    }

    // Otherwise, render all enabled fields in order
    const fieldsHtml = this.getEnabledFields()
      .map((field) => this.renderField(field))
      .join('');

    return `
      <div class="form-builder-container">
        <div style="display:grid; gap:1rem; grid-template-columns: repeat(12, 1fr);">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Mount the form to a container element and wire up event handlers.
   * @param {HTMLElement} container
   */
  mount(container) {
    if (!container) {
      console.error('FormBuilder: No container provided');
      return;
    }

    this._container = container;
    container.innerHTML = this.render();

    // Wire up collapsible sections
    container.querySelectorAll('.section-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.form-section');
        const content = section.querySelector('.section-content');
        const icon = btn.querySelector('.toggle-icon');

        const isCollapsed = content.classList.contains('hidden');
        content.classList.toggle('hidden', !isCollapsed);
        section.classList.toggle('collapsed', !isCollapsed);
        if (icon) icon.textContent = isCollapsed ? '−' : '+';
      });
    });

    // Wire up coach select components
    this.fields.forEach((field) => {
      if (field.type === 'coach-select' && field.enabled !== false) {
        this._wireCoachSelect(container, field);
      }
    });

    // Wire up conditional fields
    this._wireConditionalFields(container);

    // Wire up responsive grid for coach lists
    const mq = window.matchMedia('(min-width: 900px)');
    const applyCoachCols = () => {
      container.querySelectorAll('.coach-options-list').forEach((el) => {
        el.style.gridTemplateColumns = mq.matches ? '1fr 1fr' : '1fr';
      });
    };
    applyCoachCols();
    mq.addEventListener?.('change', applyCoachCols);
  }

  /**
   * Wire up conditional field visibility logic.
   * @param {HTMLElement} container
   */
  _wireConditionalFields(container) {
    // Find all fields with conditions
    const conditionalEls = container.querySelectorAll('[data-condition-field]');
    if (conditionalEls.length === 0) return;

    // Build a map of trigger field -> dependent fields
    const triggerMap = new Map();

    conditionalEls.forEach((el) => {
      const triggerFieldId = el.dataset.conditionField;
      const operator = el.dataset.conditionOperator || 'equals';
      const conditionValue = el.dataset.conditionValue;
      const fieldId = el.dataset.fieldId;

      if (!triggerMap.has(triggerFieldId)) {
        triggerMap.set(triggerFieldId, []);
      }
      triggerMap.get(triggerFieldId).push({
        el,
        fieldId,
        operator,
        conditionValue,
      });
    });

    // Wire up change listeners on trigger fields
    triggerMap.forEach((dependents, triggerFieldId) => {
      const triggerEl = container.querySelector(`#${triggerFieldId}`);
      if (!triggerEl) return;

      const evaluateConditions = () => {
        const triggerValue = this._getFieldValue(container, triggerFieldId);

        dependents.forEach(({ el, operator, conditionValue }) => {
          const conditionMet = this._evaluateCondition(triggerValue, operator, conditionValue);

          if (conditionMet) {
            el.style.display = '';
            // Re-enable inputs if they were disabled
            el.querySelectorAll('input, select, textarea').forEach((input) => {
              input.disabled = false;
            });
          } else {
            el.style.display = 'none';
            // Disable inputs to exclude from form submission/validation
            el.querySelectorAll('input, select, textarea').forEach((input) => {
              input.disabled = true;
            });
          }
        });
      };

      // Listen for changes
      triggerEl.addEventListener('change', evaluateConditions);
      triggerEl.addEventListener('input', evaluateConditions);

      // Initial evaluation
      evaluateConditions();
    });
  }

  /**
   * Get the current value of a field.
   * @param {HTMLElement} container
   * @param {string} fieldId
   * @returns {string|boolean}
   */
  _getFieldValue(container, fieldId) {
    const field = this.getField(fieldId);
    if (!field) return '';

    if (field.type === 'checkbox') {
      const el = container.querySelector(`#${fieldId}`);
      return el?.checked ? 'true' : 'false';
    }

    const el = container.querySelector(`#${fieldId}`);
    return el?.value || '';
  }

  /**
   * Evaluate if a condition is met.
   * @param {string} value - Current value of trigger field
   * @param {string} operator - Comparison operator
   * @param {string} conditionValue - Value to compare against
   * @returns {boolean}
   */
  _evaluateCondition(value, operator, conditionValue) {
    switch (operator) {
      case 'equals':
        return value === conditionValue;
      case 'not_equals':
        return value !== conditionValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'not_empty':
        return value !== '' && value !== null && value !== undefined;
      case 'is_empty':
        return value === '' || value === null || value === undefined;
      default:
        return value === conditionValue;
    }
  }

  /**
   * Wire up a coach-select field with data.
   * @param {HTMLElement} container
   * @param {Object} field
   */
  _wireCoachSelect(container, field) {
    const listEl = container.querySelector(`#${field.id}_list`);
    const emptyEl = container.querySelector(`#${field.id}_empty`);
    const otherEnabled = container.querySelector(`#${field.id}_other_enabled`);
    const otherName = container.querySelector(`#${field.id}_other_name`);

    if (!listEl) return;

    // Render coach checkboxes
    if (this.coaches.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
    } else {
      if (emptyEl) emptyEl.classList.add('hidden');
      listEl.innerHTML = this.coaches
        .map((c) => {
          const name = this.escapeHtml(c.name || '');
          const code = this.escapeHtml(c.internal_code || '');
          return `
            <label class="flex items-center gap-2" style="min-width:0;">
              <input type="checkbox" data-coach-opt="1" value="${c.id}" data-name="${name}" data-code="${code}" />
              <span class="text-sm text-gray-900">${c.name}</span>
            </label>
          `;
        })
        .join('');
    }

    // Wire "Other" toggle
    if (otherEnabled && otherName) {
      const updateOther = () => {
        const on = otherEnabled.checked;
        otherName.style.display = on ? '' : 'none';
        otherName.disabled = !on;
        if (!on) otherName.value = '';
        if (on) setTimeout(() => otherName.focus(), 0);
      };
      otherEnabled.addEventListener('change', updateOther);
      updateOther();
    }
  }

  /**
   * Get all form values as an object.
   * @param {HTMLElement} container
   * @param {Object} options - { includeHidden: false } to exclude conditionally hidden fields
   * @returns {Object}
   */
  getValues(container, options = {}) {
    const values = {};
    const includeHidden = options.includeHidden !== false;

    this.getEnabledFields().forEach((field) => {
      const id = field.id;

      // Check if field is conditionally hidden (wrapper has display:none)
      const wrapper = container.querySelector(`[data-field-id="${id}"]`);
      if (!includeHidden && wrapper && wrapper.style.display === 'none') {
        return; // Skip hidden conditional fields
      }

      if (field.type === 'coach-select') {
        // Get checked coaches
        const checks = container.querySelectorAll(`#${id}_list input[type="checkbox"]:checked`);
        const selected = Array.from(checks).map((c) => ({
          id: Number(c.value),
          name: c.dataset.name || '',
          internal_code: c.dataset.code || '',
        }));

        // Handle "Other" coach
        const otherEnabled = container.querySelector(`#${id}_other_enabled`);
        const otherName = container.querySelector(`#${id}_other_name`);
        if (otherEnabled?.checked && otherName?.value?.trim()) {
          selected.push({
            id: 0,
            name: otherName.value.trim(),
            internal_code: 'OTHER',
          });
        }

        values[id] = selected;
        values[`${id}_json`] = JSON.stringify(selected);
        values[`${field.column || id}`] = JSON.stringify(selected);

        // Comma-separated names for display
        values[`${id}_names`] = selected.map((c) => c.name).filter(Boolean).join(', ');
      } else if (field.type === 'checkbox') {
        const el = container.querySelector(`#${id}`);
        values[id] = el?.checked ? true : false;
      } else {
        const el = container.querySelector(`#${id}`);
        values[id] = el?.value || '';
      }
    });

    return values;
  }

  /**
   * Separate values into column data and custom data.
   * @param {Object} values - Raw form values
   * @returns {{ columnData: Object, customData: Object }}
   */
  separateStorage(values) {
    const columnData = {};
    const customData = {};

    this.getEnabledFields().forEach((field) => {
      const id = field.id;
      const storage = field.storage || 'column';
      const column = field.column || id;

      let value = values[id];

      // Handle special types
      if (field.type === 'coach-select') {
        value = values[`${id}_json`] || JSON.stringify(values[id] || []);
      }

      if (storage === 'column') {
        columnData[column] = value;
      } else {
        customData[id] = value;
      }
    });

    return { columnData, customData };
  }

  /**
   * Validate form values.
   * @param {Object} values
   * @param {HTMLElement} container - Optional container to check for hidden fields
   * @returns {{ valid: boolean, errors: Object }}
   */
  validate(values, container = null) {
    const errors = {};
    const checkContainer = container || this._container;

    this.getEnabledFields().forEach((field) => {
      const id = field.id;
      const value = values[id];
      const validation = field.validation || {};

      // Skip validation for conditionally hidden fields
      if (checkContainer) {
        const wrapper = checkContainer.querySelector(`[data-field-id="${id}"]`);
        if (wrapper && wrapper.style.display === 'none') {
          return; // Skip validation for hidden conditional fields
        }
      }

      // Required check
      if (field.required) {
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          errors[id] = `${this.replaceTerm(field.label)} is required`;
          return;
        }
      }

      // Skip further validation if empty and not required
      if (!value) return;

      // Email validation
      if (validation.pattern === 'email' || field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[id] = 'Please enter a valid email address';
        }
      }

      // Min/max length
      if (typeof value === 'string') {
        if (validation.minLength && value.length < validation.minLength) {
          errors[id] = `Minimum ${validation.minLength} characters required`;
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          errors[id] = `Maximum ${validation.maxLength} characters allowed`;
        }
      }
    });

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormBuilder;
}
