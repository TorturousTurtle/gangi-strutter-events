export function initRegistrationFieldsEventsTab({
  els,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  money,

  getCurrentCompetitionId,
  getCurrentEventCatalog,
  setCurrentEventCatalog,
  getCurrentRegConfig,
  setCurrentRegConfig,

  markRegFieldsDirty,
}) {
  let wired = false;
  let selectAllIncluded = null;
  let eventCategories = []; // Categories loaded from API
  let hasCategories = false; // Whether category column exists in DB
  let removedEventIds = new Set(); // Track events explicitly removed by admin

  function getEventsTableEls() {
    const tbody = els.availableRegEventsTbody;
    const table = tbody ? tbody.closest("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    return { table, thead, tbody };
  }

  function ensureSelectAllIncludedControl() {
    if (selectAllIncluded) return selectAllIncluded;

    const { thead } = getEventsTableEls();
    if (!thead) return null;

    // Include column is the 5th column (index 4): Event, Category, Group, Price, Include, Actions
    const ths = thead.querySelectorAll("th");
    const includedTh = ths && ths.length >= 5 ? ths[4] : null;
    if (!includedTh) return null;

    // Avoid adding twice
    const existing = includedTh.querySelector("input[data-role='selectAllIncluded']");
    if (existing) {
      selectAllIncluded = existing;
      return selectAllIncluded;
    }

    // Add Select All checkbox beneath header
    includedTh.style.textAlign = "center";
    includedTh.innerHTML = `
      <div class="admin-th-title" style="text-align:center;">Include</div>
      <label class="admin-th-select-all" style="justify-content:center;">
        <input type="checkbox" data-role="selectAllIncluded" />
        <span>Select All</span>
      </label>
    `;

    selectAllIncluded = includedTh.querySelector("input[data-role='selectAllIncluded']");
    return selectAllIncluded;
  }

  function getIncludedCheckboxes() {
    const tbody = els.availableRegEventsTbody;
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll("input[type='checkbox'][data-role='included']"));
  }

  function updateSelectAllIncludedState() {
    const ctl = ensureSelectAllIncludedControl();
    if (!ctl) return;

    const boxes = getIncludedCheckboxes();
    const total = boxes.length;
    const checked = boxes.filter((b) => b.checked).length;

    ctl.disabled = total === 0;
    ctl.indeterminate = total > 0 && checked > 0 && checked < total;
    ctl.checked = total > 0 && checked === total;
  }

  function setAllIncluded(value) {
    const boxes = getIncludedCheckboxes();
    for (const b of boxes) b.checked = !!value;

    if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;
    markRegFieldsDirty();
    updateSelectAllIncludedState();
  }

  function scrollToNewRow() {
    // After render, scroll to and focus the last newName input.
    requestAnimationFrame(() => {
      const tbody = els.availableRegEventsTbody;
      if (!tbody) return;

      const inputs = Array.from(tbody.querySelectorAll("input[data-role='newName']"));
      const last = inputs.length ? inputs[inputs.length - 1] : null;
      if (!last) return;

      last.scrollIntoView({ behavior: "smooth", block: "end" });
      last.focus();
    });
  }

  async function loadEventOptions() {
    const data = await fetchJson(API.listEventOptions, { method: "GET" });
    const list = Array.isArray(data?.eventOptions) ? data.eventOptions : [];

    // Store categories from API response
    eventCategories = Array.isArray(data?.categories) ? data.categories : [];
    hasCategories = !!data?.hasCategories;

    const catalog = list.map((o) => ({
      id: String(o.id),
      name: o.name,
      defaultPrice: Number(o.default_price ?? 0),
      category: o.category || null,
      categoryOrder: Number(o.category_order ?? 0),
      eventGroup: o.event_group || null,
    }));

    setCurrentEventCatalog(catalog);

    // Ensure currentRegConfig has an entry for every catalog event.
    // Existing config is preserved (price/included), but missing events are added as excluded by default.
    // Events that were explicitly removed by the admin are filtered out.
    const existing = Array.isArray(getCurrentRegConfig()) ? getCurrentRegConfig() : [];
    const existingById = new Map(
      existing
        .filter((r) => !r?.isNew && r?.optionId)
        .map((r) => [String(r.optionId), r])
    );

    // Load removed event IDs from saved config
    const savedRemovedIds = existing.find(r => r?._removedEventIds);
    if (savedRemovedIds?._removedEventIds) {
      removedEventIds = new Set(savedRemovedIds._removedEventIds);
    }

    const synced = [];

    // Keep any "new" (not-yet-in-catalog) rows first so they are still editable.
    for (const r of existing) {
      if (r?.isNew) synced.push(r);
    }

    for (const opt of catalog) {
      const id = String(opt.id);

      // Skip events that were explicitly removed
      if (removedEventIds.has(id)) continue;

      const prev = existingById.get(id);
      synced.push({
        optionId: id,
        price:
          prev && typeof prev.price === "number"
            ? prev.price
            : Number(opt.defaultPrice ?? 0),
        included: prev ? !!prev.included : false,
      });
    }

    // Store removed IDs in config so they persist
    if (removedEventIds.size > 0) {
      synced.push({ _removedEventIds: Array.from(removedEventIds) });
    }

    setCurrentRegConfig(synced);

    if (els.regEventAddBtn) {
      els.regEventAddBtn.disabled = !getCurrentCompetitionId();
    }

    ensureSelectAllIncludedControl();

    return catalog;
  }

  function renderRegFields() {
    if (!els.availableRegEventsTbody) return;

    const currentRegConfig = getCurrentRegConfig();
    const currentEventCatalog = getCurrentEventCatalog();

    els.availableRegEventsTbody.innerHTML = "";

    if (!Array.isArray(currentRegConfig) || currentRegConfig.length === 0) {
      els.availableRegEventsTbody.innerHTML = `
        <tr id="regEventsEmptyRow">
          <td class="px-4 py-6 text-sm text-gray-600" colspan="6">No registration events configured yet.</td>
        </tr>
      `;
      updateSelectAllIncludedState();
      return;
    }

    const catalog = Array.isArray(currentEventCatalog) ? currentEventCatalog : [];
    const catalogById = new Map(catalog.map((o) => [String(o.id), o]));

    // Build category dropdown options
    const categoryOptions = eventCategories.length > 0
      ? eventCategories.map(c => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("")
      : `
        <option value="solo">Solo Events</option>
        <option value="team">Team Events</option>
        <option value="specialty">Specialty Events</option>
      `;

    for (const row of currentRegConfig) {
      // Skip metadata entries
      if (row._removedEventIds) continue;

      const tr = document.createElement("tr");
      const isNew = !!row.isNew;

      if (!isNew) tr.dataset.optionId = String(row.optionId || "");

      const catalogEvent = catalogById.get(String(row.optionId));
      const eventName = catalogEvent?.name || "(Unknown event)";
      const eventCategory = row.category ?? catalogEvent?.category ?? "";
      const eventGroup = row.eventGroup ?? catalogEvent?.eventGroup ?? "";

      const eventCellHtml = isNew
        ? `
          <input
            class="form-control"
            data-role="newName"
            placeholder="New event name"
            value="${escapeHtml(row.newName || "")}"
          />
        `
        : `
          <div data-role="eventName" style="font-weight:600;">
            ${escapeHtml(eventName)}
          </div>
        `;

      // Category cell - only show dropdown if categories feature is available
      const categoryCellHtml = hasCategories
        ? `
          <select class="form-control" data-role="category" style="width:100%;font-size:0.75rem;padding:4px;">
            <option value="">—</option>
            ${categoryOptions}
          </select>
        `
        : `<span class="text-gray-400 text-xs">—</span>`;

      tr.innerHTML = `
        <td class="px-4 py-2">
          ${eventCellHtml}
        </td>
        <td class="px-4 py-2">
          ${categoryCellHtml}
        </td>
        <td class="px-4 py-2">
          <input class="form-control" data-role="eventGroup" type="text" placeholder="2-Baton" value="${escapeHtml(eventGroup)}" style="width:100%;font-size:0.75rem;padding:4px;" />
        </td>
        <td class="px-4 py-2">
          <div style="display:flex; align-items:center; gap:2px;">
            <span style="font-size:0.8rem;">$</span>
            <input class="form-control" data-role="price" type="number" min="0" step="0.01" value="${money(
              row.price
            )}" style="width:70px;font-size:0.8rem;padding:4px;" />
          </div>
        </td>
        <td class="px-4 py-2 text-center">
          <input data-role="included" type="checkbox" ${
            row.included ? "checked" : ""
          } />
        </td>
        <td class="px-4 py-2" style="text-align:center;">
          <button class="btn btn-danger btn-sm" data-role="delete" type="button" style="font-size:0.7rem;padding:2px 6px;" title="Remove event">×</button>
        </td>
      `;

      // Set the category select value after insertion
      const categorySelect = tr.querySelector('[data-role="category"]');
      if (categorySelect && eventCategory) {
        categorySelect.value = eventCategory;
      }

      els.availableRegEventsTbody.appendChild(tr);
    }
    updateSelectAllIncludedState();
  }

  function readRegFieldsFromDom() {
    if (!els.availableRegEventsTbody) return [];

    const rows = Array.from(
      els.availableRegEventsTbody.querySelectorAll("tr")
    ).filter((tr) => tr.id !== "regEventsEmptyRow");

    const out = [];
    for (const tr of rows) {
      const newNameEl = tr.querySelector('[data-role="newName"]');
      const price = tr.querySelector('[data-role="price"]');
      const inc = tr.querySelector('[data-role="included"]');
      const categoryEl = tr.querySelector('[data-role="category"]');
      const eventGroupEl = tr.querySelector('[data-role="eventGroup"]');

      const optionId = tr.dataset.optionId ? String(tr.dataset.optionId) : "";
      const newName = newNameEl ? String(newNameEl.value || "").trim() : "";
      const isNew = !!newNameEl;
      const category = categoryEl ? String(categoryEl.value || "") : "";
      const eventGroup = eventGroupEl ? String(eventGroupEl.value || "").trim() : "";

      out.push({
        optionId,
        isNew,
        newName,
        price: price ? Number(price.value || 0) : 0,
        included: inc ? !!inc.checked : false,
        category: category || null,
        eventGroup: eventGroup || null,
      });
    }

    // Preserve removed event IDs so they persist through save
    if (removedEventIds.size > 0) {
      out.push({ _removedEventIds: Array.from(removedEventIds) });
    }

    return out;
  }

  function snapshotFromDom() {
    setCurrentRegConfig(readRegFieldsFromDom());
  }

  function wire() {
    if (wired) return;
    wired = true;

    const ctl = ensureSelectAllIncludedControl();
    ctl?.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      setAllIncluded(t.checked);
    });

    els.regEventAddBtn?.addEventListener("click", () => {
      if (!getCurrentCompetitionId()) {
        showToast("Select a competition first.", "error");
        return;
      }

      snapshotFromDom();

      setCurrentRegConfig([
        ...getCurrentRegConfig(),
        {
          isNew: true,
          newName: "",
          optionId: "",
          price: 0,
          included: true,
        },
      ]);

      if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;
      renderRegFields();
      markRegFieldsDirty();
      scrollToNewRow();
    });

    els.availableRegEventsTbody?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.dataset.role !== "delete") return;

      const tr = btn.closest("tr");
      if (!tr) return;

      const allRows = Array.from(
        els.availableRegEventsTbody.querySelectorAll("tr")
      ).filter((r) => r.id !== "regEventsEmptyRow" && !r.dataset.removedMeta);

      const idx = allRows.indexOf(tr);
      if (idx < 0) return;

      const config = getCurrentRegConfig().filter(r => !r._removedEventIds);
      const row = config[idx];

      // For existing events (not new), confirm before removing and track the removal
      if (row && !row.isNew && row.optionId) {
        const eventNameEl = tr.querySelector('[data-role="eventName"]');
        const eventName = eventNameEl ? eventNameEl.textContent.trim() : "this event";
        if (!confirm(`Remove "${eventName}" from the registration form?\n\nThis will remove it from the available events list. You can add it back later if needed.`)) {
          return;
        }
        // Track this event as removed so it doesn't reappear on reload
        removedEventIds.add(String(row.optionId));
      }

      const next = config.filter((_, i) => i !== idx);

      // Add removed IDs metadata back
      if (removedEventIds.size > 0) {
        next.push({ _removedEventIds: Array.from(removedEventIds) });
      }

      setCurrentRegConfig(next);

      markRegFieldsDirty();
      renderRegFields();
      updateSelectAllIncludedState();
    });

    els.availableRegEventsTbody?.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches('[data-role="included"]')) {
        if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;
        markRegFieldsDirty();
        updateSelectAllIncludedState();
      }
    });

    els.availableRegEventsTbody?.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches('[data-role="newName"], [data-role="price"], [data-role="eventGroup"]')) {
        markRegFieldsDirty();
      }
    });
  }

  wire();

  return {
    loadEventOptions,
    renderRegFields,
    readRegFieldsFromDom,
    snapshotFromDom,
  };
}
