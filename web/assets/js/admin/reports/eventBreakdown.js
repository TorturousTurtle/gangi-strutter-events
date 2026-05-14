// web/assets/js/admin/reports/eventBreakdown.js
// Event Breakdown Report: events x age divisions grid with entry counts and totals

import {
  formatCompetitionDate,
  extractEventSelections,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeEventBreakdownReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
  function buildEventBreakdownHtml({ competition, matrix, events, ageDivisions, eventTotals, divisionTotals, grandTotal }) {
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
        @page { size: letter landscape; margin: 0.5in; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
        .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 800; margin: 0; }
        .subtitle { font-size: 14px; color: #555; margin: 4px 0 0 0; }

        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 10px; text-align: center; border: 1px solid #d1d5db; font-size: 12px; }
        th { font-weight: 600; background: #f3f4f6; }
        th.event-col { text-align: left; min-width: 150px; }
        td.event-col { text-align: left; font-weight: 500; }

        .total-col { background: #e5e7eb; font-weight: 700; }
        .total-row td { background: #e5e7eb; font-weight: 700; }
        .grand-total { background: #374151; color: #fff; font-weight: 800; font-size: 14px; }

        .zero { color: #9ca3af; }

        .legend { margin-top: 20px; font-size: 12px; color: #6b7280; }

        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }

        @media print {
          .no-print { display: none !important; }
        }
      </style>
    `;

    // Build header row
    const headerCells = ageDivisions
      .map((div) => `<th>${escapeHtml(div)}</th>`)
      .join("");

    // Build data rows
    const dataRowsHtml = events
      .map((eventName) => {
        const cells = ageDivisions
          .map((div) => {
            const count = matrix[eventName]?.[div] || 0;
            const cls = count === 0 ? "zero" : "";
            return `<td class="${cls}">${count}</td>`;
          })
          .join("");

        const rowTotal = eventTotals[eventName] || 0;

        return `
          <tr>
            <td class="event-col">${escapeHtml(eventName)}</td>
            ${cells}
            <td class="total-col">${rowTotal}</td>
          </tr>
        `;
      })
      .join("");

    // Build totals row
    const totalCells = ageDivisions
      .map((div) => `<td>${divisionTotals[div] || 0}</td>`)
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Event Breakdown Report</title>
          ${style}
        </head>
        <body>
          <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
            <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
          </div>

          <div class="header">
            <p class="title">Event Breakdown Report</p>
            <p class="subtitle">${escapeHtml(compName)} ${compDate ? "— " + escapeHtml(compDate) : ""}</p>
            ${compLoc ? `<p class="subtitle">${escapeHtml(compLoc)}</p>` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th class="event-col">Event</th>
                ${headerCells}
                <th class="total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              ${dataRowsHtml}
              <tr class="total-row">
                <td class="event-col">Total</td>
                ${totalCells}
                <td class="grand-total">${grandTotal}</td>
              </tr>
            </tbody>
          </table>

          <div class="legend">
            <p>Each cell shows the number of entries for that event/age division combination.</p>
            <p>Note: A single registrant may have multiple event entries.</p>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    return html;
  }

  function computeMatrix(regs) {
    const matrix = {}; // eventName -> { ageDivision -> count }
    const eventsSet = new Set();
    const divisionsSet = new Set();

    for (const r of regs) {
      const ageDivision = String(r.ageDivision || r.age_division || "").trim() || "(No Division)";
      const selections = extractEventSelections(r);

      divisionsSet.add(ageDivision);

      for (const eventName of selections) {
        eventsSet.add(eventName);

        if (!matrix[eventName]) {
          matrix[eventName] = {};
        }
        matrix[eventName][ageDivision] = (matrix[eventName][ageDivision] || 0) + 1;
      }
    }

    // Sort events and divisions alphabetically
    const events = Array.from(eventsSet).sort();
    const ageDivisions = Array.from(divisionsSet).sort();

    // Compute totals
    const eventTotals = {};
    const divisionTotals = {};
    let grandTotal = 0;

    for (const eventName of events) {
      eventTotals[eventName] = 0;
      for (const div of ageDivisions) {
        const count = matrix[eventName]?.[div] || 0;
        eventTotals[eventName] += count;
        divisionTotals[div] = (divisionTotals[div] || 0) + count;
        grandTotal += count;
      }
    }

    return {
      matrix,
      events,
      ageDivisions,
      eventTotals,
      divisionTotals,
      grandTotal,
    };
  }

  return async function generateEventBreakdown(competitionId) {
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
        console.warn("[eventBreakdown] failed to load competition:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    if (regs.length === 0) {
      showToast("No registrations found for this competition.", "info");
      return;
    }

    const { matrix, events, ageDivisions, eventTotals, divisionTotals, grandTotal } = computeMatrix(regs);

    if (events.length === 0) {
      showToast("No event selections found in registrations.", "info");
      return;
    }

    const html = buildEventBreakdownHtml({
      competition: competition || {},
      matrix,
      events,
      ageDivisions,
      eventTotals,
      divisionTotals,
      grandTotal,
    });
    openPrintWindow(html, { showToast });
  };
}
