// web/assets/js/admin/tabs/registrants.js
// Registrants tab module (Overview + Detailed)

import { initDataTable } from "./dataTable.js";

export function initRegistrantsTab({
  els,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getRevenueValueEl,
}) {
  // Reference to charts module (set via setChartsModule)
  let chartsModule = null;
  // Reference to dashboard module (set via setDashboardModule)
  let dashboardModule = null;
  // Reference to data table module
  let dataTableModule = null;

  /**
   * Format payment status as a colored badge
   */
  function formatPaymentStatusBadge(status) {
    const statusLower = (status || "pending").toLowerCase();

    const badges = {
      completed: '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Paid</span>',
      pending: '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>',
      pending_manual: '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Pay Later</span>',
      failed: '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Failed</span>',
    };

    return badges[statusLower] || badges.pending;
  }

  // Current competition ID for reloading on pagination
  let currentCompetitionId = null;

  // Pagination callback - reload data when page changes
  async function handlePageChange(page, perPage) {
    if (currentCompetitionId) {
      await loadRegistrations(currentCompetitionId, { page, perPage });
    }
  }

  // Initialize data table module for sorting/filtering
  dataTableModule = initDataTable({
    els,
    escapeHtml,
    showToast,
    formatPaymentStatusBadge,
    onPageChange: handlePageChange,
  });

  // Store last loaded registrations for chart updates
  let lastLoadedRegs = [];

  /**
   * Load registrations with optional pagination
   * @param {number|null} competitionId Competition ID
   * @param {Object} options Pagination options
   * @param {number} options.page Page number (default: 1)
   * @param {number} options.perPage Items per page (default: 50)
   */
  async function loadRegistrations(competitionId, options = {}) {
    currentCompetitionId = competitionId;

    const { page = 1, perPage = 50 } = options;

    const qs = new URLSearchParams();
    if (competitionId) qs.set("competition_id", String(competitionId));
    if (page > 1) qs.set("page", String(page));
    if (perPage !== 50) qs.set("per_page", String(perPage));

    const url = qs.toString()
      ? `${API.listRegistrations}?${qs.toString()}`
      : API.listRegistrations;

    console.log("[registrants] load:", url);

    // Show skeleton loading state while fetching
    if (dataTableModule && typeof dataTableModule.showSkeletonRows === "function") {
      els.empty?.classList.add("hidden");
      els.tableWrap?.classList.remove("hidden");
      dataTableModule.showSkeletonRows(5);
    }

    // Show dashboard skeleton if available (only on first page load, not pagination)
    if (page === 1 && dashboardModule && typeof dashboardModule.showSkeletons === "function") {
      dashboardModule.showSkeletons();
    }

    const data = await fetchJson(url, { method: "GET" });
    const regs = Array.isArray(data?.registrations) ? data.registrations : [];
    const paginationData = data?.pagination || null;

    lastLoadedRegs = regs;

    renderRegistrations(regs, paginationData);
    renderRegistrationsDetailed(regs);

    // Render charts if module is available (use total from pagination if available)
    if (chartsModule && typeof chartsModule.renderCharts === "function") {
      chartsModule.renderCharts(regs);
    }

    // Update dashboard metrics if module is available (only on first page)
    if (page === 1 && dashboardModule && typeof dashboardModule.updateDashboard === "function") {
      // If we have pagination, pass total count for accurate dashboard
      const dashboardRegs = paginationData ? { registrations: regs, total: paginationData.total } : regs;
      dashboardModule.updateDashboard(Array.isArray(dashboardRegs) ? dashboardRegs : regs);
      dashboardModule.setRegistrationUrl(competitionId);
    }

    return regs;
  }

  /**
   * Render registrations table
   * @param {Array} regs Registration data
   * @param {Object|null} paginationData Pagination metadata from server
   */
  function renderRegistrations(regs, paginationData = null) {
    const n = Array.isArray(regs) ? regs.length : 0;
    const total = paginationData?.total ?? n;

    const revenue = (Array.isArray(regs) ? regs : []).reduce((sum, r) => {
      const v = Number(r?.eventTotal ?? r?.event_total ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    const revEl = getRevenueValueEl();
    if (revEl) revEl.textContent = `$${revenue.toFixed(2)}`;

    // Show total count when using pagination
    if (els.count) els.count.textContent = String(total);
    if (els.count2) els.count2.textContent = String(total);

    if (n === 0) {
      els.empty?.classList.remove("hidden");
      els.tableWrap?.classList.add("hidden");
      return;
    }

    els.empty?.classList.add("hidden");
    els.tableWrap?.classList.remove("hidden");

    // Delegate table rendering to dataTableModule for sorting/filtering
    if (dataTableModule) {
      dataTableModule.setRegistrations(regs, paginationData);
    }
  }

  function renderRegistrationsDetailed(regs) {
    const tbodyEl = els.detailedTbody;
    const emptyRowEl = els.detailedEmptyRow;

    if (!tbodyEl) return;

    tbodyEl.innerHTML = "";

    const list = Array.isArray(regs) ? regs : [];

    if (list.length === 0) {
      if (emptyRowEl) tbodyEl.appendChild(emptyRowEl);
      return;
    }

    list.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";

      const created = r.createdAt
        ? new Date(String(r.createdAt).replace(" ", "T")).toLocaleDateString()
        : "";

      const subtotalNum = Number(r.eventSubtotal ?? r.event_subtotal ?? 0);
      const feeNum = Number(r.facilityFee ?? r.facility_fee ?? 0);
      const totalNum = Number(r.eventTotal ?? r.event_total ?? 0);

      const addonSelectedRaw = r.optionalProductSelected ?? r.optional_product_selected ?? 0;
      const addonSelected =
        addonSelectedRaw === true || addonSelectedRaw === 1 || String(addonSelectedRaw).toLowerCase() === "true";
      const addonName = String(r.optionalProductName ?? r.optional_product_name ?? "");
      const addonPriceNum = Number(r.optionalProductPrice ?? r.optional_product_price ?? 0);

      const subtotalText = Number.isFinite(subtotalNum) ? `$${subtotalNum.toFixed(2)}` : "";
      const feeText = Number.isFinite(feeNum) ? `$${feeNum.toFixed(2)}` : "";
      const totalText = Number.isFinite(totalNum) ? `$${totalNum.toFixed(2)}` : "";

      const addonSelectedText = addonSelected ? "Yes" : "";
      const addonNameText = addonSelected ? addonName : "";
      const addonPriceText = addonSelected && Number.isFinite(addonPriceNum) ? `$${addonPriceNum.toFixed(2)}` : "";

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
        td(addonSelectedText),
        td(addonNameText),
        td(addonPriceText),
        td(totalText),
        td(created),
      ].join("");

      tbodyEl.appendChild(tr);
    });
  }

  // Clear button (still stubbed)
  els.clearBtn?.addEventListener("click", async () => {
    if (!confirm("Clear ALL registrants? This cannot be undone.")) return;
    renderRegistrations([]);
    renderRegistrationsDetailed([]);
    showToast("Registrants cleared (stub).");
  });

  /**
   * Set the charts module reference for rendering analytics
   * @param {Object} module - The overviewCharts module with renderCharts method
   */
  function setChartsModule(module) {
    chartsModule = module;
    // If we already have registrations loaded, render charts immediately
    if (lastLoadedRegs.length > 0 && chartsModule) {
      chartsModule.renderCharts(lastLoadedRegs);
    }
  }

  /**
   * Set the dashboard module reference for updating metrics
   * @param {Object} module - The dashboard module with updateDashboard method
   */
  function setDashboardModule(module) {
    dashboardModule = module;
    // If we already have registrations loaded, update dashboard immediately
    if (lastLoadedRegs.length > 0 && dashboardModule) {
      dashboardModule.updateDashboard(lastLoadedRegs);
    }
  }

  /**
   * Get the data table module for external access
   */
  function getDataTableModule() {
    return dataTableModule;
  }

  return {
    loadRegistrations,
    renderRegistrations,
    renderRegistrationsDetailed,
    setChartsModule,
    setDashboardModule,
    getDataTableModule,
  };
}
