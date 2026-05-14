// web/assets/js/admin.js
import { showToast } from "./toast.js";
import { api, ENDPOINTS } from "./lib/api.js";
import { initCurrentEventTab } from "./admin/tabs/currentEvent.js";
import { initRegistrantsTab } from "./admin/tabs/registrants.js";
import { initRegistrationFieldsTab } from "./admin/tabs/registrationFields.js";
import { initEditRegistrantsTab } from "./admin/tabs/editRegistrants.js";
import { initDownloadablesTab } from "./admin/tabs/downloadables.js";
import { makeJudgingSheetsReporter } from "./admin/reports/judgingSheets.js";
import { makeRegistrantListReporter } from "./admin/reports/registrantList.js";
import { makeScoreSheetLabelsReporter } from "./admin/reports/scoreSheetLabels.js";
import { makeFinancialSummaryReporter } from "./admin/reports/financialSummary.js";
import { makeCoachRosterReporter } from "./admin/reports/coachRoster.js";
import { makeEventBreakdownReporter } from "./admin/reports/eventBreakdown.js";
import { initOverviewCharts } from "./admin/tabs/overviewCharts.js";
import { initExportModal } from "./admin/exportModal.js";
import { initSettingsTab } from "./admin/tabs/settings.js";
import { initDashboard } from "./admin/tabs/dashboard.js";

// Configure API error handler to show toasts
api.onError = (err) => {
  if (err.status === 401) {
    // Redirect to login page on auth error
    window.location.href = '/admin/login.html';
    return;
  }
  showToast(err.message, 'error');
};

// ===== API endpoints (backward compatibility for child modules) =====
const API = {
  listCompetitions: ENDPOINTS.competitions.list,
  getCompetition: ENDPOINTS.competitions.get,
  saveCompetition: ENDPOINTS.competitions.save,
  deleteCompetition: ENDPOINTS.competitions.delete,
  listRegistrations: ENDPOINTS.registrations.list,
  listEventOptions: ENDPOINTS.events.options,
  listCoaches: ENDPOINTS.coaches.list,
  coachesSave: ENDPOINTS.coaches.save,
  listCompetitionCoaches: ENDPOINTS.competitionCoaches.list,
  saveCompetitionCoaches: ENDPOINTS.competitionCoaches.save,
  fields: ENDPOINTS.config.fields,
};

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
  // Optional product (e.g., T-shirt)
  productEnabled: document.getElementById("competitionProductEnabled"),
  productName: document.getElementById("competitionProductName"),
  productPrice: document.getElementById("competitionProductPrice"),
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

// Backward compatibility wrapper - delegates to the central API client
function fetchJson(url, opts = {}) {
  return api.request(url, opts);
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


// ===== Competitions (Current Competition tab) =====

let competitionsCache = [];
let currentCompetitionId = null;

// Registration fields state (stored on the competition row)
// Used by Registration Fields tab + initialized whenever a competition is loaded.
let currentEventCatalog = []; // [{ id, name, defaultPrice }]
let currentRegConfig = [];    // [{ optionId, price, included, isNew?, newName? }]
let currentFieldsConfig = null; // { fields: [{ id, enabled, required, order }] } - per-competition field overrides

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

// Warn if the user leaves the page with unsaved Registration Fields changes.
window.addEventListener("beforeunload", (e) => {
  if (!regFieldsDirty) return;
  e.preventDefault();
  e.returnValue = "";
});
 
// ===== Tab Lazy Loading =====
// Track which tabs have been loaded (data fetched) to avoid redundant API calls
const loadedTabs = new Set();

// Tab loading functions - called when tab is first activated
const tabLoaders = {};

/**
 * Register a lazy loader for a tab
 * @param {string} tabId Tab identifier
 * @param {Function} loader Async function to load tab data
 */
function registerTabLoader(tabId, loader) {
  tabLoaders[tabId] = loader;
}

/**
 * Load tab data if not already loaded
 * @param {string} tabId Tab identifier
 */
async function loadTabIfNeeded(tabId) {
  if (loadedTabs.has(tabId)) return;

  const loader = tabLoaders[tabId];
  if (loader) {
    console.log(`[admin] Lazy loading tab: ${tabId}`);
    await loader();
    loadedTabs.add(tabId);
  }
}

/**
 * Mark a tab as needing reload (e.g., after competition change)
 * @param {string} tabId Tab identifier, or null to clear all
 */
function invalidateTab(tabId = null) {
  if (tabId) {
    loadedTabs.delete(tabId);
  } else {
    loadedTabs.clear();
  }
}

// Expose to global scope for inline script access
window.adminTabLoader = {
  loadTabIfNeeded,
  invalidateTab,
};

// ===== Init =====
(async function init() {
  try {
    // Check authentication before loading admin UI
    const authResult = await api.auth.check();
    if (!authResult.ok || !authResult.authenticated) {
      window.location.href = '/admin/login.html';
      return;
    }

    const registrantsTab = initRegistrantsTab({
      els,
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getRevenueValueEl,
    });

    // Start empty
    registrantsTab.renderRegistrations([]);
    registrantsTab.renderRegistrationsDetailed([]);

    const registrationFieldsTab = initRegistrationFieldsTab({
      els,
      API,
      fetchJson,
      showToast,
      escapeHtml,
      money,
      getCurrentCompetitionId: () => currentCompetitionId,
      getCurrentEventCatalog: () => currentEventCatalog,
      setCurrentEventCatalog: (list) => { currentEventCatalog = Array.isArray(list) ? list : []; },
      getCurrentRegConfig: () => currentRegConfig,
      setCurrentRegConfig: (list) => { currentRegConfig = Array.isArray(list) ? list : []; },
      getCurrentFieldsConfig: () => currentFieldsConfig,
      setCurrentFieldsConfig: (config) => { currentFieldsConfig = config || null; },
      markRegFieldsDirty,
      clearRegFieldsDirty,
    });

    // Start empty
    registrationFieldsTab.renderRegFields();

    // Edit Registrants tab (UI scaffold)
    initEditRegistrantsTab();

    // Current Competition tab: delegate to module
    await initCurrentEventTab({
      els,
      API,
      fetchJson,
      showToast,
      showInlineError,
      setFormEnabled,
      toDatetimeLocalValue,
      // shared state
      getCompetitionsCache: () => competitionsCache,
      setCompetitionsCache: (list) => { competitionsCache = Array.isArray(list) ? list : []; },
      getCurrentCompetitionId: () => currentCompetitionId,
      setCurrentCompetitionId: (id) => { currentCompetitionId = id ? Number(id) : null; },
      // hooks back into the remaining monolith for now
      onCompetitionLoaded: async (competition) => {
        currentRegConfig = Array.isArray(competition?.registrationOptions)
          ? competition.registrationOptions
          : [];
        currentFieldsConfig = competition?.fieldsConfig || null;
        clearRegFieldsDirty();

        // Invalidate all tabs when competition changes (they need fresh data)
        invalidateTab(null);

        // Defer fields tab loading to when tab is clicked
        registerTabLoader('fields', async () => {
          await registrationFieldsTab.loadEventOptions();
          if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = !currentCompetitionId;
          registrationFieldsTab.renderRegFields();
        });

        // Overview and registrants share the same data source - load immediately
        // since overview is the default tab
        await registrantsTab.loadRegistrations(currentCompetitionId);
        loadedTabs.add('overview');
        loadedTabs.add('registrants');
        loadedTabs.add('edit-registrants'); // Uses same data

        // For current tab, check if it needs loading
        const currentTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
        if (currentTab === 'fields') {
          await loadTabIfNeeded('fields');
        }
      },
      onCompetitionCleared: () => {
        currentCompetitionId = null;
        currentRegConfig = [];
        currentFieldsConfig = null;
        clearRegFieldsDirty();
        registrationFieldsTab.renderRegFields();
        registrantsTab.renderRegistrations([]);
        registrantsTab.renderRegistrationsDetailed([]);
        invalidateTab(null);
      },
    });

    const generatePrintableJudgingSheets = makeJudgingSheetsReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    const generatePrintableRegistrantList = makeRegistrantListReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    const generateScoreSheetLabels = makeScoreSheetLabelsReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    // New Phase 4 reporters
    const generateFinancialSummary = makeFinancialSummaryReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    const generateCoachRoster = makeCoachRosterReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    const generateEventBreakdown = makeEventBreakdownReporter({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      getCompetitionsCache: () => competitionsCache,
    });

    // Initialize overview charts module
    const overviewCharts = initOverviewCharts();

    // Initialize export modal
    const exportModal = initExportModal({ showToast });

    initDownloadablesTab({
      API,
      fetchJson,
      showToast,
      escapeHtml,
      generatePrintableJudgingSheets,
      generateScoreSheetLabels,
      generatePrintableRegistrantList,
      generateFinancialSummary,
      generateCoachRoster,
      generateEventBreakdown,
      openAdvancedExportModal: exportModal.openModal,
    });

    // Initialize Settings tab
    initSettingsTab({
      els,
      API,
      fetchJson,
      showToast,
    });

    // Initialize Dashboard module (Phase 6C)
    const dashboard = initDashboard({ showToast });

    // Store overviewCharts reference for onCompetitionLoaded callback
    registrantsTab.setChartsModule(overviewCharts);

    // Store dashboard reference for updates
    registrantsTab.setDashboardModule(dashboard);

    // ===== Quick Actions Dropdown =====
    const quickActionsDropdown = document.getElementById("quickActionsDropdown");
    const quickActionsTrigger = document.getElementById("quickActionsTrigger");
    const quickActionsMenu = document.getElementById("quickActionsMenu");

    if (quickActionsTrigger && quickActionsDropdown) {
      // Toggle dropdown
      quickActionsTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        quickActionsDropdown.classList.toggle("is-open");
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!quickActionsDropdown.contains(e.target)) {
          quickActionsDropdown.classList.remove("is-open");
        }
      });

      // Close on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          quickActionsDropdown.classList.remove("is-open");
        }
      });

      // Handle actions
      quickActionsMenu?.addEventListener("click", async (e) => {
        const item = e.target.closest("[data-action]");
        if (!item) return;

        const action = item.dataset.action;
        quickActionsDropdown.classList.remove("is-open");

        switch (action) {
          case "add-registration": {
            // Open registration page in new tab
            const url = currentCompetitionId
              ? `/register.html?c=${currentCompetitionId}`
              : "/register.html";
            window.open(url, "_blank");
            break;
          }

          case "export-csv": {
            // Trigger CSV export via the data table module
            const dataTable = registrantsTab.getDataTableModule?.();
            if (dataTable) {
              // Get all registrations and export
              const filtered = dataTable.getFilteredRegistrations?.() || [];
              if (filtered.length === 0) {
                showToast("No registrations to export.", "warning");
                return;
              }
              // Create CSV
              const headers = ["ID", "First Name", "Last Name", "Email", "Age Division", "Team", "Coach", "Amount", "Payment Status", "Date"];
              const rows = filtered.map(r => [
                r.id,
                r.firstName || "",
                r.lastName || "",
                r.email || "",
                r.ageDivision || "",
                r.teamName || r.team_name || "",
                r.coachName || "",
                Number(r.eventTotal ?? r.event_total ?? 0).toFixed(2),
                r.paymentStatus ?? r.payment_status ?? "pending",
                r.createdAt || r.created_at || "",
              ]);
              const csv = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
              showToast(`Exported ${filtered.length} registrations.`, "success");
            } else {
              showToast("Export not available.", "error");
            }
            break;
          }

          case "judging-sheets": {
            if (!currentCompetitionId) {
              showToast("Select a competition first.", "warning");
              return;
            }
            item.disabled = true;
            try {
              await generatePrintableJudgingSheets(currentCompetitionId);
              showToast("Judging sheets generated.", "success");
            } catch (err) {
              showToast("Failed to generate judging sheets.", "error");
            }
            item.disabled = false;
            break;
          }

          case "copy-url": {
            const baseUrl = window.location.origin;
            const url = currentCompetitionId
              ? `${baseUrl}/register.html?c=${currentCompetitionId}`
              : `${baseUrl}/register.html`;
            try {
              await navigator.clipboard.writeText(url);
              showToast("Registration URL copied!", "success");
            } catch {
              // Fallback
              const textarea = document.createElement("textarea");
              textarea.value = url;
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
              showToast("Registration URL copied!", "success");
            }
            break;
          }

          case "view-public": {
            const url = currentCompetitionId
              ? `/register.html?c=${currentCompetitionId}`
              : "/register.html";
            window.open(url, "_blank");
            break;
          }
        }
      });
    }

    // ===== Real-time Polling =====
    const POLL_INTERVAL_MS = 30000; // 30 seconds
    let pollTimer = null;
    let lastRegistrationCount = 0;
    let isPollingEnabled = true;

    // New data indicator element
    const newDataIndicator = document.createElement("div");
    newDataIndicator.id = "newDataIndicator";
    newDataIndicator.className = "new-data-indicator hidden";
    newDataIndicator.innerHTML = `
      <i data-lucide="refresh-cw"></i>
      <span>New registrations available</span>
      <button type="button" class="new-data-refresh-btn">Refresh</button>
    `;
    document.body.appendChild(newDataIndicator);

    // Add indicator styles
    const pollStyles = document.createElement("style");
    pollStyles.textContent = `
      .new-data-indicator {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--brand-primary, #6366f1);
        color: white;
        padding: 12px 20px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.875rem;
        font-weight: 500;
        box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
        z-index: 1000;
        opacity: 1;
        transition: opacity 200ms ease, transform 200ms ease;
      }
      .new-data-indicator.hidden {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
        pointer-events: none;
      }
      .new-data-indicator svg {
        width: 16px;
        height: 16px;
        animation: spin 2s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .new-data-refresh-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 100ms ease;
      }
      .new-data-refresh-btn:hover {
        background: rgba(255,255,255,0.3);
      }
    `;
    document.head.appendChild(pollStyles);

    // Re-initialize Lucide for new indicator
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    function showNewDataIndicator() {
      newDataIndicator.classList.remove("hidden");
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    }

    function hideNewDataIndicator() {
      newDataIndicator.classList.add("hidden");
    }

    async function pollForUpdates() {
      if (!currentCompetitionId || !isPollingEnabled) return;
      if (document.hidden) return; // Don't poll when tab is hidden

      try {
        const data = await api.registrations.list(currentCompetitionId);
        const regs = Array.isArray(data?.registrations) ? data.registrations : [];
        const newCount = regs.length;

        // Check if there are new registrations
        if (lastRegistrationCount > 0 && newCount > lastRegistrationCount) {
          showNewDataIndicator();
        }

        lastRegistrationCount = newCount;
      } catch (e) {
        console.warn("[poll] Error polling for updates:", e);
      }
    }

    function startPolling() {
      stopPolling();
      lastRegistrationCount = 0;
      pollTimer = setInterval(pollForUpdates, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    // Handle visibility change - pause polling when tab is hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Tab hidden - timer will skip on next tick
      } else {
        // Tab visible again - poll immediately
        pollForUpdates();
      }
    });

    // Handle refresh button click
    newDataIndicator.querySelector(".new-data-refresh-btn")?.addEventListener("click", async () => {
      hideNewDataIndicator();
      if (currentCompetitionId) {
        await registrantsTab.loadRegistrations(currentCompetitionId);
        // Update count after refresh
        const dataTable = registrantsTab.getDataTableModule?.();
        if (dataTable) {
          lastRegistrationCount = (dataTable.getFilteredRegistrations?.() || []).length;
        }
      }
    });

    // Watch for competition changes via the dropdown
    const competitionSelectTop = document.getElementById("competitionSelectTop");
    competitionSelectTop?.addEventListener("change", () => {
      hideNewDataIndicator();
      // Reset and restart polling after a short delay for data to load
      setTimeout(() => {
        const dataTable = registrantsTab.getDataTableModule?.();
        if (dataTable) {
          lastRegistrationCount = (dataTable.getFilteredRegistrations?.() || []).length;
        }
        startPolling();
      }, 1500);
    });

    // Start polling initially after page load
    setTimeout(() => {
      if (currentCompetitionId) {
        const dataTable = registrantsTab.getDataTableModule?.();
        if (dataTable) {
          lastRegistrationCount = (dataTable.getFilteredRegistrations?.() || []).length;
        }
        startPolling();
      }
    }, 2000);
  } catch (e) {
    console.warn("Init warning:", e);
    // Don’t hard-fail the whole admin screen because the competition API isn’t live yet.
    showInlineError(
      "Competition API not connected yet. Once PHP endpoints exist, this will load competitions."
    );
  }
})();
