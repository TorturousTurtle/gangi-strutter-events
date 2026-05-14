// web/assets/js/admin/exportModal.js
// Advanced export modal with column selection, date range filters, and grouping options

/**
 * Initialize the export modal module
 * @param {Object} config
 * @returns {Object} Module API
 */
export function initExportModal({ showToast }) {
  const MODAL_ID = "export-modal";
  const FORM_ID = "export-modal-form";

  // Available columns for export (matches admin-list.php response)
  const AVAILABLE_COLUMNS = [
    { id: "id", label: "ID", default: true },
    { id: "firstName", label: "First Name", default: true },
    { id: "lastName", label: "Last Name", default: true },
    { id: "email", label: "Email", default: true },
    { id: "homePhone", label: "Phone", default: false },
    { id: "coachName", label: "Coach Name", default: true },
    { id: "teamName", label: "Team", default: false },
    { id: "ageDivision", label: "Age Division", default: true },
    { id: "dateOfBirth", label: "Date of Birth", default: false },
    { id: "gender", label: "Gender", default: false },
    { id: "events", label: "Events", default: true },
    { id: "eventSubtotal", label: "Event Subtotal", default: false },
    { id: "facilityFee", label: "Facility Fee", default: false },
    { id: "optionalProductName", label: "Product Name", default: false },
    { id: "optionalProductPrice", label: "Product Price", default: false },
    { id: "eventTotal", label: "Total", default: true },
    { id: "createdAt", label: "Registration Date", default: true },
  ];

  const GROUP_BY_OPTIONS = [
    { id: "", label: "None (flat list)" },
    { id: "coach", label: "Coach" },
    { id: "ageDivision", label: "Age Division" },
    { id: "event", label: "Event" },
  ];

  let modalEl = null;

  /**
   * Get the competition ID from the picker
   */
  function getSelectedCompetitionId() {
    const sel = document.getElementById("competitionSelect");
    return sel ? String(sel.value || "").trim() : "";
  }

  /**
   * Build the modal HTML
   */
  function buildModalHtml() {
    const columnCheckboxes = AVAILABLE_COLUMNS.map(
      (col) => `
      <label class="export-modal-checkbox">
        <input type="checkbox" name="columns" value="${col.id}" ${col.default ? "checked" : ""} />
        <span>${col.label}</span>
      </label>
    `
    ).join("");

    const groupByOptions = GROUP_BY_OPTIONS.map(
      (opt) => `<option value="${opt.id}">${opt.label}</option>`
    ).join("");

    return `
      <div id="${MODAL_ID}" class="export-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <div class="export-modal">
          <div class="export-modal-header">
            <h3 id="export-modal-title">Advanced CSV Export</h3>
            <button type="button" class="export-modal-close" aria-label="Close">&times;</button>
          </div>

          <form id="${FORM_ID}" class="export-modal-body">
            <div class="export-modal-section">
              <h4>Columns to Include</h4>
              <div class="export-modal-columns">
                ${columnCheckboxes}
              </div>
              <div class="export-modal-column-actions">
                <button type="button" class="btn btn-outline btn-sm" data-action="select-all">Select All</button>
                <button type="button" class="btn btn-outline btn-sm" data-action="select-none">Select None</button>
                <button type="button" class="btn btn-outline btn-sm" data-action="select-default">Reset to Default</button>
              </div>
            </div>

            <div class="export-modal-section">
              <h4>Date Range Filter</h4>
              <p class="export-modal-hint">Leave blank to include all registrations.</p>
              <div class="export-modal-dates">
                <div class="export-modal-field">
                  <label for="export-date-from">From</label>
                  <input type="date" id="export-date-from" name="dateFrom" class="form-control" />
                </div>
                <div class="export-modal-field">
                  <label for="export-date-to">To</label>
                  <input type="date" id="export-date-to" name="dateTo" class="form-control" />
                </div>
              </div>
            </div>

            <div class="export-modal-section">
              <h4>Group By</h4>
              <p class="export-modal-hint">Optionally group and sort rows in the export.</p>
              <select id="export-group-by" name="groupBy" class="form-control">
                ${groupByOptions}
              </select>
            </div>
          </form>

          <div class="export-modal-footer">
            <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="export">Export CSV</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open the export modal
   */
  function openModal() {
    const competitionId = getSelectedCompetitionId();
    if (!competitionId) {
      showToast("Select a competition first.", "error");
      return;
    }

    // Create modal if it doesn't exist
    if (!modalEl) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildModalHtml();
      modalEl = wrapper.firstElementChild;
      document.body.appendChild(modalEl);

      // Wire up event handlers
      wireModalEvents();
    }

    // Reset form to defaults
    resetForm();

    // Show modal
    modalEl.classList.add("is-open");
    document.body.classList.add("modal-open");

    // Focus first checkbox
    const firstCheckbox = modalEl.querySelector('input[type="checkbox"]');
    if (firstCheckbox) firstCheckbox.focus();
  }

  /**
   * Close the export modal
   */
  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    }
  }

  /**
   * Reset form to default values
   */
  function resetForm() {
    const form = document.getElementById(FORM_ID);
    if (!form) return;

    // Reset columns to defaults
    const checkboxes = form.querySelectorAll('input[name="columns"]');
    checkboxes.forEach((cb) => {
      const col = AVAILABLE_COLUMNS.find((c) => c.id === cb.value);
      cb.checked = col?.default || false;
    });

    // Clear date filters
    form.querySelector('[name="dateFrom"]').value = "";
    form.querySelector('[name="dateTo"]').value = "";

    // Reset group by
    form.querySelector('[name="groupBy"]').value = "";
  }

  /**
   * Wire up modal event handlers
   */
  function wireModalEvents() {
    if (!modalEl) return;

    // Close button
    const closeBtn = modalEl.querySelector(".export-modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Cancel button
    const cancelBtn = modalEl.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener("click", closeModal);
    }

    // Export button
    const exportBtn = modalEl.querySelector('[data-action="export"]');
    if (exportBtn) {
      exportBtn.addEventListener("click", handleExport);
    }

    // Column selection actions
    const selectAllBtn = modalEl.querySelector('[data-action="select-all"]');
    const selectNoneBtn = modalEl.querySelector('[data-action="select-none"]');
    const selectDefaultBtn = modalEl.querySelector('[data-action="select-default"]');

    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        const checkboxes = modalEl.querySelectorAll('input[name="columns"]');
        checkboxes.forEach((cb) => (cb.checked = true));
      });
    }

    if (selectNoneBtn) {
      selectNoneBtn.addEventListener("click", () => {
        const checkboxes = modalEl.querySelectorAll('input[name="columns"]');
        checkboxes.forEach((cb) => (cb.checked = false));
      });
    }

    if (selectDefaultBtn) {
      selectDefaultBtn.addEventListener("click", () => {
        const checkboxes = modalEl.querySelectorAll('input[name="columns"]');
        checkboxes.forEach((cb) => {
          const col = AVAILABLE_COLUMNS.find((c) => c.id === cb.value);
          cb.checked = col?.default || false;
        });
      });
    }

    // Close on overlay click
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) {
        closeModal();
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalEl?.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  /**
   * Handle export button click
   */
  function handleExport() {
    const form = document.getElementById(FORM_ID);
    if (!form) return;

    const competitionId = getSelectedCompetitionId();
    if (!competitionId) {
      showToast("Select a competition first.", "error");
      return;
    }

    // Gather selected columns
    const selectedColumns = Array.from(form.querySelectorAll('input[name="columns"]:checked'))
      .map((cb) => cb.value);

    if (selectedColumns.length === 0) {
      showToast("Please select at least one column to export.", "error");
      return;
    }

    // Gather date filters
    const dateFrom = form.querySelector('[name="dateFrom"]').value;
    const dateTo = form.querySelector('[name="dateTo"]').value;

    // Gather group by
    const groupBy = form.querySelector('[name="groupBy"]').value;

    // Build URL
    const url = new URL("../api/admin-export-advanced.php", window.location.href);
    url.searchParams.set("competition_id", competitionId);
    url.searchParams.set("columns", selectedColumns.join(","));

    if (dateFrom) url.searchParams.set("date_from", dateFrom);
    if (dateTo) url.searchParams.set("date_to", dateTo);
    if (groupBy) url.searchParams.set("group_by", groupBy);

    // Trigger download
    window.open(url.toString(), "_blank", "noopener");

    // Close modal
    closeModal();
  }

  return {
    openModal,
    closeModal,
    AVAILABLE_COLUMNS,
  };
}
