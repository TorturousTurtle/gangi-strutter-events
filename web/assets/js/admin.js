// web/assets/js/admin.js
import { showToast } from "./toast.js";

// ===== API endpoints =====
const API = {
  listCompetitions: "/api/competitions.list.php",
  getCompetition: "/api/competitions.get.php",
  saveCompetition: "/api/competitions.save.php",
  deleteCompetition: "/api/competitions.delete.php",
  listRegistrations: "/api/admin-list.php",
  listEventOptions: "/api/event_options.list.php",
};
// ===== Event Options loader (Registration Fields tab) =====
async function loadEventOptions() {
  const data = await fetchJson(API.listEventOptions, { method: "GET" });
  const list = Array.isArray(data?.eventOptions) ? data.eventOptions : [];

  // Normalize to the shape our UI expects
  currentEventCatalog = list.map((o) => ({
    id: String(o.id),
    name: o.name,
    defaultPrice: Number(o.default_price ?? 0),
  }));

  if (els.regEventAddBtn)
    els.regEventAddBtn.disabled = !currentCompetitionId || currentEventCatalog.length === 0;

  return currentEventCatalog;
}

// ===== DOM =====
const els = {
  // Competition form (Current Competition tab)
  form: document.getElementById("competitionForm"),
  err: document.getElementById("competitionError"),

  // Competition inputs
  name: document.getElementById("competitionName"),
  location: document.getElementById("competitionLocation"),
  start: document.getElementById("competitionStartDate"),
  end: document.getElementById("competitionEndDate"),
  deadline: document.getElementById("competitionDeadline"),
  facilityFee: document.getElementById("competitionFacilityFee"),
  active: document.getElementById("competitionActive"),
  desc: document.getElementById("competitionDescription"),

  // Picker + actions
  picker: document.getElementById("competitionSelect"),
  createBtn: document.getElementById("competitionNewBtn"),
  deleteBtn: document.getElementById("competitionDeleteBtn"),

  // Registration Fields tab
  regEventNewBtn: document.getElementById("regEventNewBtn"),
  regEventAddBtn: document.getElementById("regEventAddBtn"),
  regEventsSaveBtn: document.getElementById("regEventsSaveBtn"),
  availableRegEventsTbody: document.getElementById("availableRegEventsTbody"),

  // Registrants (Overview tab)
  count: document.getElementById("registrantCount"),
  count2: document.getElementById("registrantCount2"),
  empty: document.getElementById("emptyState"),
  tableWrap: document.getElementById("tableWrap"),
  tbody: document.getElementById("registrationsTbody"),
  clearBtn: document.getElementById("clearBtn"),

  // Detailed Registrants tab
  detailedTbody: document.getElementById("registrationsDetailedTbody"),
  detailedEmptyRow: document.getElementById("registrationsDetailedEmptyRow"),
};

// ===== Helpers =====
function showInlineError(msg) {
  if (!els.err) return;
  els.err.textContent = msg || "";
  els.err.classList.toggle("hidden", !msg);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "";
}

function getRevenueValueEl() {
  // If you later add id="revenueValue" in HTML, we’ll use it
  const byId = document.getElementById("revenueValue");
  if (byId) return byId;

  // Fallback: Revenue card is the 2nd metric value in the overview cards
  const vals = document.querySelectorAll(".admin-card .admin-metric .value");
  return vals && vals.length >= 2 ? vals[1] : null;
}

function renderRegFields() {
  if (!els.availableRegEventsTbody) return;

  els.availableRegEventsTbody.innerHTML = "";

  if (!Array.isArray(currentRegConfig) || currentRegConfig.length === 0) {
    els.availableRegEventsTbody.innerHTML = `
      <tr id="regEventsEmptyRow">
        <td class="px-4 py-6 text-sm text-gray-600" colspan="4">No registration events configured yet.</td>
      </tr>
    `;
    return;
  }

  const catalog = Array.isArray(currentEventCatalog) ? currentEventCatalog : [];

  for (const row of currentRegConfig) {
    const tr = document.createElement("tr");

    const isNew = !!row.isNew;

    const optionsHtml = catalog
      .map((o) => {
        const id = String(o.id ?? "");
        const selected = String(row.optionId ?? "") === id ? "selected" : "";
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(o.name ?? "")}</option>`;
      })
      .join("");

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
        <select class="form-control" data-role="option">
          <option value="">Select…</option>
          ${optionsHtml}
        </select>
      `;

    tr.innerHTML = `
      <td class="px-4 py-2">
        ${eventCellHtml}
      </td>
      <td class="px-4 py-2">
        <div style="display:flex; align-items:center; gap:0.25rem;">
          <span>$</span>
          <input class="form-control" data-role="price" type="number" min="0" step="0.01" value="${money(row.price)}" style="max-width:120px;" />
        </div>
      </td>
      <td class="px-4 py-2">
        <input data-role="included" type="checkbox" ${row.included ? "checked" : ""} />
      </td>
      <td class="px-4 py-2" style="text-align:right;">
        <button class="btn btn-danger" data-role="delete" type="button">Delete</button>
      </td>
    `;

    els.availableRegEventsTbody.appendChild(tr);
  }
}

function readRegFieldsFromDom() {
  if (!els.availableRegEventsTbody) return [];

  const rows = Array.from(els.availableRegEventsTbody.querySelectorAll("tr")).filter(
    (tr) => tr.id !== "regEventsEmptyRow"
  );

  const out = [];
  for (const tr of rows) {
    const sel = tr.querySelector('[data-role="option"]');
    const newNameEl = tr.querySelector('[data-role="newName"]');
    const price = tr.querySelector('[data-role="price"]');
    const inc = tr.querySelector('[data-role="included"]');

    const optionId = sel ? String(sel.value || "") : "";
    const newName = newNameEl ? String(newNameEl.value || "").trim() : "";
    const isNew = !!newNameEl;

    out.push({
      optionId,
      isNew,
      newName,
      price: price ? Number(price.value || 0) : 0,
      included: inc ? !!inc.checked : false,
    });
  }

  return out;
}

function toDatetimeLocalValue(isoOrSql) {
  if (!isoOrSql) return "";
  // Accept either ISO or "YYYY-MM-DD HH:MM:SS"
  const normalized = String(isoOrSql).includes("T")
    ? String(isoOrSql)
    : String(isoOrSql).replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function fetchJson(url, opts = {}) {
  return fetch(url, opts).then(async (res) => {
    const text = await res.text();
    let data = null;
    let parseFailed = false;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON
      parseFailed = true;
    }

    // If the server returned OK but not JSON, treat it as an error (helps catch PHP warnings/notices)
    if (res.ok && parseFailed) {
      const preview = (text || "").slice(0, 300);
      const err = new Error(`Expected JSON but got non-JSON response from ${url}: ${preview}`);
      err.status = res.status;
      err.text = text;
      throw err;
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        text ||
        `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  });
}

function setFormEnabled(enabled) {
  if (!els.form) return;
  const controls = els.form.querySelectorAll("input, select, textarea, button");
  controls.forEach((c) => {
    // allow tab buttons etc. outside form; this only affects inside form
    if (c.id === "competitionNewBtn") return;
    c.disabled = !enabled;
  });
}

// ===== Registrations loader (Overview tab) =====
async function loadRegistrations(competitionId) {
  const qs = new URLSearchParams();
  if (competitionId) qs.set("competition_id", String(competitionId));

  const url = qs.toString()
    ? `${API.listRegistrations}?${qs.toString()}`
    : API.listRegistrations;

  console.log("[admin] loadRegistrations:", url);
  const data = await fetchJson(url, { method: "GET" });
  const regs = Array.isArray(data?.registrations) ? data.registrations : [];
  console.log("[admin] registrations loaded:", regs.length, data);

  renderRegistrations(regs);
  renderRegistrationsDetailed(regs);
  return regs;
}

// ===== Rendering: Registrations table (Overview tab) =====
function renderRegistrations(regs) {
  const n = Array.isArray(regs) ? regs.length : 0;
  const revenue = (Array.isArray(regs) ? regs : []).reduce((sum, r) => {
    const v = Number(r?.eventTotal ?? r?.event_total ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

const revEl = getRevenueValueEl();
if (revEl) revEl.textContent = `$${revenue.toFixed(2)}`;

  if (els.count) els.count.textContent = String(n);
  if (els.count2) els.count2.textContent = String(n);
  if (!els.tbody) return;

  els.tbody.innerHTML = "";

  if (n === 0) {
    els.empty?.classList.remove("hidden");
    els.tableWrap?.classList.add("hidden");
    return;
  }

  els.empty?.classList.add("hidden");
  els.tableWrap?.classList.remove("hidden");

  regs.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";

    const created = r.createdAt
      ? new Date(String(r.createdAt).replace(" ", "T")).toLocaleDateString()
      : "";

    // Events can come from dummy data (eventSelections) or DB (event_selections / eventSelections)
    const selections =
      Array.isArray(r.eventSelections) ? r.eventSelections :
      Array.isArray(r.event_selections) ? r.event_selections :
      [];

    const eventsText = selections
      .map((e) => (e && e.name ? String(e.name) : ""))
      .filter(Boolean)
      .join(", ");

    const amountNum = Number(r.eventTotal ?? r.event_total ?? r.total ?? 0);
    const amountText = Number.isFinite(amountNum) ? `$${amountNum.toFixed(2)}` : "$0.00";

    // Row separators: apply border-y on each cell (reliable with border-collapse)
    tr.innerHTML = `
      <td class="px-4 py-2 font-medium text-gray-900 whitespace-nowrap border-y border-gray-200">
        ${escapeHtml(`${r.firstName} ${r.lastName}`)}
      </td>
      <td class="px-4 py-2 text-gray-700 whitespace-nowrap border-y border-gray-200">
        ${escapeHtml(r.ageDivision || "")}
      </td>
      <td class="px-4 py-2 text-gray-700 border-y border-gray-200">
        ${escapeHtml(eventsText)}
      </td>
      <td class="px-4 py-2 text-gray-700 whitespace-nowrap border-y border-gray-200">
        ${escapeHtml(amountText)}
      </td>
      <td class="px-4 py-2 text-sm text-gray-600 whitespace-nowrap border-y border-gray-200">
        ${escapeHtml(created)}
      </td>
    `;

    els.tbody.appendChild(tr);
  });
}

// ===== Rendering: Detailed Registrants table (Detailed Registrants tab) =====
function renderRegistrationsDetailed(regs) {
  const tbodyEl = els.detailedTbody || document.getElementById("registrationsDetailedTbody");
  const emptyRowEl = els.detailedEmptyRow || document.getElementById("registrationsDetailedEmptyRow");

  if (!tbodyEl) {
    console.warn('[admin] Detailed registrants tbody not found (expected id="registrationsDetailedTbody").');
    return;
  }

  const tbody = tbodyEl;
  const list = Array.isArray(regs) ? regs : [];

  tbody.innerHTML = "";

  if (list.length === 0) {
    if (emptyRowEl) tbody.appendChild(emptyRowEl);
    return;
  }

  list.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";

    const created = r.createdAt
      ? new Date(String(r.createdAt).replace(" ", "T")).toLocaleDateString()
      : "";

    const amountSubtotalNum = Number(r.eventSubtotal ?? r.event_subtotal ?? 0);
    const amountFeeNum = Number(r.facilityFee ?? r.facility_fee ?? 0);
    const amountTotalNum = Number(r.eventTotal ?? r.event_total ?? 0);

    const subtotalText = Number.isFinite(amountSubtotalNum) ? `$${amountSubtotalNum.toFixed(2)}` : "";
    const feeText = Number.isFinite(amountFeeNum) ? `$${amountFeeNum.toFixed(2)}` : "";
    const totalText = Number.isFinite(amountTotalNum) ? `$${amountTotalNum.toFixed(2)}` : "";

    // Event selections: show just the event names (comma-separated)
    const selections =
      Array.isArray(r.eventSelections) ? r.eventSelections :
      Array.isArray(r.event_selections) ? r.event_selections :
      [];

    const eventsText = selections
      .map((e) => (e && e.name ? String(e.name) : ""))
      .filter(Boolean)
      .join(", ");

    const td = (v, wide = false) =>
      `<td class="px-4 py-2 text-gray-700 ${wide ? "" : "whitespace-nowrap"} border-y border-gray-200">${escapeHtml(v ?? "")}</td>`;

    tr.innerHTML = [
      td(String(r.id ?? "")),
      // td(String(r.competitionId ?? r.competition_id ?? "")),
      td(String(r.firstName ?? "")),
      td(String(r.lastName ?? "")),
      td(String(r.coachName ?? "")),
      td(String(r.teamName ?? r.team_name ?? "")),
      td(String(r.dateOfBirth ?? r.date_of_birth ?? "")),
      td(String(r.gender ?? "")),
      td(String(r.ageDivision ?? "")),
      td(String(r.email ?? "")),
      td(String(r.homePhone ?? r.home_phone ?? "")),
      td(eventsText, true),
      td(subtotalText),
      td(feeText),
      td(totalText),
      td(created),
    ].join("");

    tbody.appendChild(tr);
  });
}

// ===== Competitions (Current Competition tab) =====
let competitionsCache = [];
let currentCompetitionId = null;

// Registration fields state (stored on the competition row)
let currentEventCatalog = []; // [{ id, name, defaultPrice }]
let currentRegConfig = [];    // [{ optionId, price, included, isNew?, newName? }]

// Registration Fields (tab) dirty state
let regFieldsDirty = false;
let regFieldsNudged = false;

function markRegFieldsDirty() {
  regFieldsDirty = true;
  if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;

  // Nudge once per edit session
  if (!regFieldsNudged) {
    showToast('You have unsaved registration field changes. Click “Save registration fields”.', 'info');
    regFieldsNudged = true;
  }
}

function clearRegFieldsDirty() {
  regFieldsDirty = false;
  regFieldsNudged = false;
}

function clearEventForm() {
  if (els.name) els.name.value = "";
  if (els.location) els.location.value = "";
  if (els.start) els.start.value = "";
  if (els.end) els.end.value = "";
  if (els.desc) els.desc.value = "";
  if (els.active) els.active.checked = false;
  if (els.deadline) els.deadline.value = "";
  if (els.deleteBtn) els.deleteBtn.disabled = true;
}

function renderCompetitionToForm(c) {
  if (!c) return;

  if (els.name) els.name.value = c.name || "";
  if (els.location) els.location.value = c.location || "";
  if (els.start) els.start.value = toDatetimeLocalValue(c.start_at);
  if (els.end) els.end.value = toDatetimeLocalValue(c.end_at);
  if (els.deadline)
    els.deadline.value = toDatetimeLocalValue(c.registration_deadline);
  if (els.desc) els.desc.value = c.description || "";
  if (els.active) els.active.checked = Boolean(c.isActive);

  if (els.deleteBtn) els.deleteBtn.disabled = !c.id;
  if (els.facilityFee) {
    const fee = Number(c.facility_fee ?? c.facilityFee ?? 0);
    els.facilityFee.value = Number.isFinite(fee) && fee > 0 ? fee.toFixed(2) : "";
  }
}

function readCompetitionFromForm() {
  const facilityFeeRaw = els.facilityFee ? String(els.facilityFee.value || "").trim() : "";
  const facilityFee = facilityFeeRaw === "" ? 0 : Number(facilityFeeRaw);
  const payload = {
    id: currentCompetitionId ? Number(currentCompetitionId) : 0,
    name: els.name ? els.name.value.trim() : "",
    location: els.location ? els.location.value.trim() : "",
    startDate: els.start ? els.start.value : "",
    endDate: els.end ? els.end.value : "",
    registrationDeadline: els.deadline ? els.deadline.value : "",
    description: els.desc ? els.desc.value.trim() : "",
    facilityFee: Number.isFinite(facilityFee) && facilityFee >= 0 ? facilityFee : 0,
    isActive: els.active ? !!els.active.checked : false,
  };

  return payload;
}

function renderCompetitionPicker(list) {
  if (!els.picker) return;

  const opts = [];
  opts.push(`<option value="">Select a competition…</option>`);

  list.forEach((c) => {
    const label = c.isActive ? `${c.name} (Active)` : c.name;
    opts.push(
      `<option value="${escapeHtml(String(c.id))}">${escapeHtml(label)}</option>`
    );
  });

  els.picker.innerHTML = opts.join("");
}

async function loadCompetitionsList({ autoSelectActive = true } = {}) {
  const data = await fetchJson(API.listCompetitions, { method: "GET" });
  const list = Array.isArray(data?.competitions) ? data.competitions : [];

  competitionsCache = list;
  renderCompetitionPicker(list);

  if (!autoSelectActive || !els.picker) return;

  // Prefer active competition; fallback to first item
  const active = list.find((c) => c.isActive) || list[0];
  if (active) {
    els.picker.value = String(active.id);
    await loadCompetitionById(active.id);
  } else {
    clearEventForm();
    currentCompetitionId = null;
  }
}

async function loadCompetitionById(id) {
  if (!id) return;
  showInlineError(null);

  const qs = new URLSearchParams({ id: String(id) }).toString();
  const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });

  if (!data?.competition) throw new Error("No competition returned from API.");

  currentCompetitionId = Number(data.competition.id || 0) || null;
  if (els.deleteBtn) els.deleteBtn.disabled = !currentCompetitionId;
  renderCompetitionToForm(data.competition);

  // Registration fields:
  // - catalog comes from DB event_options
  // - config is stored on the competition row
  currentRegConfig = Array.isArray(data.competition.registrationOptions)
    ? data.competition.registrationOptions
    : [];
  clearRegFieldsDirty();

  await loadEventOptions();

  if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = !currentCompetitionId;

  renderRegFields();

  // Overview tab: load registrants from DB for this competition
  console.log("[admin] currentCompetitionId:", currentCompetitionId);
  await loadRegistrations(currentCompetitionId);
}

async function saveCompetition(payload) {
  if (!payload.name) throw new Error("Competition name is required.");
  if (!payload.startDate) throw new Error("Start date/time is required.");
  if (!payload.registrationDeadline)
    throw new Error("Registration deadline is required.");

  const data = await fetchJson(API.saveCompetition, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data;
}

async function deleteCompetition(id) {
  const data = await fetchJson(API.deleteCompetition, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: Number(id) }),
  });
  return data;
}

// ===== Wire up events =====
els.picker?.addEventListener("change", async () => {
  const id = els.picker.value;
  if (!id) {
    currentCompetitionId = null;
    clearEventForm();
    return;
  }

  try {
    setFormEnabled(false);
    await loadCompetitionById(id);
  } catch (e) {
    console.error(e);
    showInlineError(e.message || "Failed to load competition.");
  } finally {
    setFormEnabled(true);
  }
});

els.createBtn?.addEventListener("click", () => {
  showInlineError(null);
  currentCompetitionId = null;
  if (els.picker) els.picker.value = "";
  clearEventForm();
  // default: active unchecked; you can choose to default it to true if you want
  if (els.active) els.active.checked = true;
  showToast("Ready to create a new competition.");
});

els.deleteBtn?.addEventListener("click", async () => {
  showInlineError(null);

  const id = currentCompetitionId;

  if (!id) {
    showInlineError("Select an existing competition to delete.");
    return;
  }

  if (!confirm("Delete this competition? This cannot be undone.")) return;

  try {
    setFormEnabled(false);
    const res = await deleteCompetition(id);
    if (!res?.ok) throw new Error(res?.error || "Delete failed.");

    showToast("Competition deleted.");
    await loadCompetitionsList({ autoSelectActive: true });
  } catch (e) {
    console.error(e);
    showInlineError(e.message || "Failed to delete competition.");
  } finally {
    setFormEnabled(true);
  }
});

els.form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showInlineError(null);

  try {
    setFormEnabled(false);

    const payload = readCompetitionFromForm();
    const res = await saveCompetition(payload);

    if (!res?.ok) throw new Error(res?.error || "Failed to save competition.");

    // If API returns created/updated competition id, keep it selected
    const savedId = res?.id ? Number(res.id) : payload.id;
    showToast("Competition saved.");

    await loadCompetitionsList({ autoSelectActive: false });

    if (savedId && els.picker) {
      els.picker.value = String(savedId);
      await loadCompetitionById(savedId);
    }
  } catch (e2) {
    console.error(e2);
    showInlineError(e2.message || "Failed to save competition.");
  } finally {
    setFormEnabled(true);
  }
});

// ===== Clear registrants (still stubbed for now) =====
els.clearBtn?.addEventListener("click", async () => {
  if (!confirm("Clear ALL registrants? This cannot be undone.")) return;

  // TODO: wire to real endpoint later
  renderRegistrations([]);
  showToast("Registrants cleared (stub).");
});

// ===== Registration Fields tab wiring =====
els.regEventNewBtn?.addEventListener("click", () => {
  if (!currentCompetitionId) {
    showToast("Select a competition first.", "error");
    return;
  }

  currentRegConfig = readRegFieldsFromDom();

  currentRegConfig.push({
    isNew: true,
    newName: "",
    optionId: "",
    price: 0,
    included: true,
  });

  if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;
  renderRegFields();
  markRegFieldsDirty();
});

els.regEventAddBtn?.addEventListener("click", () => {
  if (!currentCompetitionId) return;
  if (!Array.isArray(currentEventCatalog) || currentEventCatalog.length === 0) return;

  // Preserve any in-progress edits by snapshotting current DOM state first
  currentRegConfig = readRegFieldsFromDom();

  // Add a new blank row: user chooses from dropdown
  currentRegConfig = [
    ...(currentRegConfig || []),
    { optionId: "", price: 0, included: true },
  ];

  if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = false;
  renderRegFields();
  markRegFieldsDirty();
});

els.availableRegEventsTbody?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.dataset.role !== "delete") return;

  const tr = btn.closest("tr");
  if (!tr) return;

  const allRows = Array.from(els.availableRegEventsTbody.querySelectorAll("tr")).filter(
    (r) => r.id !== "regEventsEmptyRow"
  );

  const idx = allRows.indexOf(tr);
  if (idx >= 0) {
    currentRegConfig.splice(idx, 1);
    markRegFieldsDirty();
    renderRegFields();
  }
});

els.availableRegEventsTbody?.addEventListener("change", (e) => {
  markRegFieldsDirty();

  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // If user selected an option, default the price (but don’t overwrite if user already typed a price)
  if (target.matches('[data-role="option"]')) {
    const tr = target.closest("tr");
    const priceInput = tr?.querySelector('[data-role="price"]');

    const selectedId = String(target.value || "");
    const opt = (currentEventCatalog || []).find((o) => String(o.id) === selectedId);

    if (opt && priceInput) {
      const currentVal = String(priceInput.value || "").trim();
      if (currentVal === "" || Number(currentVal) === 0) {
        priceInput.value = money(opt.defaultPrice ?? 0);
      }
    }
  }
});

els.availableRegEventsTbody?.addEventListener("input", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-role="newName"], [data-role="price"]')) {
    markRegFieldsDirty();
  }
});

els.regEventsSaveBtn?.addEventListener("click", async () => {
  if (!currentCompetitionId) return;

  try {
    // Snapshot current config from DOM
    currentRegConfig = readRegFieldsFromDom();

    // Save by updating the competition row (API must accept these fields)
    const payload = readCompetitionFromForm();
    payload.id = Number(currentCompetitionId);
    payload.eventCatalog = currentEventCatalog;
    payload.registrationOptions = currentRegConfig;

    const res = await saveCompetition(payload);
    if (!res?.ok) throw new Error(res?.error || "Save failed.");

    showToast("Registration fields saved.", "success");
    if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = true;
    clearRegFieldsDirty();
  } catch (err) {
    console.error(err);
    showToast("Failed to save registration fields.", "error");
  }
});

// Warn if the user leaves the page with unsaved Registration Fields changes.
window.addEventListener("beforeunload", (e) => {
  if (!regFieldsDirty) return;
  e.preventDefault();
  e.returnValue = "";
});
 
// ===== Init =====
(async function init() {
  try {
    renderRegistrations([]);

    // Current Competition tab: load competitions list
    // If PHP endpoints aren't built yet, this will error — and that's fine for now.
    await loadCompetitionsList({ autoSelectActive: true });
  } catch (e) {
    console.warn("Init warning:", e);
    // Don’t hard-fail the whole admin screen because the competition API isn’t live yet.
    showInlineError(
      "Competition API not connected yet. Once PHP endpoints exist, this will load competitions."
    );
  }
})();


(function wireDownloadables() {
  const panel = document.getElementById("tab-downloadables");
  if (!panel) return;

  const errorEl = document.getElementById("downloadablesError");
  const buttons = Array.from(panel.querySelectorAll("button[data-report]"));

  // Helper to show a simple error message inside the tab.
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  function getSelectedCompetitionId() {
    const sel = document.getElementById("competitionSelect");
    const v = sel ? String(sel.value || "").trim() : "";
    return v;
  }

  // Map report keys -> endpoints (placeholders for now)
  const endpoints = {
    // existing endpoint (already linked on Overview tab)
    registrants_csv: "../api/admin-export.php",

    // TODO: implement these PHP endpoints
    registrants_print: "../api/admin/reports/registrants.print.php",

    // Printable Judging Sheets (currently generated client-side)
    coach_checkin: "../api/admin/reports/judging-sheets.print.php",

    // Score Sheet Labels (currently generated client-side)
    score_sheet_labels: "../api/admin/reports/score-sheet-labels.print.php",
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      clearError();

      const key = btn.getAttribute("data-report");
      if (!key) {
        showError("Unknown report type.");
        return;
      }

      const competitionId = getSelectedCompetitionId();
      if (!competitionId) {
        showError("Select a competition first (Current Event tab).");
        return;
      }

      // For now: generate judging sheets client-side as a print-ready HTML document.
      // Later we can move this to a server-side PDF generator.
      if (key === "coach_checkin") {
        try {
          btn.disabled = true;
          btn.textContent = "Generating…";
          await generatePrintableJudgingSheets(competitionId);
        } catch (e) {
          console.error(e);
          showError(e?.message || "Failed to generate judging sheets.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Printable Judging Sheets";
        }
        return;
      }

      if (key === "score_sheet_labels") {
        try {
          btn.disabled = true;
          btn.textContent = "Generating…";
          await generateScoreSheetLabels(competitionId);
        } catch (e) {
          console.error(e);
          showError(e?.message || "Failed to generate score sheet labels.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Score Sheet Labels";
        }
        return;
      }

      if (key === "registrants_print") {
        try {
          btn.disabled = true;
          btn.textContent = "Generating…";
          await generatePrintableRegistrantList(competitionId);
        } catch (e) {
          console.error(e);
          showError(e?.message || "Failed to generate printable registrant list.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Printable Registrant List";
        }
        return;
      }

      // Default behavior for other report types
      if (!endpoints[key]) {
        showError("Unknown report type.");
        return;
      }

      // Build URL; pass competition_id for future PHP endpoints.
      const url = new URL(endpoints[key], window.location.href);
      url.searchParams.set("competition_id", competitionId);

      // Open in a new tab so CSV/PDF/print pages are easy.
      window.open(url.toString(), "_blank", "noopener");
    });
  });
})();

// ------------------------------
// Print helpers (Downloadables)
// ------------------------------
function chunkArray(arr, size) {
  const out = [];
  const n = Array.isArray(arr) ? arr.length : 0;
  for (let i = 0; i < n; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatCompetitionDate(c) {
  // Try to handle both DB shape and UI/API shapes.
  const raw =
    c?.start_at ||
    c?.startAt ||
    c?.start_date ||
    c?.startDate ||
    c?.start ||
    c?.start_time ||
    c?.startTime ||
    c?.date ||
    "";

  if (!raw) return "";

  // Accept ISO or "YYYY-MM-DD HH:MM:SS".
  const s = String(raw).trim();
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return s;

  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getRegistrationsForCompetition(competitionId) {
  const qs = new URLSearchParams();
  if (competitionId) qs.set("competition_id", String(competitionId));

  const url = qs.toString()
    ? `${API.listRegistrations}?${qs.toString()}`
    : API.listRegistrations;

  return fetchJson(url, { method: "GET" }).then((data) =>
    Array.isArray(data?.registrations) ? data.registrations : []
  );
}

function extractEventSelections(reg) {
  const selections =
    Array.isArray(reg?.eventSelections) ? reg.eventSelections :
    Array.isArray(reg?.event_selections) ? reg.event_selections :
    [];

  return (selections || [])
    .map((e) => (e && e.name ? String(e.name) : ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

function openPrintWindow(html) {
  // NOTE: do NOT pass "noopener" here.
  // Some browsers will still open the tab/window but return `null`, which means we can't write HTML into it.
  const w = window.open("", "_blank");
  if (!w) {
    showToast("Popup blocked. Allow popups for this site to print reports.", "error");
    return;
  }

  // Reduce risk of the child window being able to reach back to the opener.
  try { w.opener = null; } catch (_) {}

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

function buildJudgingSheetsHtml({ competition, pages }) {
  const compDate = formatCompetitionDate(competition);

  const compName =
    competition?.name ??
    competition?.competitionName ??
    competition?.title ??
    "";

  const compLoc =
    competition?.location ??
    competition?.venue ??
    competition?.city ??
    "";

  // Columns copied from the sample judging sheet format.
  const scoreCols = [
    "Vital",
    "Time",
    "Drops",
    "Other",
    "Variety",
    "Difficulty",
    "Speed",
    "Smooth",
    "Show",
    "Sub",
    "Penalty",
    "Total",
    "Final",
  ];

  const thead = `
    <thead>
      <tr>
        <th class="col-team">Team</th>
        <th class="col-id">ID</th>
        <th class="col-name">Twirler</th>
        ${scoreCols.map((c) => `<th class="col-score col-score-head">${escapeHtml(c)}</th>`).join("")}
      </tr>
    </thead>
  `;

  const style = `
    <style>
      @page { size: letter landscape; margin: 0.5in; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      /* Printable area for Letter Landscape with 0.5in margins is 10in x 7.5in */
      .page {
        page-break-after: always;
        break-after: page;
        height: 7.5in;
        min-height: 7.5in;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto 1fr auto;
        overflow: hidden;
        // padding: 0.10in 0.20in;
      }
      .hdr { display:flex; align-items:flex-end; justify-content:space-between; gap: 12px; }
      .title { font-size: 20px; font-weight: 800; margin: 0; }
      .subtitle { font-size: 16px; font-weight: 800; margin: 2px 0 0 0; }
      .judge { font-size: 12px; margin: 0; white-space: nowrap; }

      table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 5px 4px; font-size: 12px; line-height: 1.35; }
      th { text-align: center; font-weight: 700; }
      th.col-score-head { font-size: 9px; letter-spacing: 0.1px; }
      thead tr { border-bottom: 3px solid #000; }
      thead th { border-bottom: 3px solid #000; }

      .col-team { width: 17%; text-align: left; }
      .col-id { width: 4%; text-align: left; }
      .col-name { width: 18%; text-align: left; }
      .col-score { width: 4.5%; text-align: center; }

      .table-wrap { align-self: start; min-height: 0; overflow: hidden; }
      .footer {
        align-self: end;
        padding-top: 10px;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .muted { opacity: 0.85; }

      /* Ensure header repeats visually per page */
      .page-header { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 6px; }
      .page-header, .table-wrap, .footer { break-inside: avoid; page-break-inside: avoid; }
      table { break-inside: avoid; page-break-inside: avoid; }

      /* Print rules */
      @media print {
        .pages .page + .page { page-break-before: always; break-before: page; }
        .no-print { display: none !important; }
      }
    </style>
  `;

  const docHead = `
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Printable Judging Sheets</title>
      ${style}
    </head>
  `;

  const docBody = pages
    .map((p, idx) => {
      const rowsHtml = (p.rows || [])
        .map((r) => {
          const team = String(r.teamName || "");
          const id = String(r.registrationId || "");
          const name = String(r.contestantName || "");

          // Blank scoring cells — judges write these in.
          const blanks = scoreCols.map(() => `<td></td>`).join("");

          return `
            <tr>
              <td class="col-team">${escapeHtml(team)}</td>
              <td class="col-id">${escapeHtml(id)}</td>
              <td class="col-name">${escapeHtml(name)}</td>
              ${blanks}
            </tr>
          `;
        })
        .join("");

      return `
        <div class="page">
          <div class="page-header">
            <div class="hdr">
              <div>
                <p class="title">${escapeHtml(p.eventName)}</p>
                <p class="subtitle">${escapeHtml(p.ageDivision)}</p>
              </div>
              <p class="judge">Judge: ________________________________</p>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              ${thead}
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="muted">${escapeHtml(compDate || "(No date)")}</div>
            <div class="muted">${escapeHtml(String(compName || "(No competition name)"))}</div>
            <div class="muted">${escapeHtml(String(compLoc || "(No location)"))}</div>
          </div>
        </div>
      `;
    })
    .join("");

  const controls = `
    <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
      <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
    </div>
  `;

  return `
    <!doctype html>
    <html>
      ${docHead}
      <body>
        ${controls}
        <div class="pages">
          ${docBody}
        </div>
      </body>
    </html>
  `;
}

async function generatePrintableJudgingSheets(competitionId) {
  // Competition metadata: prefer cache, but fall back to API if missing or missing fields
  let competition = (competitionsCache || []).find((c) => String(c.id) === String(competitionId)) || null;

  const needsFetch =
    !competition ||
    !competition.name ||
    !competition.location ||
    !competition.start_at;

  if (needsFetch) {
    try {
      const qs = new URLSearchParams({ id: String(competitionId) }).toString();
      const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });
      if (data?.competition) competition = data.competition;
    } catch (e) {
      console.warn("[admin] failed to load competition for print:", e);
    }
  }

  const regs = await getRegistrationsForCompetition(competitionId);

  // Build groups of rows by (eventName + ageDivision)
  const groups = new Map();

  regs.forEach((r) => {
    const ageDivision = String(r?.ageDivision ?? r?.age_division ?? "").trim() || "(No age division)";
    const selections = extractEventSelections(r);

    const teamName = String(r?.teamName ?? r?.team_name ?? "").trim();
    const registrationId = String(r?.id ?? "").trim();
    const contestantName = `${String(r?.firstName ?? r?.first_name ?? "").trim()} ${String(r?.lastName ?? r?.last_name ?? "").trim()}`.trim();

    selections.forEach((eventNameRaw) => {
      const eventName = String(eventNameRaw || "").trim();
      if (!eventName) return;

      const key = `${eventName}|||${ageDivision}`;
      if (!groups.has(key)) groups.set(key, { eventName, ageDivision, rows: [] });

      groups.get(key).rows.push({
        teamName,
        registrationId,
        contestantName,
      });
    });
  });

  // Sort groups and rows for a predictable print order
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const en = a.eventName.localeCompare(b.eventName);
    if (en !== 0) return en;
    return a.ageDivision.localeCompare(b.ageDivision);
  });

  sortedGroups.forEach((g) => {
    g.rows.sort((a, b) => a.contestantName.localeCompare(b.contestantName));
  });

  // Pagination: tune this number once you see real data + printer margins.
  const ROWS_PER_PAGE = 22;

  const pages = [];
  for (const g of sortedGroups) {
    const chunks = chunkArray(g.rows, ROWS_PER_PAGE);
    chunks.forEach((rows) => {
      pages.push({
        eventName: g.eventName,
        ageDivision: g.ageDivision,
        rows,
      });
    });
  }

  if (pages.length === 0) {
    showToast("No judging sheets to generate (no registrations / no event selections).", "info");
    return;
  }

  const html = buildJudgingSheetsHtml({ competition: competition || {}, pages });
  openPrintWindow(html);
}


// ------------------------------
// Score Sheet Labels (30-up)
// ------------------------------
function buildScoreSheetLabelsHtml({ competition, sheets }) {
  const compDate = formatCompetitionDate(competition);

  const compName =
    competition?.name ??
    competition?.competitionName ??
    competition?.title ??
    "";

  const compLoc =
    competition?.location ??
    competition?.venue ??
    competition?.city ??
    "";

  // Avery 5160 / 8160 style defaults: 3 columns x 10 rows (30 labels)
  // Label size: 2.625" x 1"; horiz gap ~0.125"; top margin ~0.5"; side margin ~0.1875".
  const style = `
    <style>
      @page { size: letter portrait; margin: 0; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }

      .sheet { width: 8.5in; height: 11in; box-sizing: border-box; page-break-after: always; break-after: page; }

      /* Printable label grid positioned like Avery 5160 */
      .grid {
        box-sizing: border-box;
        position: relative;
        width: 8.5in;
        height: 11in;
        padding-top: 0.50in;
        padding-left: 0.1875in;
        padding-right: 0.1875in;
      }

      .labels {
        display: grid;
        grid-template-columns: repeat(3, 2.625in);
        grid-auto-rows: 1in;
        column-gap: 0.125in;
        row-gap: 0in;
      }

      .label {
        box-sizing: border-box;
        padding: 0.08in 0.10in;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .name { font-size: 12px; font-weight: 800; margin: 2px 0 0 0; line-height: 1.05; }
      .event { font-size: 11px; font-weight: 700; margin: 2px 0 0 0; line-height: 1.05; }
      .comp { font-size: 10px; font-weight: 700; margin: 2px 0 0 0; line-height: 1.05; }
      .meta { font-size: 10px; font-weight: 700; margin: 1px 0 0 0; line-height: 1.05; }

      .muted { opacity: 0.9; }

      @media print {
        .no-print { display: none !important; }
        .sheet:last-of-type { page-break-after: auto; break-after: auto; }
      }
    </style>
  `;

  const docHead = `
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Score Sheet Labels</title>
      ${style}
    </head>
  `;

  const controls = `
    <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
      <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
    </div>
  `;

  // Each sheet contains exactly 30 label slots.
  // We DO carry over across events so the output is continuous (no wasted blank labels between events).
  const body = (sheets || [])
    .map((sheet) => {
      const slots = Array.from({ length: 30 }).map((_, i) => sheet.labels[i] || null);

      const labelHtml = slots
        .map((l) => {
          if (!l) return `<div class="label"></div>`;

          const age = l.ageDivision ? String(l.ageDivision).trim() : "";
          // Put age division on the same line as the event (no leading apostrophe).
          const eventLine = age ? `${String(l.eventName || "").trim()} (${age})` : String(l.eventName || "").trim();

          return `
            <div class="label">
              <p class="name">${escapeHtml(l.name)}</p>
              <p class="event">${escapeHtml(eventLine)}</p>
              <p class="comp">${escapeHtml(String(compName || ""))}</p>
              <p class="meta muted">${escapeHtml(String(compDate || ""))} ${escapeHtml(String(compLoc || ""))}</p>
            </div>
          `;
        })
        .join("");

      return `
        <div class="sheet">
          <div class="grid">
            <div class="labels">
              ${labelHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      ${docHead}
      <body>
        ${controls}
        ${body}
      </body>
    </html>
  `;
}

async function generateScoreSheetLabels(competitionId) {
  // Load competition details (need name, location, start_at)
  let competition = (competitionsCache || []).find((c) => String(c.id) === String(competitionId)) || null;

  const needsFetch =
    !competition ||
    !competition.name ||
    !competition.location ||
    !competition.start_at;

  if (needsFetch) {
    try {
      const qs = new URLSearchParams({ id: String(competitionId) }).toString();
      const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });
      if (data?.competition) competition = data.competition;
    } catch (e) {
      console.warn("[admin] failed to load competition for labels:", e);
    }
  }

  const regs = await getRegistrationsForCompetition(competitionId);

  // Build label items for each (registrant x selected event)
  const items = [];
  regs.forEach((r) => {
    const ageDivision = String(r?.ageDivision ?? r?.age_division ?? "").trim();
    const selections = extractEventSelections(r);

    const name = `${String(r?.firstName ?? r?.first_name ?? "").trim()} ${String(r?.lastName ?? r?.last_name ?? "").trim()}`.trim();

    selections.forEach((eventNameRaw) => {
      const eventName = String(eventNameRaw || "").trim();
      if (!eventName) return;

      items.push({
        eventName,
        ageDivision,
        name,
      });
    });
  });

  if (items.length === 0) {
    showToast("No labels to generate (no registrations / no event selections).", "info");
    return;
  }

  // Continuous output (no per-event page breaks): sort then chunk into 30-up sheets.
  // Sort order: event name, then age division, then twirler name.
  items.sort((a, b) => {
    const en = String(a.eventName || "").localeCompare(String(b.eventName || ""));
    if (en !== 0) return en;

    const ad = String(a.ageDivision || "").localeCompare(String(b.ageDivision || ""));
    if (ad !== 0) return ad;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  const sheets = chunkArray(items, 30).map((labels) => ({ labels }));

  const html = buildScoreSheetLabelsHtml({ competition: competition || {}, sheets });
  openPrintWindow(html);
}


// ------------------------------
// Printable Registrant List (Detailed Registrants table in portrait)
// ------------------------------
function buildPrintableRegistrantListHtml({ competition, regs }) {
  const compDate = formatCompetitionDate(competition);
  const compName = competition?.name ?? competition?.competitionName ?? competition?.title ?? "";
  const compLoc = competition?.location ?? competition?.venue ?? competition?.city ?? "";

  const style = `
    <style>
      @page { size: letter landscape; margin: 0.5in; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }

      h1 { font-size: 18px; margin: 0; }
      .meta { margin-top: 6px; font-size: 12px; font-weight: 700; display:flex; justify-content: space-between; gap: 12px; }
      .muted { opacity: 0.85; }

      table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 12px; }
      th, td { border: 1px solid #000; padding: 6px 6px; font-size: 11px; line-height: 1.25; vertical-align: top; overflow: hidden; }
      th { text-align: left; font-weight: 700; }
      thead th { border-bottom: 3px solid #000; }

      /* Column widths tuned for landscape */
      .c-id { width: 4%; }
      .c-first { width: 6%; }
      .c-last { width: 7%; }
      .c-coach { width: 8%; }
      .c-team { width: 8%; }
      .c-dob { width: 6%; }
      .c-g { width: 3%; }
      .c-age { width: 4%; }
      .c-email { width: 13%; }
      .c-phone { width: 10%; }
      .c-events { width: 13%; }
      .c-sub { width: 4%; text-align:right; }
      .c-fee { width: 4%; text-align:right; }
      .c-total { width: 4%; text-align:right; }
      .c-created { width: 6%; }

      .events { word-break: break-word; }
      .c-created {
        white-space: nowrap;
        font-size: 10px;
        line-height: 1.1;
      }
      .c-email, .c-phone { overflow-wrap: anywhere; word-break: break-word; }
      td.c-email, td.c-phone { font-size: 10px; line-height: 1.15; }

      @media print {
        .no-print { display: none !important; }
      }
    </style>
  `;

  const docHead = `
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Printable Registrant List</title>
      ${style}
    </head>
  `;

  const controls = `
    <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
      <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
    </div>
  `;

  const header = `
    <div>
      <h1>${escapeHtml(String(compName || "Printable Registrant List"))}</h1>
      <div class="meta">
        <div class="muted">${escapeHtml(String(compDate || ""))}</div>
        <div class="muted">${escapeHtml(String(compLoc || ""))}</div>
        <div class="muted">Registrants: ${escapeHtml(String((regs || []).length))}</div>
      </div>
    </div>
  `;

  const thead = `
    <thead>
      <tr>
        <th class="c-id">ID</th>
        <th class="c-first">First</th>
        <th class="c-last">Last</th>
        <th class="c-coach">Coach</th>
        <th class="c-team">Team</th>
        <th class="c-dob">DOB</th>
        <th class="c-g">G</th>
        <th class="c-age">Age</th>
        <th class="c-email">Email</th>
        <th class="c-phone">Phone</th>
        <th class="c-events">Events</th>
        <th class="c-sub">Sub</th>
        <th class="c-fee">Fee</th>
        <th class="c-total">Total</th>
        <th class="c-created">Created</th>
      </tr>
    </thead>
  `;

  const rows = (Array.isArray(regs) ? regs : [])
    .map((r) => {
      const id = String(r?.id ?? "");
      const first = String(r?.firstName ?? r?.first_name ?? "");
      const last = String(r?.lastName ?? r?.last_name ?? "");
      const coach = String(r?.coachName ?? r?.coach_name ?? "");
      const team = String(r?.teamName ?? r?.team_name ?? "");
      const dob = String(r?.dateOfBirth ?? r?.date_of_birth ?? "");
      const gender = String(r?.gender ?? "");
      const ageDiv = String(r?.ageDivision ?? r?.age_division ?? "");
      const email = String(r?.email ?? "");
      const phone = String(r?.homePhone ?? r?.home_phone ?? "");

      const eventsText = extractEventSelections(r).join(", ");

      const subNum = Number(r?.eventSubtotal ?? r?.event_subtotal ?? 0);
      const feeNum = Number(r?.facilityFee ?? r?.facility_fee ?? 0);
      const totalNum = Number(r?.eventTotal ?? r?.event_total ?? 0);

      const sub = Number.isFinite(subNum) ? subNum.toFixed(2) : "";
      const fee = Number.isFinite(feeNum) ? feeNum.toFixed(2) : "";
      const total = Number.isFinite(totalNum) ? totalNum.toFixed(2) : "";

      const createdRaw = String(r?.createdAt ?? r?.created_at ?? "");
      const created = createdRaw ? new Date(createdRaw.replace(" ", "T")).toLocaleDateString() : "";

      return `
        <tr>
          <td class="c-id">${escapeHtml(id)}</td>
          <td class="c-first">${escapeHtml(first)}</td>
          <td class="c-last">${escapeHtml(last)}</td>
          <td class="c-coach">${escapeHtml(coach)}</td>
          <td class="c-team">${escapeHtml(team)}</td>
          <td class="c-dob">${escapeHtml(dob)}</td>
          <td class="c-g">${escapeHtml(gender)}</td>
          <td class="c-age">${escapeHtml(ageDiv)}</td>
          <td class="c-email">${escapeHtml(email)}</td>
          <td class="c-phone">${escapeHtml(phone)}</td>
          <td class="c-events events">${escapeHtml(eventsText)}</td>
          <td class="c-sub">${escapeHtml(sub)}</td>
          <td class="c-fee">${escapeHtml(fee)}</td>
          <td class="c-total">${escapeHtml(total)}</td>
          <td class="c-created">${escapeHtml(created)}</td>
        </tr>
      `;
    })
    .join("");

  const body = `
    <div>
      ${header}
      <table>
        ${thead}
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  return `
    <!doctype html>
    <html>
      ${docHead}
      <body>
        ${controls}
        ${body}
      </body>
    </html>
  `;
}

async function generatePrintableRegistrantList(competitionId) {
  let competition = (competitionsCache || [])
    .find((c) => String(c.id) === String(competitionId)) || null;

  const needsFetch =
    !competition ||
    !competition.name ||
    !competition.location ||
    !competition.start_at;

  if (needsFetch) {
    try {
      const qs = new URLSearchParams({ id: String(competitionId) }).toString();
      const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });
      if (data?.competition) competition = data.competition;
    } catch (e) {
      console.warn("[admin] failed to load competition for registrant print:", e);
    }
  }

  const regs = await getRegistrationsForCompetition(competitionId);

  // Newest first (created desc; fallback id desc)
  regs.sort((a, b) => {
    const ad = String(a?.createdAt ?? a?.created_at ?? "");
    const bd = String(b?.createdAt ?? b?.created_at ?? "");
    if (ad && bd && ad !== bd) return bd.localeCompare(ad);
    return Number(b?.id ?? 0) - Number(a?.id ?? 0);
  });

  const html = buildPrintableRegistrantListHtml({ competition: competition || {}, regs });
  openPrintWindow(html);
}
