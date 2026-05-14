/**
 * Edit Registrants tab (UI scaffolding)
 *
 * This tab intentionally starts with: load + search + inline edit UI.
 * Persisting edits needs a dedicated API endpoint we’ll add next.
 */

// Debug/version marker (helps verify the browser loaded the latest script)
const EDIT_REGISTRANTS_VERSION = "2025-12-23.modal-v2";
try {
  window.__editRegistrantsVersion = EDIT_REGISTRANTS_VERSION;
  console.log("[editRegistrants] loaded", EDIT_REGISTRANTS_VERSION);
} catch (_) {
  // ignore
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  const num = Number(n);
  return Number.isFinite(num) ? `$${num.toFixed(2)}` : "";
}

function toBool(v) {
  if (v === true || v === 1) return true;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function fmtDateOnly(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // Accept YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function getVal(r, keys, fallback = "") {
  for (const k of keys) {
    if (r && Object.prototype.hasOwnProperty.call(r, k) && r[k] != null) {
      return r[k];
    }
  }
  return fallback;
}

function normalizeSearch(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function debounce(fn, wait = 180) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function safeJsonParse(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  const s = String(v).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

function summarizeSelections(arr, max = 2, nameById = null) {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return "None";

  const names = list
    .map((x) => {
      const n = String(x?.name ?? "").trim();
      if (n) return n;
      const id = x?.id;
      const key = id != null ? String(id).trim() : "";
      if (nameById && key && nameById[key]) return String(nameById[key]);
      return "";
    })
    .filter(Boolean);

  if (!names.length) return `${list.length} selected`;

  const head = names.slice(0, max).join(", ");
  return names.length > max ? `${head} (+${names.length - max} more)` : head;
}

async function fetchCompetition(id) {
  // Use central API client if available
  if (window.api && window.api.competitions) {
    const data = await window.api.competitions.get(id);
    const comp = data?.competition || data?.item || data?.data || null;
    if (!comp) throw new Error("Bad competition response.");
    return comp;
  }

  // Fallback for when API client isn't loaded
  const cid = encodeURIComponent(String(id));
  const urls = [
    `/api/competition.get.php?id=${cid}`,
    `/api/competitions.get.php?id=${cid}`,
    `/api/competitions.get.php?competition_id=${cid}`,
  ];

  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) continue;
        const text = await res.text().catch(() => "");
        throw new Error(
          `competition.get failed (${res.status})${text ? `: ${text}` : ""}`
        );
      }

      const data = await res.json().catch(() => null);
      const comp = data?.competition || data?.item || data?.data || null;
      if (!data || data.ok !== true || !comp)
        throw new Error("Bad competition response.");
      return comp;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("competition.get failed.");
}

// Cache competition config (event catalog + registration options)
const competitionCache = new Map(); // id -> { name: "", eventCatalog: [], registrationOptions: {} }
let coachSuggestions = []; // array of { name: string }

async function fetchAdminList() {
  // Use central API client if available
  if (window.api && window.api.registrations) {
    const data = await window.api.registrations.list();
    if (!data || !Array.isArray(data.registrations)) {
      throw new Error("Bad response from server.");
    }
    return data;
  }

  // Fallback for when API client isn't loaded
  const res = await fetch("/api/admin-list.php", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `admin-list failed (${res.status})${text ? `: ${text}` : ""}`
    );
  }

  const data = await res.json();
  if (!data || data.ok !== true || !Array.isArray(data.registrations)) {
    throw new Error("Bad response from server.");
  }

  return data;
}

function buildRowSearchIndex(r) {
  const parts = [
    getVal(r, ["id"]),
    getVal(r, ["firstName", "first_name"]),
    getVal(r, ["lastName", "last_name"]),
    getVal(r, ["email"]),
    getVal(r, ["homePhone", "home_phone"]),
    getVal(r, ["teamName", "team_name"]),
    getVal(r, ["ageDivision", "age_division"]),
    getVal(r, ["gender"]),
  ];
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

function setError(msg) {
  const el = $("editRegistrantsError");
  if (!el) return;
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.textContent = msg;
}

function clearTbody() {
  const tbody = $("editRegistrantsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";
}

function showEmptyRow(message = "No registrations loaded.") {
  const tbody = $("editRegistrantsTbody");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.id = "editRegistrantsEmptyRow";

  const colCount = COLUMNS.length + 1; // + actions
  tr.innerHTML = `<td class="px-4 py-6 text-sm text-gray-600" colspan="${colCount}">${escapeHtml(
    message
  )}</td>`;
  tbody.appendChild(tr);
}

function makeBtn(label, className = "btn btn-outline", attrs = "") {
  return `<button type="button" class="${className}" ${attrs}>${escapeHtml(
    label
  )}</button>`;
}

const COLUMNS = [
  // id is read-only
  {
    key: "id",
    label: "ID",
    editable: false,
    type: "text",
    minW: 70,
    keys: ["id"],
  },

  {
    key: "first_name",
    label: "First",
    editable: true,
    type: "text",
    minW: 140,
    keys: ["firstName", "first_name"],
  },
  {
    key: "last_name",
    label: "Last",
    editable: true,
    type: "text",
    minW: 140,
    keys: ["lastName", "last_name"],
  },
  {
    key: "email",
    label: "Email",
    editable: true,
    type: "email",
    minW: 240,
    keys: ["email"],
  },
  {
    key: "home_phone",
    label: "Home Phone",
    editable: true,
    type: "text",
    minW: 170,
    keys: ["homePhone", "home_phone"],
  },

  {
    key: "team_name",
    label: "Team",
    editable: true,
    type: "text",
    minW: 220,
    keys: ["teamName", "team_name"],
  },
  {
    key: "date_of_birth",
    label: "DOB",
    editable: true,
    type: "date",
    minW: 130,
    keys: ["dateOfBirth", "date_of_birth"],
  },
  {
    key: "gender",
    label: "Gender",
    editable: true,
    type: "text",
    minW: 130,
    keys: ["gender"],
  },
  {
    key: "age_division",
    label: "Age Div",
    editable: true,
    type: "text",
    minW: 130,
    keys: ["ageDivision", "age_division"],
  },

  //   {
  //     key: "solo_status",
  //     label: "Solo Status",
  //     editable: true,
  //     type: "text",
  //     minW: 140,
  //     keys: ["soloStatus", "solo_status"],
  //   },
  //   {
  //     key: "is_duet_or_trio",
  //     label: "Duet/Trio",
  //     editable: true,
  //     type: "checkbox",
  //     minW: 120,
  //     keys: ["isDuetOrTrio", "is_duet_or_trio"],
  //   },

  {
    key: "optional_product_selected",
    label: "T-shirt?",
    editable: true,
    type: "checkbox",
    minW: 90,
    keys: ["optionalProductSelected", "optional_product_selected"],
  },
  //   {
  //     key: "optional_product_name",
  //     label: "T-shirt Name",
  //     editable: true,
  //     type: "text",
  //     minW: 180,
  //     keys: ["optionalProductName", "optional_product_name"],
  //   },
  {
    key: "optional_product_price",
    label: "T-shirt Price",
    editable: true,
    type: "number",
    minW: 130,
    keys: ["optionalProductPrice", "optional_product_price"],
  },

  {
    key: "event_selections_json",
    label: "Events",
    editable: true,
    type: "picker-events",
    minW: 360,
    keys: ["eventSelectionsJson", "event_selections_json"],
  },
  {
    key: "coach_selections_json",
    label: "Coaches",
    editable: true,
    type: "picker-coaches",
    minW: 300,
    keys: ["coachSelectionsJson", "coach_selections_json"],
  },

  {
    key: "event_subtotal",
    label: "Subtotal",
    editable: true,
    type: "number",
    minW: 120,
    keys: ["eventSubtotal", "event_subtotal"],
  },
  {
    key: "facility_fee",
    label: "Facility Fee",
    editable: true,
    type: "number",
    minW: 120,
    keys: ["facilityFee", "facility_fee"],
  },
  {
    key: "event_total",
    label: "Total",
    editable: false,
    type: "number",
    minW: 120,
    keys: ["eventTotal", "event_total"],
  },

  {
    key: "created_at",
    label: "Created",
    editable: false,
    type: "text",
    minW: 160,
    keys: ["createdAt", "created_at"],
  },
];

function renderTableHeader() {
  const theadRow = document.querySelector("#tab-edit-registrants thead tr");
  if (!theadRow) return;

  theadRow.innerHTML = [
    ...COLUMNS.map(
      (c) =>
        `<th class="px-4 py-2" style="min-width:${
          c.minW || 120
        }px;">${escapeHtml(c.label)}</th>`
    ),
    `<th class="px-4 py-2" style="min-width:160px;"></th>`,
  ].join("");
}

function ensureModalRoot() {
  let root = document.getElementById("_editRegModalRoot");
  if (root) return root;

  root = document.createElement("div");
  root.id = "_editRegModalRoot";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "9999";
  root.style.display = "none";
  root.innerHTML = `
    <div id="_editRegModalBackdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.45);"></div>
    <div id="_editRegModalPanel" class="admin-card" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(920px, calc(100% - 2rem)); max-height:calc(100% - 2rem); overflow:auto;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;">
        <div>
          <div id="_editRegModalTitle" class="text-lg font-semibold text-gray-900">Edit</div>
          <div id="_editRegModalSub" class="text-xs text-gray-600" style="margin-top:0.25rem;"></div>
        </div>
        <button id="_editRegModalClose" type="button" class="btn btn-outline">Close</button>
      </div>
      <div id="_editRegModalBody" style="margin-top:0.75rem;"></div>
      <div id="_editRegModalFooter" style="margin-top:1rem; display:flex; gap:0.5rem; justify-content:flex-end; flex-wrap:wrap;"></div>
    </div>
  `;

  document.body.appendChild(root);

  const close = () => {
    root.style.display = "none";
    root._onClose && root._onClose();
    root._onClose = null;
  };

  root.querySelector("#_editRegModalClose")?.addEventListener("click", close);
  root
    .querySelector("#_editRegModalBackdrop")
    ?.addEventListener("click", close);

  return root;
}

function openModal({ title, sub, bodyEl, footerEl, onClose }) {
  const root = ensureModalRoot();
  root._onClose = onClose || null;
  const titleEl = root.querySelector("#_editRegModalTitle");
  const subEl = root.querySelector("#_editRegModalSub");
  const body = root.querySelector("#_editRegModalBody");
  const footer = root.querySelector("#_editRegModalFooter");

  if (titleEl) titleEl.textContent = title || "Edit";
  if (subEl) subEl.textContent = sub || "";

  if (body) {
    body.innerHTML = "";
    if (bodyEl) body.appendChild(bodyEl);
  }

  if (footer) {
    footer.innerHTML = "";
    if (footerEl) footer.appendChild(footerEl);
  }

  root.style.display = "block";
}

function makeActionBtn(label, className, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function createEventsPicker({
  reg,
  competitionId,
  initialSelections,
  onApply,
}) {
  const wrap = document.createElement("div");
  const search = document.createElement("input");
  search.className = "form-control";
  search.placeholder = "Search events...";
  search.style.marginBottom = "0.75rem";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "0.5rem";

  // Selected events map
  const selected = new Map();
  (Array.isArray(initialSelections) ? initialSelections : []).forEach((it) => {
    const idRaw = it?.id;
    const idKey =
      idRaw != null && String(idRaw).trim() !== "" ? String(idRaw).trim() : "";
    const name = String(it?.name ?? "").trim();
    const key = idKey
      ? `id:${idKey}`
      : name
      ? `name:${name.toLowerCase()}`
      : "";
    if (!key) return;
    selected.set(key, {
      id: idKey || "",
      name,
      price: Number(it?.price ?? 0),
    });
  });

  // --- Selected list UI + helpers ---

  const selectedTitle = document.createElement("div");
  selectedTitle.className = "text-sm font-semibold text-gray-900";
  selectedTitle.textContent = "Selected";

  const selectedList = document.createElement("div");
  selectedList.style.display = "grid";
  selectedList.style.gap = "0.5rem";
  selectedList.style.marginBottom = "0.75rem";

  // Load catalog from cache (must already be populated) or show empty
  const cached = competitionCache.get(String(competitionId));
  const catalog = cached?.eventCatalog || [];

  const nameById = {};
  for (const e of Array.isArray(catalog) ? catalog : []) {
    const id = e?.id != null ? String(e.id).trim() : "";
    const nm = String(e?.name ?? "").trim();
    if (id && nm) nameById[id] = nm;
  }

  function resolveName(it) {
    const id = it?.id != null ? String(it.id).trim() : "";
    if (id && nameById[id]) return nameById[id];

    const n = String(it?.name ?? "").trim();
    if (n) return n;

    return "";
  }

  function renderSelected() {
    selectedList.innerHTML = "";
    const vals = Array.from(selected.values());

    if (!vals.length) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-600";
      p.textContent = "No events selected.";
      selectedList.appendChild(p);
      return;
    }

    for (const it of vals) {
      const nm = resolveName(it) || (it.id ? `Event #${it.id}` : "Event");

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "0.75rem";

      const left = document.createElement("div");
      left.style.flex = "1";
      left.style.minWidth = "0";
      left.innerHTML = `
        <div class="text-sm text-gray-900">
          ${escapeHtml(nm)} <span class="text-gray-700">—</span> ${escapeHtml(
        money(Number(it.price ?? 0)) || "$0.00"
      )}
        </div>
      `;

      const rid = it?.id != null ? String(it.id).trim() : "";
      const rname = String(it?.name ?? "").trim();
      const key = rid
        ? `id:${rid}`
        : rname
        ? `name:${rname.toLowerCase()}`
        : "";
      const del = makeActionBtn("×", "btn btn-outline", () => {
        if (key) selected.delete(key);
        renderSelected();
        render(catalog);
      });
      del.style.padding = "0.15rem 0.45rem";
      del.style.lineHeight = "1";
      del.style.color = "#dc2626";
      del.style.borderColor = "#fca5a5";

      row.appendChild(left);
      row.appendChild(del);
      selectedList.appendChild(row);
    }
  }

  // --- End Selected list helpers ---

  const render = (catalog) => {
    const q = normalizeSearch(search.value);
    list.innerHTML = "";

    if (!q) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-600";
      p.textContent = "Type to search events…";
      list.appendChild(p);
      return;
    }

    const items = Array.isArray(catalog) ? catalog : [];
    const filtered = items.filter((e) =>
      normalizeSearch(e?.name || "").includes(q)
    );

    if (!filtered.length) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-600";
      p.textContent = "No events match.";
      list.appendChild(p);
      return;
    }

    for (const e of filtered) {
      const name = String(e?.name ?? "").trim();
      if (!name) continue;
      const price = Number(e?.defaultPrice ?? e?.price ?? 0);
      const id = String(e?.id ?? "").trim();
      const key = id ? `id:${id}` : `name:${name.toLowerCase()}`;

      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.gap = "0.5rem";
      row.style.userSelect = "none";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(key);

      const meta = document.createElement("div");
      meta.innerHTML = `
        <div class="text-sm text-gray-900">
          ${escapeHtml(name)} <span class="text-gray-700">—</span> ${escapeHtml(
        money(price) || "$0.00"
      )}
        </div>
      `;

      cb.addEventListener("change", () => {
        if (cb.checked) {
          selected.set(key, {
            id: id || "",
            name,
            price: Number.isFinite(price) ? price : 0,
          });
        } else {
          selected.delete(key);
        }
        renderSelected();
      });

      row.appendChild(cb);
      row.appendChild(meta);
      list.appendChild(row);
    }
  };

  // Append order: Selected list above search/list
  wrap.appendChild(selectedTitle);
  wrap.appendChild(selectedList);
  wrap.appendChild(search);
  wrap.appendChild(list);

  render(catalog);
  renderSelected();

  search.addEventListener(
    "input",
    debounce(() => render(catalog), 120)
  );

  const apply = () => {
    const arr = Array.from(selected.values()).map((x) => {
      const id = String(x.id ?? "").trim();
      const name = resolveName(x) || String(x.name ?? "").trim();
      return {
        id,
        name,
        price: Number(x.price ?? 0),
      };
    });
    onApply && onApply(arr);
  };

  return { el: wrap, apply };
}

function createCoachesPicker({ initialSelections, onApply }) {
  const wrap = document.createElement("div");
  // (Intentionally no helper text here)

  const search = document.createElement("input");
  search.className = "form-control";
  search.placeholder = "Search coaches...";
  search.style.marginTop = "0.75rem";

  const suggTitle = document.createElement("div");
  suggTitle.className = "text-sm font-semibold text-gray-900";
  suggTitle.textContent = "Available";
  suggTitle.style.marginTop = "0.75rem";

  const suggList = document.createElement("div");
  suggList.style.display = "grid";
  suggList.style.gap = "0.5rem";
  suggList.style.marginTop = "0.5rem";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "0.5rem";
  list.style.marginTop = "0.75rem";

  const rows = [];
  const initial = Array.isArray(initialSelections) ? initialSelections : [];
  for (const it of initial) {
    rows.push({
      id: it?.id ?? "",
      name: String(it?.name ?? "").trim(),
      internal_code: String(it?.internal_code ?? it?.internalCode ?? "").trim(),
    });
  }
  if (!rows.length) rows.push({ id: "", name: "", internal_code: "" });

  const renderSuggestions = () => {
    const q = normalizeSearch(search.value);
    suggList.innerHTML = "";

    if (!q) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-600";
      p.textContent = "Type to search coaches…";
      suggList.appendChild(p);
      return;
    }

    const items = Array.isArray(coachSuggestions) ? coachSuggestions : [];
    const filtered = items
      .filter((c) => normalizeSearch(c?.name || "").includes(q))
      .slice(0, 25);

    if (!filtered.length) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-600";
      p.textContent = "No coaches match.";
      suggList.appendChild(p);
      return;
    }

    for (const c of filtered) {
      const nm = String(c?.name ?? "").trim();
      if (!nm) continue;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "0.75rem";

      const left = document.createElement("div");
      left.className = "text-sm text-gray-900";
      left.textContent = nm;

      const addBtn = makeActionBtn("Add", "btn btn-outline", () => {
        const exists = rows.some(
          (r) => normalizeSearch(r.name) === normalizeSearch(nm)
        );
        if (exists) return;

        const emptyIdx = rows.findIndex((r) => !String(r.name ?? "").trim());
        if (emptyIdx >= 0) rows[emptyIdx].name = nm;
        else rows.push({ id: "", name: nm, internal_code: "" });

        render();
      });

      row.appendChild(left);
      row.appendChild(addBtn);
      suggList.appendChild(row);
    }
  };

  const render = () => {
    list.innerHTML = "";
    rows.forEach((r, idx) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr 180px auto";
      row.style.gap = "0.5rem";

      const name = document.createElement("input");
      name.className = "form-control";
      name.placeholder = "Coach name";
      name.value = r.name;
      name.addEventListener("input", () => (r.name = name.value));

      const code = document.createElement("input");
      code.className = "form-control";
      code.placeholder = "Code (optional)";
      code.value = r.internal_code;
      code.addEventListener("input", () => (r.internal_code = code.value));

      const del = makeActionBtn("Remove", "btn btn-outline", () => {
        rows.splice(idx, 1);
        if (!rows.length) rows.push({ id: "", name: "", internal_code: "" });
        render();
      });

      row.appendChild(name);
      row.appendChild(code);
      row.appendChild(del);
      list.appendChild(row);
    });

    const add = makeActionBtn("Add coach", "btn btn-outline", () => {
      rows.push({ id: "", name: "", internal_code: "" });
      render();
    });

    const addWrap = document.createElement("div");
    addWrap.style.marginTop = "0.75rem";
    addWrap.appendChild(add);
    list.appendChild(addWrap);
    renderSuggestions();
  };

  render();

  // Suggestions update as you type (do not show full list when empty)
  renderSuggestions();
  search.addEventListener(
    "input",
    debounce(() => {
      renderSuggestions();
    }, 120)
  );

  wrap.appendChild(list);
  wrap.appendChild(search);
  wrap.appendChild(suggTitle);
  wrap.appendChild(suggList);

  const apply = () => {
    const cleaned = rows
      .map((x) => ({
        id: x.id ?? "",
        name: String(x.name ?? "").trim(),
        internal_code: String(x.internal_code ?? "").trim(),
      }))
      .filter((x) => x.name);

    onApply && onApply(cleaned);
  };

  return { el: wrap, apply };
}

function renderReadRow(r) {
  const id = Number(getVal(r, ["id"], 0));

  const tr = document.createElement("tr");
  tr.dataset.regId = String(id);
  tr.dataset.mode = "read";

  const tds = COLUMNS.map((c) => {
    let v = getVal(r, c.keys, "");

    if (c.type === "picker-events") {
      const arr = safeJsonParse(v, []);
      const compId = String(
        getVal(r, ["competitionId", "competition_id"], "")
      ).trim();
      const cached = competitionCache.get(compId);
      const nameById = {};
      if (cached && Array.isArray(cached.eventCatalog)) {
        for (const e of cached.eventCatalog) {
          const id = e?.id != null ? String(e.id).trim() : "";
          const nm = String(e?.name ?? "").trim();
          if (id && nm) nameById[id] = nm;
        }
      }
      v = summarizeSelections(arr, 2, nameById);
    } else if (c.type === "picker-coaches") {
      const arr = safeJsonParse(v, []);
      v = summarizeSelections(arr);
    } else if (c.type === "checkbox") {
      v = toBool(v) ? "Yes" : "";
    } else if (c.type === "number") {
      const num = Number(v);
      const isMoney =
        c.key === "event_subtotal" ||
        c.key === "facility_fee" ||
        c.key === "event_total" ||
        c.key === "optional_product_price";
      v = Number.isFinite(num) ? (isMoney ? money(num) : String(num)) : "";
    } else if (c.type === "date") {
      v = fmtDateOnly(v);
    } else {
      v = String(v ?? "");
    }

    return `<td class="px-4 py-2" style="min-width:${
      c.minW || 120
    }px; vertical-align:top;">${escapeHtml(v)}</td>`;
  });

  tr.innerHTML = [
    ...tds,
    `<td class="px-4 py-2" style="white-space:nowrap; min-width:160px;">
       ${makeBtn("Edit", "btn btn-outline", `data-action="edit"`)}
     </td>`,
  ].join("");

  return tr;
}

function renderEditRow(r) {
  const id = Number(getVal(r, ["id"], 0));

  const tr = document.createElement("tr");
  tr.dataset.regId = String(id);
  tr.dataset.mode = "edit";

  const cells = COLUMNS.map((c) => {
    let v = getVal(r, c.keys, "");

    if (!c.editable) {
      if (c.type === "date") v = fmtDateOnly(v);
      return `<td class="px-4 py-2" style="min-width:${
        c.minW || 120
      }px; vertical-align:top;">${escapeHtml(v)}</td>`;
    }

    if (c.type === "checkbox") {
      const checked = toBool(v) ? "checked" : "";
      return `<td class="px-4 py-2" style="min-width:${
        c.minW || 120
      }px; vertical-align:top;">
        <input type="checkbox" ${checked} data-field="${escapeHtml(c.key)}" />
      </td>`;
    }

    if (c.type === "picker-events" || c.type === "picker-coaches") {
      const arr = safeJsonParse(v, []);
      const compId = getVal(r, ["competitionId", "competition_id"], "");
      let summary = summarizeSelections(arr);
      if (c.type === "picker-events") {
        const cached = competitionCache.get(String(compId).trim());
        const nameById = {};
        if (cached && Array.isArray(cached.eventCatalog)) {
          for (const e of cached.eventCatalog) {
            const id2 = e?.id != null ? String(e.id).trim() : "";
            const nm2 = String(e?.name ?? "").trim();
            if (id2 && nm2) nameById[id2] = nm2;
          }
        }
        summary = summarizeSelections(arr, 2, nameById);
      }

      // Hidden textarea stores the real JSON value for saving later
      const hiddenVal = escapeHtml(
        JSON.stringify(Array.isArray(arr) ? arr : [])
      );
      const label = c.type === "picker-events" ? "Edit events" : "Edit coaches";

      return `<td class="px-4 py-2" style="min-width:${
        c.minW || 120
      }px; vertical-align:top;">
        <div class="text-xs text-gray-700" style="margin-bottom:0.35rem;">${escapeHtml(
          summary
        )}</div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" data-action="open-picker" data-picker="${escapeHtml(
            c.type
          )}" data-comp-id="${escapeHtml(String(compId))}">${escapeHtml(
        label
      )}</button>
        </div>
        <textarea class="hidden" data-field="${escapeHtml(
          c.key
        )}">${hiddenVal}</textarea>
      </td>`;
    }

    if (c.type === "textarea") {
      return `<td class="px-4 py-2" style="min-width:${
        c.minW || 120
      }px; vertical-align:top;">
        <textarea class="form-control" style="min-width:${
          c.minW || 120
        }px; height:68px;" data-field="${escapeHtml(c.key)}">${escapeHtml(
        v
      )}</textarea>
      </td>`;
    }

    const typeAttr =
      c.type === "date"
        ? "date"
        : c.type === "email"
        ? "email"
        : c.type === "number"
        ? "number"
        : "text";
    const stepAttr = c.type === "number" ? ' step="0.01"' : "";
    const valueAttr = c.type === "date" ? fmtDateOnly(v) : String(v ?? "");

    return `<td class="px-4 py-2" style="min-width:${
      c.minW || 120
    }px; vertical-align:top;">
      <input class="form-control" type="${typeAttr}"${stepAttr} style="min-width:${
      c.minW || 120
    }px;" value="${escapeHtml(valueAttr)}" data-field="${escapeHtml(c.key)}" />
    </td>`;
  });

  tr.innerHTML = [
    ...cells,
    `<td class="px-4 py-2" style="white-space:nowrap; min-width:160px; display:flex; gap:0.5rem; justify-content:flex-end; align-items:flex-start;">
       ${makeBtn("Delete", "btn btn-outline", `data-action="delete"`)}
       ${makeBtn("Save", "btn btn-primary", `data-action="save"`)}
       ${makeBtn("Cancel", "btn btn-outline", `data-action="cancel"`)}
     </td>`,
  ].join("");

  return tr;
}

async function saveRegistrationEdits({ id, updates }) {
  // Use central API client if available
  if (window.api && window.api.registrations) {
    const data = await window.api.registrations.update(id, updates);
    if (!data || !data.registration) {
      throw new Error("Bad update response from server.");
    }
    return data.registration;
  }

  // Fallback for when API client isn't loaded
  const res = await fetch("/api/registrations.update.php", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id, updates }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `registrations.update failed (${res.status})${text ? `: ${text}` : ""}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true || !data.registration) {
    throw new Error("Bad update response from server.");
  }
  return data.registration;
}

async function deleteRegistration({ id }) {
  // Use central API client if available
  if (window.api && window.api.registrations) {
    const data = await window.api.registrations.delete(id);
    return data;
  }

  // Fallback for when API client isn't loaded
  const res = await fetch("/api/registrations.delete.php", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `registrations.delete failed (${res.status})${text ? `: ${text}` : ""}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true) {
    throw new Error("Bad delete response from server.");
  }
  return data;
}

async function createRegistration(payload) {
  // Use central API client if available
  if (window.api && window.api.registrations) {
    const data = await window.api.registrations.create(payload || {});
    if (!data || !data.registration) {
      throw new Error("Bad create response from server.");
    }
    return data.registration;
  }

  // Fallback for when API client isn't loaded
  const res = await fetch("/api/registrations.create.php", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `registrations.create failed (${res.status})${text ? `: ${text}` : ""}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true || !data.registration) {
    throw new Error("Bad create response from server.");
  }

  return data.registration;
}

function promptNewRegistrant({ competitionId } = {}) {
  return new Promise((resolve) => {
    const body = document.createElement("div");

    // Header + helper text (matches registration form section style)
    const header = document.createElement("div");
    header.innerHTML = `
      <h2 class="text-lg font-semibold text-gray-900">Athlete details</h2>
    `;

    const err = document.createElement("div");
    err.className = "mt-3 text-sm text-red-600";
    err.style.display = "none";

    const grid = document.createElement("div");
    grid.className = "mt-4";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr";
    grid.style.gap = "0.75rem 1.25rem";

    // Two-column layout on larger screens (same breakpoint used elsewhere)
    const mq = window.matchMedia("(min-width: 900px)");
    const applyCols = () => {
      grid.style.gridTemplateColumns = mq.matches ? "1fr 1fr" : "1fr";
    };
    applyCols();
    mq.addEventListener?.("change", applyCols);

    const makeField = (label, type, placeholder) => {
      const wrap = document.createElement("label");
      wrap.style.display = "grid";
      wrap.style.gap = "0.25rem";
      wrap.style.minWidth = "0";

      const l = document.createElement("span");
      l.className = "text-sm text-gray-900";
      l.textContent = label;

      const input = document.createElement("input");
      input.className = "form-control";
      input.type = type;
      input.placeholder = placeholder;

      wrap.appendChild(l);
      wrap.appendChild(input);
      return { wrap, input };
    };

    const makeSelect = (label, options) => {
      const wrap = document.createElement("label");
      wrap.style.display = "grid";
      wrap.style.gap = "0.25rem";
      wrap.style.minWidth = "0";

      const l = document.createElement("span");
      l.className = "text-sm text-gray-900";
      l.textContent = label;

      const sel = document.createElement("select");
      sel.className = "form-control";
      sel.innerHTML = (Array.isArray(options) ? options : [])
        .map(
          (o) =>
            `<option value="${escapeHtml(o.value)}">${escapeHtml(
              o.label
            )}</option>`
        )
        .join("");

      wrap.appendChild(l);
      wrap.appendChild(sel);
      return { wrap, select: sel };
    };

    // Core identity fields
    const f1 = makeField("First name", "text", "First");
    const f2 = makeField("Last name", "text", "Last");
    const f3 = makeField("Email", "email", "name@example.com");

    // Match the public form fields (common ones)
    const phone = makeField("Home phone", "text", "(555) 555-5555");
    const team = makeField("Team", "text", "Team name (optional)");
    const dob = makeField("Date of birth", "date", "");

    const gender = makeSelect("Gender", [
      { value: "", label: "" },
      { value: "F", label: "F" },
      { value: "M", label: "M" },
      { value: "Non-binary", label: "Non-binary" },
      { value: "Other", label: "Other" },
    ]);

    const ageDiv = makeSelect("Age division", [
      { value: "", label: "" },
      { value: "0-3", label: "0-6" },
      { value: "7-9", label: "7-9" },
      { value: "10-12", label: "10-12" },
      { value: "13-15", label: "13-15" },
      { value: "16-18", label: "16+" },
    ]);

    // Make email full-width on 2-col layout
    f3.wrap.style.gridColumn = "1 / -1";

    grid.appendChild(f1.wrap);
    grid.appendChild(f2.wrap);
    grid.appendChild(f3.wrap);
    grid.appendChild(phone.wrap);
    grid.appendChild(team.wrap);
    grid.appendChild(dob.wrap);
    grid.appendChild(gender.wrap);
    grid.appendChild(ageDiv.wrap);
    ageDiv.wrap.style.marginBottom = "1.25rem";

    // Event + Coach selections (use existing pickers)
    const picks = document.createElement("div");
    picks.className = "mt-8";

    const picksTitle = document.createElement("div");
    picksTitle.className = "text-lg font-semibold text-gray-900";
    picksTitle.textContent = "Selections";

    const eventsTitle = document.createElement("div");
    eventsTitle.className = "mt-4 text-sm font-semibold text-gray-900";
    eventsTitle.textContent = "Events";

    const coachesTitle = document.createElement("div");
    coachesTitle.className = "mt-4 text-sm font-semibold text-gray-900";
    coachesTitle.textContent = "Coaches";

    let eventsPicked = [];
    let coachesPicked = [];

    const cid = String(competitionId ?? "").trim();

    const eventsPicker = createEventsPicker({
      reg: {},
      competitionId: cid,
      initialSelections: [],
      onApply: (arr) => {
        eventsPicked = Array.isArray(arr) ? arr : [];
      },
    });

    const coachesPicker = createCoachesPicker({
      initialSelections: [],
      onApply: (arr) => {
        coachesPicked = Array.isArray(arr) ? arr : [];
      },
    });

    picks.appendChild(picksTitle);

    picks.appendChild(eventsTitle);
    picks.appendChild(eventsPicker.el);

    // Divider between Events and Coaches
    const divider = document.createElement("div");
    divider.style.margin = "1.5rem 0";
    divider.style.borderTop = "1px solid #e5e7eb";
    picks.appendChild(divider);

    picks.appendChild(coachesTitle);
    picks.appendChild(coachesPicker.el);

    body.appendChild(header);
    body.appendChild(err);
    body.appendChild(grid);
    body.appendChild(picks);

    const footer = document.createElement("div");
    footer.style.gap = "0.5rem";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.flexWrap = "wrap";

    const closeWith = (val) => {
      const root = document.getElementById("_editRegModalRoot");
      if (root) root.style.display = "none";
      resolve(val);
    };

    const showErr = (msg) => {
      err.textContent = msg;
      err.style.display = msg ? "block" : "none";
    };

    const btnCancel = makeActionBtn("Cancel", "btn btn-outline", () =>
      closeWith(null)
    );

    const btnCreate = makeActionBtn("Create", "btn btn-primary", () => {
      const first_name = String(f1.input.value ?? "").trim();
      const last_name = String(f2.input.value ?? "").trim();
      const email = String(f3.input.value ?? "").trim();

      if (!first_name || !last_name || !email) {
        showErr("First name, last name, and email are required.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        showErr("Please enter a valid email address.");
        return;
      }

      // Pull pickers into arrays
      try {
        eventsPicker.apply();
      } catch (_) {}
      try {
        coachesPicker.apply();
      } catch (_) {}

      // Compute subtotal from chosen events
      const subtotal = (Array.isArray(eventsPicked) ? eventsPicked : []).reduce(
        (sum, it) => sum + (Number(it?.price) || 0),
        0
      );

      // For admin-created registrations, default facility fee to 0 (admin can edit later).
      // If you want to always include the competition facility fee here, we can wire it in next.
      const facilityFee = 0;

      const payload = {
        competition_id: cid ? Number(cid) : undefined,

        first_name,
        last_name,
        email,

        home_phone: String(phone.input.value ?? "").trim(),
        team_name: String(team.input.value ?? "").trim(),
        date_of_birth: String(dob.input.value ?? "").trim(),
        gender: String(gender.select.value ?? "").trim(),
        age_division: String(ageDiv.select.value ?? "").trim(),

        // Store structured JSON like the rest of the admin UI expects
        event_selections_json: JSON.stringify(
          Array.isArray(eventsPicked) ? eventsPicked : []
        ),
        coach_selections_json: JSON.stringify(
          Array.isArray(coachesPicked) ? coachesPicked : []
        ),

        // Optional product defaults off (admin can edit later)
        optional_product_selected: 0,
        optional_product_name: "",
        optional_product_price: 0,

        event_subtotal: subtotal,
        facility_fee: facilityFee,
      };

      showErr("");
      closeWith(payload);
    });

    footer.appendChild(btnCancel);
    footer.appendChild(btnCreate);

    openModal({
      title: "Add athlete",
      sub: "",
      bodyEl: body,
      footerEl: footer,
      onClose: () => resolve(null),
    });

    // Make the modal title larger for the Add Athlete flow
    try {
      const titleEl = document.getElementById("_editRegModalTitle");
      if (titleEl) {
        titleEl.className = "text-2xl font-semibold text-gray-900";
      }
    } catch (_) {
      // ignore
    }

    setTimeout(() => {
      try {
        f1.input.focus();
      } catch (_) {}
    }, 0);
  });
}

function normalizeSavedRegistration(saved) {
  if (!saved || typeof saved !== "object") return saved;

  const out = { ...saved };

  // JSON picker fields
  if (
    out.event_selections_json !== undefined &&
    out.eventSelectionsJson === undefined
  ) {
    out.eventSelectionsJson = out.event_selections_json;
  }
  if (
    out.coach_selections_json !== undefined &&
    out.coachSelectionsJson === undefined
  ) {
    out.coachSelectionsJson = out.coach_selections_json;
  }

  // Optional product fields
  if (
    out.optional_product_selected !== undefined &&
    out.optionalProductSelected === undefined
  ) {
    out.optionalProductSelected = out.optional_product_selected;
  }
  if (
    out.optional_product_name !== undefined &&
    out.optionalProductName === undefined
  ) {
    out.optionalProductName = out.optional_product_name;
  }
  if (
    out.optional_product_price !== undefined &&
    out.optionalProductPrice === undefined
  ) {
    out.optionalProductPrice = out.optional_product_price;
  }

  // Common identity fields (helps search index + consistency)
  if (out.first_name !== undefined && out.firstName === undefined)
    out.firstName = out.first_name;
  if (out.last_name !== undefined && out.lastName === undefined)
    out.lastName = out.last_name;
  if (out.home_phone !== undefined && out.homePhone === undefined)
    out.homePhone = out.home_phone;
  if (out.team_name !== undefined && out.teamName === undefined)
    out.teamName = out.team_name;
  if (out.coach_name !== undefined && out.coachName === undefined)
    out.coachName = out.coach_name;
  if (out.date_of_birth !== undefined && out.dateOfBirth === undefined)
    out.dateOfBirth = out.date_of_birth;
  if (out.age_division !== undefined && out.ageDivision === undefined)
    out.ageDivision = out.age_division;
  if (out.solo_status !== undefined && out.soloStatus === undefined)
    out.soloStatus = out.solo_status;
  if (out.is_duet_or_trio !== undefined && out.isDuetOrTrio === undefined)
    out.isDuetOrTrio = out.is_duet_or_trio;
  if (out.competition_id !== undefined && out.competitionId === undefined)
    out.competitionId = out.competition_id;

  // Normalize money-ish fields that may come back as strings
  if (out.event_subtotal !== undefined && out.eventSubtotal === undefined)
    out.eventSubtotal = Number(out.event_subtotal);
  if (out.facility_fee !== undefined && out.facilityFee === undefined)
    out.facilityFee = Number(out.facility_fee);
  if (out.event_total !== undefined && out.eventTotal === undefined)
    out.eventTotal = Number(out.event_total);

  // Ensure optional product price is numeric
  if (out.optionalProductPrice !== undefined)
    out.optionalProductPrice = Number(out.optionalProductPrice);

  return out;
}

function collectRowEdits(tr) {
  const updates = {};

  // Inputs (text/number/email/date)
  tr.querySelectorAll("input.form-control[data-field]").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;

    if (el.type === "number") {
      const v = String(el.value ?? "").trim();
      updates[key] = v === "" ? "" : Number(v);
      return;
    }

    updates[key] = el.value;
  });

  // Checkboxes
  tr.querySelectorAll('input[type="checkbox"][data-field]').forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;
    updates[key] = el.checked ? 1 : 0;
  });

  // Textareas (picker JSON hidden values)
  tr.querySelectorAll("textarea[data-field]").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;

    if (key === "event_selections_json" || key === "coach_selections_json") {
      const arr = safeJsonParse(el.value, []);
      updates[key] = JSON.stringify(Array.isArray(arr) ? arr : []);
      return;
    }

    updates[key] = el.value;
  });

  // Keep totals consistent client-side too (server should also recompute).
  const sub = Number(updates.event_subtotal ?? NaN);
  const fee = Number(updates.facility_fee ?? NaN);

  // Optional product add-on
  const optSelected = toBool(updates.optional_product_selected);
  const optPrice = Number(updates.optional_product_price ?? 0);
  const opt = optSelected && Number.isFinite(optPrice) ? optPrice : 0;

  const total =
    (Number.isFinite(sub) ? sub : 0) + (Number.isFinite(fee) ? fee : 0) + opt;
  updates.event_total = total;

  return updates;
}

export function initEditRegistrantsTab() {
  const searchEl = $("editRegistrantsSearch");
  const refreshBtn = $("editRegistrantsRefreshBtn");
  const tbody = $("editRegistrantsTbody");

  // Add Athlete button (mounted next to Refresh)
  let addBtn = $("editRegistrantsAddBtn");
  if (!addBtn && refreshBtn && refreshBtn.parentElement) {
    addBtn = document.createElement("button");
    addBtn.id = "editRegistrantsAddBtn";
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "+ Add athlete";

    // Insert just before Refresh if possible
    try {
      refreshBtn.parentElement.insertBefore(addBtn, refreshBtn);
    } catch (_) {
      refreshBtn.parentElement.appendChild(addBtn);
    }

    // Keep spacing consistent
    addBtn.style.marginRight = "0.5rem";
  }

  if (!tbody) {
    // Tab not present
    return;
  }

  renderTableHeader();

  let allRegs = [];
  let filteredRegs = [];
  let searchIndex = new Map(); // id -> normalized search string

  function applyFilter() {
    const q = normalizeSearch(searchEl?.value || "");
    if (!q) {
      filteredRegs = allRegs.slice();
    } else {
      filteredRegs = allRegs.filter((r) => {
        const id = String(r.id ?? "");
        const idx = searchIndex.get(id) || "";
        return idx.includes(q);
      });
    }

    renderTable();
  }

  function renderTable() {
    clearTbody();

    if (!filteredRegs.length) {
      showEmptyRow(allRegs.length ? "No matches." : "No registrations loaded.");
      return;
    }

    const frag = document.createDocumentFragment();
    for (const r of filteredRegs) {
      frag.appendChild(renderReadRow(r));
    }
    tbody.appendChild(frag);
  }

  async function load() {
    setError("");
    refreshBtn && (refreshBtn.disabled = true);

    try {
      const data = await fetchAdminList();
      allRegs = data.registrations || [];

      // Build coach suggestions from existing registrations (coach_selections_json + coach_name)
      const coachSet = new Set();
      for (const r of allRegs) {
        // Structured list
        const raw = getVal(
          r,
          ["coachSelectionsJson", "coach_selections_json"],
          null
        );
        const arr = safeJsonParse(raw, []);
        if (Array.isArray(arr)) {
          for (const it of arr) {
            const nm = String(it?.name ?? "").trim();
            if (nm) coachSet.add(nm);
          }
        }

        // Fallback free-text coach_name (may contain multiple names)
        const cn = String(getVal(r, ["coachName", "coach_name"], "")).trim();
        if (cn) {
          cn.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((nm) => coachSet.add(nm));
        }
      }

      coachSuggestions = Array.from(coachSet)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name }));

      // Preload competition config (event catalog) for picker UI
      const compIds = Array.from(
        new Set(
          allRegs
            .map((r) =>
              String(getVal(r, ["competitionId", "competition_id"], "")).trim()
            )
            .filter(Boolean)
        )
      );

      for (const cid of compIds) {
        if (competitionCache.has(cid)) continue;
        try {
          const comp = await fetchCompetition(cid);
          competitionCache.set(cid, {
            name: String(comp?.name ?? "").trim(),
            eventCatalog: Array.isArray(comp.eventCatalog)
              ? comp.eventCatalog
              : [],
            registrationOptions: comp.registrationOptions || {},
          });
        } catch (e) {
          // Non-fatal; picker can still open with empty list
          competitionCache.set(cid, {
            name: "",
            eventCatalog: [],
            registrationOptions: {},
          });
        }
      }

      // If the API includes competitionId on records, we can optionally filter to the current competition later.
      // For now we show all returned registrations.

      searchIndex = new Map();
      for (const r of allRegs) {
        const id = String(r.id ?? "");
        searchIndex.set(id, buildRowSearchIndex(r));
      }

      applyFilter();
    } catch (e) {
      setError(e?.message || String(e));
      allRegs = [];
      filteredRegs = [];
      searchIndex = new Map();
      renderTable();
    } finally {
      refreshBtn && (refreshBtn.disabled = false);
    }
  }

  // Event wiring
  refreshBtn?.addEventListener("click", () => load());
  searchEl?.addEventListener(
    "input",
    debounce(() => {
      applyFilter();
    }, 150)
  );

  addBtn?.addEventListener("click", async () => {
    setError("");
    if (addBtn) addBtn.disabled = true;

    try {
      // Prefer current competition if we can infer it from loaded rows; otherwise API defaults to current.
      const inferredCompId =
        allRegs.length > 0
          ? String(
              getVal(allRegs[0], ["competitionId", "competition_id"], "")
            ).trim()
          : "";

      const required = await promptNewRegistrant({
        competitionId: inferredCompId,
      });
      if (!required) return;

      const payload = required;

      const createdRaw = await createRegistration(payload);
      const created = normalizeSavedRegistration(createdRaw);

      // Put at top
      allRegs.unshift(created);

      // Rebuild search index entry
      searchIndex.set(String(created.id), buildRowSearchIndex(created));

      // Re-apply filter (keeps behavior consistent with search box)
      applyFilter();

      // Find the row in DOM and switch it into edit mode
      const rowEl = tbody.querySelector(
        `tr[data-reg-id="${String(created.id)}"]`
      );
      if (rowEl) {
        rowEl.replaceWith(renderEditRow(created));
        try {
          tbody
            .querySelector(`tr[data-reg-id="${String(created.id)}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (_) {}
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      if (addBtn) addBtn.disabled = false;
    }
  });

  // Row actions (edit/cancel/save)
  tbody.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button[data-action]");
    if (!btn) return;

    const tr = btn.closest("tr");
    if (!tr) return;

    const id = tr.dataset.regId;
    const action = btn.getAttribute("data-action");
    const reg = allRegs.find((r) => String(r.id) === String(id));
    if (!reg) return;

    if (action === "open-picker") {
      const pickerType = btn.getAttribute("data-picker");
      const compId =
        btn.getAttribute("data-comp-id") ||
        String(getVal(reg, ["competitionId", "competition_id"], ""));
      const cell = btn.closest("td");
      const hiddenTa = cell?.querySelector?.("textarea[data-field]");
      const fieldKey = hiddenTa?.getAttribute?.("data-field") || "";
      const currentArr = safeJsonParse(hiddenTa?.value, []);

      if (pickerType === "picker-events") {
        const picker = createEventsPicker({
          reg,
          competitionId: compId,
          initialSelections: currentArr,
          onApply: (arr) => {
            if (hiddenTa) hiddenTa.value = JSON.stringify(arr);
            // Update visible summary
            const summaryEl = cell?.querySelector?.("div.text-xs");
            if (summaryEl) {
              const cached2 = competitionCache.get(String(compId).trim());
              const nameById2 = {};
              if (cached2 && Array.isArray(cached2.eventCatalog)) {
                for (const e of cached2.eventCatalog) {
                  const id2 = e?.id != null ? String(e.id).trim() : "";
                  const nm2 = String(e?.name ?? "").trim();
                  if (id2 && nm2) nameById2[id2] = nm2;
                }
              }
              summaryEl.textContent = summarizeSelections(arr, 2, nameById2);
            }
          },
        });

        const footer = document.createElement("div");
        footer.appendChild(
          makeActionBtn("Apply", "btn btn-primary", () => {
            picker.apply();
            // Close
            const root = document.getElementById("_editRegModalRoot");
            if (root) root.style.display = "none";
          })
        );
        footer.appendChild(
          makeActionBtn("Cancel", "btn btn-outline", () => {
            const root = document.getElementById("_editRegModalRoot");
            if (root) root.style.display = "none";
          })
        );

        const cachedComp = competitionCache.get(String(compId).trim());
        const compName = String(cachedComp?.name ?? "").trim();
        const sub = compName
          ? compName
          : compId
          ? `Competition #${compId}`
          : "";

        openModal({
          title: "Edit events",
          sub,
          bodyEl: picker.el,
          footerEl: footer,
        });
        return;
      }

      if (pickerType === "picker-coaches") {
        const picker = createCoachesPicker({
          initialSelections: currentArr,
          onApply: (arr) => {
            if (hiddenTa) hiddenTa.value = JSON.stringify(arr);
            const summaryEl = cell?.querySelector?.("div.text-xs");
            if (summaryEl) summaryEl.textContent = summarizeSelections(arr);
          },
        });

        const footer = document.createElement("div");
        footer.appendChild(
          makeActionBtn("Apply", "btn btn-primary", () => {
            picker.apply();
            const root = document.getElementById("_editRegModalRoot");
            if (root) root.style.display = "none";
          })
        );
        footer.appendChild(
          makeActionBtn("Cancel", "btn btn-outline", () => {
            const root = document.getElementById("_editRegModalRoot");
            if (root) root.style.display = "none";
          })
        );

        openModal({
          title: "Edit coaches",
          sub: "",
          bodyEl: picker.el,
          footerEl: footer,
        });
        return;
      }

      return;
    }

    if (action === "edit") {
      tr.replaceWith(renderEditRow(reg));
      return;
    }

    if (action === "cancel") {
      tr.replaceWith(renderReadRow(reg));
      return;
    }

    if (action === "delete") {
      setError("");

      const ok = window.confirm(
        `Delete registration #${id}? This cannot be undone.`
      );
      if (!ok) return;

      // Disable all buttons in the action cell while deleting
      const actionCell = tr.querySelector("td:last-child");
      actionCell
        ?.querySelectorAll("button")
        .forEach((b) => (b.disabled = true));

      try {
        await deleteRegistration({ id: Number(id) });

        // Remove from in-memory data
        allRegs = allRegs.filter((r) => String(r.id) !== String(id));
        filteredRegs = filteredRegs.filter((r) => String(r.id) !== String(id));
        searchIndex.delete(String(id));

        // Remove row from DOM
        tr.remove();

        // If table now empty, show empty row
        if (!filteredRegs.length) {
          clearTbody();
          showEmptyRow(
            allRegs.length ? "No matches." : "No registrations loaded."
          );
        }
      } catch (e) {
        setError(e?.message || String(e));
        actionCell
          ?.querySelectorAll("button")
          .forEach((b) => (b.disabled = false));
      }

      return;
    }

    if (action === "save") {
      setError("");

      const saveBtn = btn;
      saveBtn.disabled = true;

      try {
        const updates = collectRowEdits(tr);
        const savedRaw = await saveRegistrationEdits({
          id: Number(id),
          updates,
        });
        const saved = normalizeSavedRegistration(savedRaw);

        // Update in-memory record
        const idx = allRegs.findIndex((r) => String(r.id) === String(id));
        if (idx >= 0) {
          allRegs[idx] = { ...allRegs[idx], ...saved };
        }

        // Refresh search index for that row
        searchIndex.set(String(id), buildRowSearchIndex(allRegs[idx] || saved));

        // Replace row
        tr.replaceWith(renderReadRow(allRegs[idx] || saved));
      } catch (e) {
        setError(e?.message || String(e));
        saveBtn.disabled = false;
        // Keep edit row as-is
      }

      return;
    }
  });

  // Initial load
  load();
}

// Fallback for non-module callers
try {
  window.initEditRegistrantsTab = initEditRegistrantsTab;
} catch (_) {
  // ignore
}
