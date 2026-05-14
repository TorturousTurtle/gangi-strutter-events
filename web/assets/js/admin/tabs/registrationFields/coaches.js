export function initRegistrationFieldsCoachesTab({
  root,
  eventsBox,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCurrentCompetitionId,
  markRegFieldsDirty,
} = {}) {
  const panelEl = document.createElement("div");
  panelEl.setAttribute("data-regfields-panel", "coaches");
  panelEl.className = "hidden";

  panelEl.innerHTML = `
    <div class="admin-table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Coach Name</th>
            <th style="width: 100px;">Code</th>
            <th style="width: 130px; text-align: center;">
              <div>On Registration</div>
              <label class="admin-th-select-all">
                <input type="checkbox" data-role="selectAllOnReg" />
                <span>Select All</span>
              </label>
            </th>
            <th style="width: 150px; text-align: center;">
              <div>Print on Sheets</div>
              <label class="admin-th-select-all">
                <input type="checkbox" data-role="selectAllOnJudge" />
                <span>Select All</span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody data-role="tbody"></tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 mt-3" style="padding: 0 var(--space-4);">
      <strong>On Registration:</strong> Coach appears as an option on the registration form.<br>
      <strong>Print on Sheets:</strong> Coach's code will be printed on judging sheets for identification.
    </p>
    <div class="text-sm text-gray-600 mt-2" data-role="hint"></div>
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
  const hint = panelEl.querySelector("[data-role='hint']");
  const selectAllOnReg = panelEl.querySelector("[data-role='selectAllOnReg']");
  const selectAllOnJudge = panelEl.querySelector("[data-role='selectAllOnJudge']");

  // New-coach row state
  let pendingNewCoach = null; // { name: string, internal_code: string }

  function esc(s) {
    const fn = typeof escapeHtml === "function" ? escapeHtml : (x) => String(x ?? "");
    return fn(s);
  }

  function setDirty(on) {
    if (on && typeof markRegFieldsDirty === "function") markRegFieldsDirty();
  }

  function getRowCheckboxes(role) {
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll(`input[type='checkbox'][data-role='${role}']`));
  }

  function updateSelectAllStates() {
    const regBoxes = getRowCheckboxes("onReg");
    const judgeBoxes = getRowCheckboxes("onJudge");

    if (selectAllOnReg) {
      const total = regBoxes.length;
      const checked = regBoxes.filter((b) => b.checked).length;
      selectAllOnReg.indeterminate = total > 0 && checked > 0 && checked < total;
      selectAllOnReg.checked = total > 0 && checked === total;
      selectAllOnReg.disabled = total === 0;
    }

    if (selectAllOnJudge) {
      const total = judgeBoxes.length;
      const checked = judgeBoxes.filter((b) => b.checked).length;
      selectAllOnJudge.indeterminate = total > 0 && checked > 0 && checked < total;
      selectAllOnJudge.checked = total > 0 && checked === total;
      selectAllOnJudge.disabled = total === 0;
    }
  }

  function setAll(role, value) {
    const boxes = getRowCheckboxes(role);
    for (const b of boxes) b.checked = !!value;
    setDirty(true);
    updateSelectAllStates();
  }

  function ensureNewCoachRowVisible() {
    if (!tbody) return;

    // Don’t add duplicates
    const existing = tbody.querySelector("tr[data-role='newCoachRow']");
    if (existing) {
      const nameInput = existing.querySelector("input[data-role='newCoachName']");
      nameInput?.focus();
      return;
    }

    const tr = document.createElement("tr");
    tr.dataset.role = "newCoachRow";

    const nameVal = String(pendingNewCoach?.name || "");
    const codeVal = String(pendingNewCoach?.internal_code || "");

    tr.innerHTML = `
      <td class="px-4 py-2">
        <input class="form-control" data-role="newCoachName" placeholder="Coach name" value="${esc(
          nameVal
        )}" />
      </td>
      <td class="px-4 py-2">
        <input class="form-control" data-role="newCoachCode" placeholder="Code" value="${esc(
          codeVal
        )}" style="max-width:140px;" />
      </td>
      <td class="px-4 py-2" colspan="2" style="text-align:right;">
        <button class="btn" type="button" data-role="cancelNewCoach">Cancel</button>
      </td>
    `;

    // Put the row at the top
    tbody.prepend(tr);

    // Focus name
    const nameInput = tr.querySelector("input[data-role='newCoachName']");
    nameInput?.focus();
  }

  function startAddCoach() {
    pendingNewCoach = pendingNewCoach || { name: "", internal_code: "" };
    ensureNewCoachRowVisible();
  }

  function render(rows) {
    if (!tbody) return;
    tbody.innerHTML = "";

    const competitionId =
      typeof getCurrentCompetitionId === "function" ? getCurrentCompetitionId() : null;
    if (!competitionId) {
      if (hint) hint.textContent = "Select a competition first.";
    } else if (hint) {
      hint.textContent = "";
    }

    const list = Array.isArray(rows) ? rows : [];

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="px-4 py-6 text-sm text-gray-600" colspan="4">No coaches found.</td>
        </tr>
      `;
      updateSelectAllStates();
      return;
    }

    // If we’re adding a new coach, show the new-coach input row above the list.
    if (pendingNewCoach) {
      ensureNewCoachRowVisible();
    }

    for (const c of list) {
      const tr = document.createElement("tr");
      const coachId = String(c.coach_id ?? c.id ?? "");
      tr.dataset.coachId = coachId;

      const name = String(c.name ?? "");
      const code = String(c.internal_code ?? "");
      const onReg = Number(c.include_on_registration ?? 0) === 1;
      const onJudge = Number(c.include_code_on_judging_sheet ?? 0) === 1;

      tr.innerHTML = `
        <td class="px-4 py-2">${esc(name)}</td>
        <td class="px-4 py-2" style="font-family:monospace; color:var(--neutral-600);">${esc(code)}</td>
        <td class="px-4 py-2 text-center">
          <input type="checkbox" data-role="onReg" ${onReg ? "checked" : ""} />
        </td>
        <td class="px-4 py-2 text-center">
          <input type="checkbox" data-role="onJudge" ${onJudge ? "checked" : ""} />
        </td>
      `;

      tbody.appendChild(tr);
    }

    updateSelectAllStates();
  }

  function readFromDom() {
    if (!tbody) return [];
    const trs = Array.from(tbody.querySelectorAll("tr"));
    const out = [];

    for (const tr of trs) {
      const coachId = tr.dataset.coachId ? Number(tr.dataset.coachId) : 0;
      if (!coachId) continue;

      const onReg = tr.querySelector("[data-role='onReg']");
      const onJudge = tr.querySelector("[data-role='onJudge']");

      out.push({
        coach_id: coachId,
        include_on_registration: !!onReg?.checked,
        include_code_on_judging_sheet: !!onJudge?.checked,
        sort_order: null,
      });
    }

    return out;
  }

  function canWire() {
    return API && fetchJson && typeof fetchJson === "function";
  }

  function getSaveCoachUrl() {
    // Allow multiple key names so wiring is resilient.
    return (
      API?.coachesSave ||
      API?.saveCoach ||
      API?.coaches_save ||
      API?.coachSave ||
      null
    );
  }

  async function maybeCreateCoachFromPendingRow() {
    if (!pendingNewCoach) return null;

    const name = String(pendingNewCoach.name || "").trim();
    const internalCode = String(pendingNewCoach.internal_code || "").trim();

    // If user hasn't entered anything, don't do anything.
    if (!name && !internalCode) return null;

    if (!name) {
      if (typeof showToast === "function") showToast("Coach name is required.", "error");
      throw new Error("Coach name is required.");
    }

    if (!internalCode) {
      if (typeof showToast === "function") showToast("Coach code is required.", "error");
      throw new Error("Coach code is required.");
    }

    const url = getSaveCoachUrl();
    if (!url) {
      if (typeof showToast === "function") showToast("Missing API endpoint for saving coaches.", "error");
      throw new Error("Missing API endpoint for saving coaches.");
    }

    const res = await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        internal_code: internalCode,
        is_active: 1,
      }),
    });

    if (!res?.ok) {
      const msg = res?.error || res?.message || "Failed to save coach.";
      if (typeof showToast === "function") showToast(msg, "error");
      throw new Error(msg);
    }

    // Clear pending row state/UI on success.
    pendingNewCoach = null;
    const row = tbody?.querySelector("tr[data-role='newCoachRow']");
    row?.remove();

    // Return id if provided (supports a few common shapes)
    return res?.id ?? res?.coach?.id ?? null;
  }

  async function load() {
    const competitionId =
      typeof getCurrentCompetitionId === "function" ? getCurrentCompetitionId() : null;
    if (!competitionId) {
      render([]);
      return;
    }

    if (!canWire()) {
      if (typeof showToast === "function")
        showToast("Coaches API wiring not ready yet.", "error");
      render([]);
      return;
    }

    try {
      const qs = new URLSearchParams({ competition_id: String(competitionId) }).toString();
      const data = await fetchJson(`${API.listCompetitionCoaches}?${qs}`, { method: "GET" });
      const rows = Array.isArray(data?.coaches) ? data.coaches : [];
      render(rows);
      updateSelectAllStates();
    } catch (e) {
      console.warn("[coaches] load failed:", e);
      if (typeof showToast === "function") showToast("Failed to load coaches.", "error");
    }
  }

  async function save() {
    const competitionId =
      typeof getCurrentCompetitionId === "function" ? getCurrentCompetitionId() : null;
    if (!competitionId) {
      if (typeof showToast === "function") showToast("Select a competition first.", "error");
      return;
    }

    if (!canWire()) {
      if (typeof showToast === "function")
        showToast("Coaches API wiring not ready yet.", "error");
      return;
    }

    // If a new coach row is present, create it in the master coaches table first.
    // IMPORTANT: do NOT reload before reading checkbox state, or we lose the user's edits.
    await maybeCreateCoachFromPendingRow();

    const items = readFromDom().filter(
      (it) => it.include_on_registration || it.include_code_on_judging_sheet
    );

    try {
      await fetchJson(API.saveCompetitionCoaches, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: Number(competitionId),
          items,
        }),
      });

      if (typeof showToast === "function") showToast("Coaches saved.", "success");
      await load();
    } catch (e) {
      console.warn("[coaches] save failed:", e);
      if (typeof showToast === "function") showToast("Failed to save coaches.", "error");
    }
  }

  panelEl.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches("input[type='checkbox']")) {
      setDirty(true);
      updateSelectAllStates();
    }
  });

  panelEl.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button");
    if (!btn) return;

    if (btn.dataset.role === "cancelNewCoach") {
      pendingNewCoach = null;
      const row = tbody?.querySelector("tr[data-role='newCoachRow']");
      row?.remove();
      return;
    }
  });

  panelEl.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.matches("input[data-role='newCoachName']")) {
      pendingNewCoach = pendingNewCoach || { name: "", internal_code: "" };
      pendingNewCoach.name = String(t.value || "");
    }

    if (t.matches("input[data-role='newCoachCode']")) {
      pendingNewCoach = pendingNewCoach || { name: "", internal_code: "" };
      pendingNewCoach.internal_code = String(t.value || "");
    }
  });

  selectAllOnReg?.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    setAll("onReg", target.checked);
  });

  selectAllOnJudge?.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    setAll("onJudge", target.checked);
  });

  // Don’t auto-load unless wiring is present; subtabs.js will call load() after it passes deps.
  if (canWire()) load();

  return {
    panelEl,
    load,
    render,
    readFromDom,
    save,
    startAddCoach,
  };
}
