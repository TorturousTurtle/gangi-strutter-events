// web/assets/js/admin/reports/financialSummary.js
// Financial Summary Report: revenue breakdown by event, facility fees, optional products

import {
  formatCompetitionDate,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeFinancialSummaryReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
  function money(n) {
    const x = Number(n);
    return Number.isFinite(x) ? "$" + x.toFixed(2) : "$0.00";
  }

  function buildFinancialSummaryHtml({ competition, summary }) {
    const compDate = formatCompetitionDate(competition);
    const compName =
      competition?.name ??
      competition?.competitionName ??
      competition?.title ??
      "";
    const compLoc =
      competition?.location ??
      competition?.venue ??
      "";

    const style = `
      <style>
        @page { size: letter portrait; margin: 0.75in; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
        .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 800; margin: 0; }
        .subtitle { font-size: 14px; color: #555; margin: 4px 0 0 0; }

        .section { margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 12px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
        th { font-weight: 600; background: #f9f9f9; }
        .num { text-align: right; font-family: monospace; }
        .total-row { font-weight: 700; background: #f3f4f6; border-top: 2px solid #000; }
        .grand-total { font-size: 18px; font-weight: 800; background: #e5e7eb; }

        .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .summary-row:last-child { border-bottom: none; }
        .summary-label { font-weight: 600; }
        .summary-value { font-family: monospace; font-size: 16px; }
        .summary-grand { font-size: 20px; font-weight: 800; color: #059669; }

        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }

        @media print {
          .no-print { display: none !important; }
        }
      </style>
    `;

    const eventRowsHtml = summary.eventBreakdown
      .map(
        (e) => `
        <tr>
          <td>${escapeHtml(e.name)}</td>
          <td class="num">${e.count}</td>
          <td class="num">${money(e.unitPrice)}</td>
          <td class="num">${money(e.total)}</td>
        </tr>
      `
      )
      .join("");

    const eventsTotalRow = `
      <tr class="total-row">
        <td>Subtotal (Events)</td>
        <td class="num">${summary.totalEventEntries}</td>
        <td class="num">—</td>
        <td class="num">${money(summary.eventRevenue)}</td>
      </tr>
    `;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Financial Summary Report</title>
          ${style}
        </head>
        <body>
          <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
            <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
          </div>

          <div class="header">
            <p class="title">Financial Summary Report</p>
            <p class="subtitle">${escapeHtml(compName)} ${compDate ? "— " + escapeHtml(compDate) : ""}</p>
            ${compLoc ? `<p class="subtitle">${escapeHtml(compLoc)}</p>` : ""}
          </div>

          <div class="section">
            <div class="section-title">Event Revenue Breakdown</div>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th class="num">Entries</th>
                  <th class="num">Unit Price</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                ${eventRowsHtml}
                ${eventsTotalRow}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Additional Fees & Products</div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="num">Count</th>
                  <th class="num">Unit Price</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Facility Fees</td>
                  <td class="num">${summary.registrantCount}</td>
                  <td class="num">${money(summary.avgFacilityFee)}</td>
                  <td class="num">${money(summary.facilityFeeRevenue)}</td>
                </tr>
                ${summary.optionalProductRevenue > 0 ? `
                <tr>
                  <td>${escapeHtml(summary.optionalProductName || "Optional Product")}</td>
                  <td class="num">${summary.optionalProductCount}</td>
                  <td class="num">${money(summary.avgOptionalProductPrice)}</td>
                  <td class="num">${money(summary.optionalProductRevenue)}</td>
                </tr>
                ` : ""}
              </tbody>
            </table>
          </div>

          <div class="summary-box">
            <div class="summary-row">
              <span class="summary-label">Total Registrants</span>
              <span class="summary-value">${summary.registrantCount}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Event Revenue</span>
              <span class="summary-value">${money(summary.eventRevenue)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Facility Fee Revenue</span>
              <span class="summary-value">${money(summary.facilityFeeRevenue)}</span>
            </div>
            ${summary.optionalProductRevenue > 0 ? `
            <div class="summary-row">
              <span class="summary-label">Optional Product Revenue</span>
              <span class="summary-value">${money(summary.optionalProductRevenue)}</span>
            </div>
            ` : ""}
            <div class="summary-row">
              <span class="summary-label summary-grand">Gross Revenue</span>
              <span class="summary-value summary-grand">${money(summary.grossRevenue)}</span>
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    return html;
  }

  function computeSummary(regs) {
    const eventMap = new Map(); // eventName -> { count, totalRevenue, prices[] }
    let facilityFeeRevenue = 0;
    let optionalProductRevenue = 0;
    let optionalProductCount = 0;
    let optionalProductName = "";
    const optionalProductPrices = [];

    for (const r of regs) {
      // Facility fee
      facilityFeeRevenue += Number(r.facilityFee) || 0;

      // Optional product
      if (r.optionalProductSelected === 1) {
        optionalProductCount++;
        const price = Number(r.optionalProductPrice) || 0;
        optionalProductRevenue += price;
        optionalProductPrices.push(price);
        if (!optionalProductName && r.optionalProductName) {
          optionalProductName = r.optionalProductName;
        }
      }

      // Event selections
      const selections = Array.isArray(r.eventSelections) ? r.eventSelections : [];
      for (const sel of selections) {
        const name = String(sel.name || "").trim();
        const price = Number(sel.price) || 0;
        if (!name) continue;

        if (!eventMap.has(name)) {
          eventMap.set(name, { count: 0, totalRevenue: 0, prices: [] });
        }
        const entry = eventMap.get(name);
        entry.count++;
        entry.totalRevenue += price;
        entry.prices.push(price);
      }
    }

    // Build event breakdown sorted by name
    const eventBreakdown = Array.from(eventMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.totalRevenue,
        unitPrice: data.prices.length > 0 ? data.prices[0] : 0, // assume uniform pricing
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const eventRevenue = eventBreakdown.reduce((sum, e) => sum + e.total, 0);
    const totalEventEntries = eventBreakdown.reduce((sum, e) => sum + e.count, 0);
    const grossRevenue = eventRevenue + facilityFeeRevenue + optionalProductRevenue;

    return {
      registrantCount: regs.length,
      eventBreakdown,
      eventRevenue,
      totalEventEntries,
      facilityFeeRevenue,
      avgFacilityFee: regs.length > 0 ? facilityFeeRevenue / regs.length : 0,
      optionalProductCount,
      optionalProductName,
      optionalProductRevenue,
      avgOptionalProductPrice: optionalProductCount > 0 ? optionalProductRevenue / optionalProductCount : 0,
      grossRevenue,
    };
  }

  return async function generateFinancialSummary(competitionId) {
    let competition =
      (getCompetitionsCache() || []).find(
        (c) => String(c.id) === String(competitionId)
      ) || null;

    const needsFetch =
      !competition || !competition.name || !competition.location;

    if (needsFetch) {
      try {
        const qs = new URLSearchParams({ id: String(competitionId) }).toString();
        const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });
        if (data?.competition) competition = data.competition;
      } catch (e) {
        console.warn("[financialSummary] failed to load competition:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    if (regs.length === 0) {
      showToast("No registrations found for this competition.", "info");
      return;
    }

    const summary = computeSummary(regs);
    const html = buildFinancialSummaryHtml({ competition: competition || {}, summary });
    openPrintWindow(html, { showToast });
  };
}
