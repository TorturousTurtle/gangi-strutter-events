/**
 * Form Fields Configuration Tab
 *
 * Allows admins to enable/disable fields and set required status
 * for the registration form. Saves overrides to competition's fields_config_json.
 */

export function initRegistrationFieldsFormFieldsTab({
  root,
  eventsBox,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCurrentCompetitionId,
  getCurrentFieldsConfig,
  setCurrentFieldsConfig,
  markRegFieldsDirty,
} = {}) {
  // Create the panel element
  const panelEl = document.createElement("div");
  panelEl.setAttribute("data-regfields-panel", "formFields");
  panelEl.className = "hidden";

  panelEl.innerHTML = `
    <div class="admin-table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Field</th>
            <th style="width: 100px;">Type</th>
            <th style="width: 90px; text-align: center;">Enabled</th>
            <th style="width: 90px; text-align: center;">Required</th>
            <th style="width: 140px;">Condition</th>
            <th style="width: 70px; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody data-role="tbody"></tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 mt-3" style="padding: 0 var(--space-4); line-height:1.6;">
      <strong>Enabled:</strong> Field will appear on the registration form.<br>
      <strong>Required:</strong> Registrant must fill in this field to proceed.<br>
      <strong>Condition:</strong> Show field only when another field has a specific value (e.g., show size picker only when "Order T-Shirt" is checked).<br>
      <strong>Actions:</strong> Delete custom fields you've added.<br>
      <em>Changes are saved when you click "Save registration fields" above.</em>
    </p>
  `;

  // Insert panel into DOM: place before the footer (not at the end)
  const sectionFooter = eventsBox?.querySelector(".admin-section-footer");
  if (sectionFooter) {
    eventsBox.insertBefore(panelEl, sectionFooter);
  } else if (eventsBox) {
    eventsBox.appendChild(panelEl);
  } else if (root) {
    root.appendChild(panelEl);
  }

  const tbody = panelEl.querySelector("[data-role='tbody']");

  // Create modal for adding new fields
  const modalEl = document.createElement("div");
  modalEl.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:9999;display:none;";
  modalEl.innerHTML = `
    <div style="background:white;border-radius:8px;padding:24px;width:100%;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
      <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:16px;">Add Custom Field</h3>
      <form data-role="addFieldForm">
        <div style="margin-bottom:12px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;">Field Label *</label>
          <input type="text" name="label" required class="form-control" placeholder="e.g. T-Shirt Size" style="width:100%;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;">Field Type *</label>
          <select name="type" required class="form-control" style="width:100%;">
            <option value="text">Text</option>
            <option value="textarea">Text Area</option>
            <option value="email">Email</option>
            <option value="tel">Phone</option>
            <option value="date">Date</option>
            <option value="select">Dropdown</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </div>
        <div style="margin-bottom:12px;" data-role="optionsContainer" class="hidden">
          <label style="display:block;font-weight:500;margin-bottom:4px;">Options (one per line) *</label>
          <textarea name="options" class="form-control" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3" style="width:100%;"></textarea>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-weight:500;margin-bottom:4px;">Placeholder Text</label>
          <input type="text" name="placeholder" class="form-control" placeholder="Optional hint text" style="width:100%;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" name="required" />
            <span>Required field</span>
          </label>
        </div>
        <div style="margin-bottom:12px; padding:12px; background:#f8fafc; border-radius:6px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;">
            <input type="checkbox" name="hasCondition" data-role="hasConditionToggle" />
            <span style="font-weight:500;">Conditional visibility</span>
          </label>
          <div data-role="conditionConfig" class="hidden" style="margin-top:8px;">
            <p style="font-size:0.8rem;color:#64748b;margin-bottom:8px;">Show this field only when...</p>
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;">
              <select name="conditionField" class="form-control" style="width:100%;">
                <option value="">Select field...</option>
              </select>
              <select name="conditionOperator" class="form-control" style="width:100%;">
                <option value="equals">equals</option>
                <option value="not_equals">does not equal</option>
                <option value="not_empty">is not empty</option>
                <option value="is_empty">is empty</option>
              </select>
              <input type="text" name="conditionValue" class="form-control" placeholder="value" style="width:100%;" data-role="conditionValueInput" />
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn" data-role="cancelAddField">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Field</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modalEl);

  const addFieldForm = modalEl.querySelector("[data-role='addFieldForm']");
  const optionsContainer = modalEl.querySelector("[data-role='optionsContainer']");
  const typeSelect = addFieldForm?.querySelector("[name='type']");
  const hasConditionToggle = modalEl.querySelector("[data-role='hasConditionToggle']");
  const conditionConfig = modalEl.querySelector("[data-role='conditionConfig']");
  const conditionFieldSelect = addFieldForm?.querySelector("[name='conditionField']");
  const conditionOperatorSelect = addFieldForm?.querySelector("[name='conditionOperator']");
  const conditionValueInput = modalEl.querySelector("[data-role='conditionValueInput']");

  // Show/hide options field based on type
  typeSelect?.addEventListener("change", () => {
    if (typeSelect.value === "select") {
      optionsContainer?.classList.remove("hidden");
      optionsContainer?.querySelector("textarea")?.setAttribute("required", "");
    } else {
      optionsContainer?.classList.add("hidden");
      optionsContainer?.querySelector("textarea")?.removeAttribute("required");
    }
  });

  // Show/hide condition config
  hasConditionToggle?.addEventListener("change", () => {
    if (hasConditionToggle.checked) {
      conditionConfig?.classList.remove("hidden");
      populateConditionFields();
    } else {
      conditionConfig?.classList.add("hidden");
    }
  });

  // Show/hide value input based on operator
  conditionOperatorSelect?.addEventListener("change", () => {
    const op = conditionOperatorSelect.value;
    if (op === "not_empty" || op === "is_empty") {
      conditionValueInput.style.display = "none";
      conditionValueInput.value = "";
    } else {
      conditionValueInput.style.display = "";
    }
  });

  /**
   * Populate the condition field dropdown with available fields
   */
  function populateConditionFields() {
    if (!conditionFieldSelect || !baseFieldsConfig?.fields) return;

    const fields = getMergedFields().filter(f => f.enabled !== false);

    conditionFieldSelect.innerHTML = '<option value="">Select field...</option>';
    fields.forEach(field => {
      const label = replaceTerm(field.label);
      const opt = document.createElement("option");
      opt.value = field.id;
      opt.textContent = label;
      conditionFieldSelect.appendChild(opt);
    });
  }

  // Base field config loaded from server
  let baseFieldsConfig = null;
  // Current overrides for this competition
  let currentOverrides = {};
  // Custom fields added for this competition (not in base config)
  let customFields = [];

  function esc(s) {
    const fn = typeof escapeHtml === "function" ? escapeHtml : (x) => String(x ?? "");
    return fn(s);
  }

  function setDirty() {
    if (typeof markRegFieldsDirty === "function") markRegFieldsDirty();
  }

  /**
   * Generate a unique field ID from label
   */
  function generateFieldId(label) {
    const base = String(label || "field")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    // Check for collisions with existing fields
    const existingIds = new Set([
      ...(baseFieldsConfig?.fields || []).map(f => f.id),
      ...customFields.map(f => f.id),
    ]);

    let id = `custom_${base}`;
    let counter = 1;
    while (existingIds.has(id)) {
      id = `custom_${base}_${counter}`;
      counter++;
    }
    return id;
  }

  /**
   * Open the add field modal
   */
  function startAddField() {
    const competitionId = typeof getCurrentCompetitionId === "function"
      ? getCurrentCompetitionId()
      : null;

    if (!competitionId) {
      if (typeof showToast === "function") {
        showToast("Select a competition first.", "error");
      }
      return;
    }

    // Reset form
    addFieldForm?.reset();
    optionsContainer?.classList.add("hidden");
    conditionConfig?.classList.add("hidden");
    if (conditionValueInput) conditionValueInput.style.display = "";
    modalEl.style.display = "flex";
  }

  /**
   * Close the add field modal
   */
  function closeAddFieldModal() {
    modalEl.style.display = "none";
  }

  /**
   * Handle add field form submission
   */
  function handleAddField(e) {
    e.preventDefault();

    const formData = new FormData(addFieldForm);
    const label = String(formData.get("label") || "").trim();
    const type = String(formData.get("type") || "text");
    const placeholder = String(formData.get("placeholder") || "").trim();
    const required = formData.has("required");
    const optionsRaw = String(formData.get("options") || "").trim();
    const hasCondition = formData.has("hasCondition");
    const conditionField = String(formData.get("conditionField") || "").trim();
    const conditionOperator = String(formData.get("conditionOperator") || "equals").trim();
    const conditionValue = String(formData.get("conditionValue") || "").trim();

    if (!label) {
      if (typeof showToast === "function") {
        showToast("Field label is required.", "error");
      }
      return;
    }

    // Parse options for select fields
    let options = null;
    if (type === "select") {
      const lines = optionsRaw.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length === 0) {
        if (typeof showToast === "function") {
          showToast("At least one option is required for dropdown fields.", "error");
        }
        return;
      }
      options = [
        { value: "", label: "Select…", disabled: true },
        ...lines.map(l => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label: l })),
      ];
    }

    // Validate condition if enabled
    if (hasCondition && !conditionField) {
      if (typeof showToast === "function") {
        showToast("Please select a field for the condition.", "error");
      }
      return;
    }

    // Create the new field
    const newField = {
      id: generateFieldId(label),
      type,
      label,
      placeholder: placeholder || "",
      required,
      enabled: true,
      order: 1000 + customFields.length, // Put at end
      storage: "custom",
      width: "full",
      isNew: true, // Mark as newly added
    };

    if (options) {
      newField.options = options;
    }

    // Add condition if configured
    if (hasCondition && conditionField) {
      newField.condition = {
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue,
      };
    }

    // Add to custom fields
    customFields.push(newField);

    // Close modal and re-render
    closeAddFieldModal();
    render();
    setDirty();
    snapshotToParent();

    if (typeof showToast === "function") {
      showToast(`Field "${label}" added. Don't forget to save!`, "success");
    }
  }

  // Wire up modal events
  modalEl.querySelector("[data-role='cancelAddField']")?.addEventListener("click", closeAddFieldModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeAddFieldModal();
  });
  addFieldForm?.addEventListener("submit", handleAddField);

  /**
   * Merge base config with competition overrides and custom fields
   */
  function getMergedFields() {
    const baseFields = (baseFieldsConfig?.fields || []).map(field => {
      const override = currentOverrides[field.id] || {};
      return {
        ...field,
        enabled: override.enabled !== undefined ? override.enabled : field.enabled,
        required: override.required !== undefined ? override.required : field.required,
        order: override.order !== undefined ? override.order : field.order,
      };
    });

    // Combine base fields with custom fields
    const allFields = [...baseFields, ...customFields];

    return allFields.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get friendly type label
   */
  function getTypeLabel(type) {
    const labels = {
      'text': 'Text',
      'email': 'Email',
      'tel': 'Phone',
      'date': 'Date',
      'select': 'Dropdown',
      'textarea': 'Text Area',
      'checkbox': 'Checkbox',
      'coach-select': 'Coach Select',
    };
    return labels[type] || type;
  }

  /**
   * Replace terminology placeholders
   */
  function replaceTerm(text) {
    if (!text || !baseFieldsConfig?.terminology) return text;
    const terms = baseFieldsConfig.terminology;
    return String(text)
      .replace(/\{\{participant\}\}/gi, terms.participant || 'Participant')
      .replace(/\{\{participantPlural\}\}/gi, terms.participantPlural || 'Participants')
      .replace(/\{\{instructor\}\}/gi, terms.instructor || 'Instructor')
      .replace(/\{\{instructorPlural\}\}/gi, terms.instructorPlural || 'Instructors')
      .replace(/\{\{group\}\}/gi, terms.group || 'Group')
      .replace(/\{\{groupPlural\}\}/gi, terms.groupPlural || 'Groups');
  }

  /**
   * Render the fields table
   */
  function render() {
    if (!tbody) return;
    tbody.innerHTML = "";

    const competitionId = typeof getCurrentCompetitionId === "function"
      ? getCurrentCompetitionId()
      : null;

    if (!competitionId) {
      tbody.innerHTML = `
        <tr>
          <td class="px-4 py-6 text-sm text-gray-600" colspan="7">Select a competition to configure fields.</td>
        </tr>
      `;
      return;
    }

    if (!baseFieldsConfig?.fields) {
      tbody.innerHTML = `
        <tr>
          <td class="px-4 py-6 text-sm text-gray-600" colspan="7">Loading fields configuration...</td>
        </tr>
      `;
      return;
    }

    const fields = getMergedFields();

    if (fields.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="px-4 py-6 text-sm text-gray-600" colspan="7">No fields configured.</td>
        </tr>
      `;
      return;
    }

    fields.forEach((field, index) => {
      const tr = document.createElement("tr");
      tr.dataset.fieldId = field.id;
      tr.style.borderBottom = "1px solid rgba(0,0,0,0.05)";

      const isCore = field.storage === "column";
      const label = replaceTerm(field.label);

      // Some fields should not be disableable (first_name, last_name, email)
      const alwaysEnabled = ['first_name', 'last_name', 'email'].includes(field.id);

      // Determine field category:
      // - Core: storage="column" (required database fields)
      // - Optional: storage="custom" but defined in base config (can enable/disable)
      // - Custom: added via "Add field" (can delete)
      const isUserCustom = customFields.some(cf => cf.id === field.id);
      const isOptional = field.storage === "custom" && !isUserCustom;

      let fieldTypeLabel = 'Core field';
      if (isUserCustom) {
        fieldTypeLabel = 'Custom field';
      } else if (isOptional) {
        fieldTypeLabel = 'Optional field';
      }

      // Format condition display
      let conditionDisplay = '';
      if (field.condition && field.condition.field) {
        const triggerField = getMergedFields().find(f => f.id === field.condition.field);
        const triggerLabel = triggerField ? replaceTerm(triggerField.label) : field.condition.field;
        const op = field.condition.operator || 'equals';
        const opLabels = {
          'equals': '=',
          'not_equals': '≠',
          'not_empty': 'has value',
          'is_empty': 'is empty',
          'contains': 'contains',
          'not_contains': '!contains',
        };
        const opLabel = opLabels[op] || op;
        if (op === 'not_empty' || op === 'is_empty') {
          conditionDisplay = `<span style="font-size:0.75rem;color:#6b7280;">${esc(triggerLabel)} ${opLabel}</span>`;
        } else {
          conditionDisplay = `<span style="font-size:0.75rem;color:#6b7280;">${esc(triggerLabel)} ${opLabel} "${esc(field.condition.value)}"</span>`;
        }
      }

      tr.innerHTML = `
        <td class="px-4 py-2 text-gray-400 text-sm">${index + 1}</td>
        <td class="px-4 py-2">
          <div class="font-medium">${esc(label)}</div>
          ${field.helpText ? `<div class="text-xs text-gray-500">${esc(replaceTerm(field.helpText))}</div>` : ''}
          <span style="font-size: 0.7rem; color: #9ca3af; font-weight: 400;">${fieldTypeLabel}</span>
        </td>
        <td class="px-4 py-2 text-sm text-gray-600">${esc(getTypeLabel(field.type))}</td>
        <td class="px-4 py-2 text-center">
          <input
            type="checkbox"
            data-role="enabled"
            ${field.enabled ? 'checked' : ''}
            ${alwaysEnabled ? 'disabled title="This field is always required"' : ''}
          />
        </td>
        <td class="px-4 py-2 text-center">
          <input
            type="checkbox"
            data-role="required"
            ${field.required ? 'checked' : ''}
            ${!field.enabled ? 'disabled' : ''}
          />
        </td>
        <td class="px-4 py-2 text-sm">
          ${conditionDisplay || '<span style="color:#d1d5db;">—</span>'}
        </td>
        <td class="px-4 py-2 text-center">
          ${isUserCustom ? `<button type="button" data-role="deleteField" data-field-id="${esc(field.id)}" style="color:#ef4444;background:none;border:none;cursor:pointer;font-size:1.1rem;" title="Delete field">&times;</button>` : ''}
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  /**
   * Read current state from DOM and return overrides object
   */
  function readFromDom() {
    if (!tbody || !baseFieldsConfig?.fields) return {};

    const overrides = {};
    const rows = tbody.querySelectorAll("tr[data-field-id]");

    rows.forEach(tr => {
      const fieldId = tr.dataset.fieldId;
      if (!fieldId) return;

      const baseField = baseFieldsConfig.fields.find(f => f.id === fieldId);
      if (!baseField) return;

      const enabledCheckbox = tr.querySelector("[data-role='enabled']");
      const requiredCheckbox = tr.querySelector("[data-role='required']");

      const enabled = enabledCheckbox ? enabledCheckbox.checked : baseField.enabled;
      const required = requiredCheckbox ? requiredCheckbox.checked : baseField.required;

      // Only store if different from base config
      if (enabled !== baseField.enabled || required !== baseField.required) {
        overrides[fieldId] = {
          id: fieldId,
          enabled,
          required,
        };
      }
    });

    return overrides;
  }

  /**
   * Get the fields config in the format expected by the API
   */
  function getFieldsConfigForSave() {
    const overrides = readFromDom();

    // Convert overrides to array format
    const overrideFields = Object.values(overrides);

    // Include full custom field definitions (they need all properties saved)
    const customFieldsToSave = customFields.map(f => ({
      ...f,
      isNew: undefined, // Don't persist the isNew flag
    }));

    const allFields = [...overrideFields, ...customFieldsToSave];

    if (allFields.length === 0) {
      return null; // No overrides needed
    }

    return {
      fields: allFields,
      customFields: customFieldsToSave, // Store separately for easy identification
    };
  }

  /**
   * Load base field config from server
   */
  async function loadBaseConfig() {
    try {
      const res = await fetchJson(`${API.fields}`, { method: "GET" });
      if (res?.ok && res?.config) {
        baseFieldsConfig = res.config;
      }
    } catch (e) {
      console.warn("[formFields] Failed to load base config:", e);
      if (typeof showToast === "function") {
        showToast("Failed to load field configuration.", "error");
      }
    }
  }

  /**
   * Load and render with current competition's overrides
   */
  async function load() {
    const competitionId = typeof getCurrentCompetitionId === "function"
      ? getCurrentCompetitionId()
      : null;

    if (!competitionId) {
      render();
      return;
    }

    // Load base config if not already loaded
    if (!baseFieldsConfig) {
      await loadBaseConfig();
    }

    // Get current competition's field overrides
    const fieldsConfig = typeof getCurrentFieldsConfig === "function"
      ? getCurrentFieldsConfig()
      : null;

    // Convert array format to lookup object
    currentOverrides = {};
    customFields = [];

    if (fieldsConfig?.fields && Array.isArray(fieldsConfig.fields)) {
      for (const f of fieldsConfig.fields) {
        if (f.id) {
          // Check if this is a custom field (has storage: "custom" and full definition)
          // or just an override of a base field
          const isCustomField = f.storage === "custom" && f.type && f.label;
          const existsInBase = baseFieldsConfig?.fields?.some(bf => bf.id === f.id);

          if (isCustomField && !existsInBase) {
            customFields.push(f);
          } else {
            currentOverrides[f.id] = f;
          }
        }
      }
    }

    // Also check the dedicated customFields array if present
    if (fieldsConfig?.customFields && Array.isArray(fieldsConfig.customFields)) {
      for (const f of fieldsConfig.customFields) {
        if (f.id && !customFields.some(cf => cf.id === f.id)) {
          customFields.push(f);
        }
      }
    }

    render();
  }

  /**
   * Sync overrides to parent state (call before save)
   */
  function snapshotToParent() {
    const config = getFieldsConfigForSave();
    if (typeof setCurrentFieldsConfig === "function") {
      setCurrentFieldsConfig(config);
    }
    return config;
  }

  /**
   * Delete a custom field
   */
  function deleteCustomField(fieldId) {
    const idx = customFields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;

    const field = customFields[idx];
    if (!confirm(`Delete the field "${field.label}"?`)) return;

    customFields.splice(idx, 1);
    render();
    setDirty();
    snapshotToParent();

    if (typeof showToast === "function") {
      showToast(`Field "${field.label}" deleted. Don't forget to save!`, "success");
    }
  }

  // Event delegation for delete buttons
  panelEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-role='deleteField']");
    if (btn) {
      const fieldId = btn.dataset.fieldId;
      if (fieldId) deleteCustomField(fieldId);
    }
  });

  // Event delegation for checkboxes
  panelEl.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;

    const tr = target.closest("tr");
    if (!tr) return;

    // If enabled is unchecked, also uncheck and disable required
    if (target.dataset.role === "enabled") {
      const requiredCheckbox = tr.querySelector("[data-role='required']");
      if (requiredCheckbox) {
        if (!target.checked) {
          requiredCheckbox.checked = false;
          requiredCheckbox.disabled = true;
        } else {
          requiredCheckbox.disabled = false;
        }
      }
    }

    setDirty();

    // Update parent state immediately
    snapshotToParent();
  });

  return {
    panelEl,
    load,
    render,
    readFromDom,
    getFieldsConfigForSave,
    snapshotToParent,
    startAddField,
  };
}
