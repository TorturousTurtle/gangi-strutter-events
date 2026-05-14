// web/assets/js/admin/reports/coachRoster.js
// Coach Roster Report: registrants grouped by coach with name, code, and counts

import {
  formatCompetitionDate,
  extractEventSelections,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeCoachRosterReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
  function buildCoachRosterHtml({ competition, coachGroups }) {
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
        @page { size: letter portrait; margin: 0.5in; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
        .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 800; margin: 0; }
        .subtitle { font-size: 14px; color: #555; margin: 4px 0 0 0; }

        .coach-section { margin-bottom: 24px; page-break-inside: avoid; }
        .coach-header {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .coach-name { font-size: 16px; font-weight: 700; }
        .coach-code { font-size: 13px; color: #6b7280; margin-left: 8px; }
        .coach-count { font-size: 14px; color: #374151; font-weight: 600; }

        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 12px; }
        th { font-weight: 600; background: #fafafa; }

        .summary {
          margin-top: 30px;
          padding: 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .summary-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
        .summary-table { width: auto; }
        .summary-table td { padding: 4px 16px 4px 0; border: none; font-size: 13px; }
        .summary-table td:last-child { text-align: right; font-weight: 600; }

        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }

        @media print {
          .no-print { display: none !important; }
          .coach-section { page-break-inside: avoid; }
        }
      </style>
    `;

    const coachSectionsHtml = coachGroups
      .map((g) => {
        const registrantsHtml = g.registrants
          .map(
            (r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.ageDivision)}</td>
              <td>${escapeHtml(r.events)}</td>
            </tr>
          `
          )
          .join("");

        return `
          <div class="coach-section">
            <div class="coach-header">
              <div>
                <span class="coach-name">${escapeHtml(g.coachName)}</span>
                ${g.coachCode ? `<span class="coach-code">(${escapeHtml(g.coachCode)})</span>` : ""}
              </div>
              <span class="coach-count">${g.registrants.length} registrant${g.registrants.length !== 1 ? "s" : ""}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width:30%;">Name</th>
                  <th style="width:20%;">Age Division</th>
                  <th style="width:50%;">Events</th>
                </tr>
              </thead>
              <tbody>
                ${registrantsHtml}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const summaryRowsHtml = coachGroups
      .map(
        (g) => `
        <tr>
          <td>${escapeHtml(g.coachName)}${g.coachCode ? " (" + escapeHtml(g.coachCode) + ")" : ""}</td>
          <td>${g.registrants.length}</td>
        </tr>
      `
      )
      .join("");

    const totalRegistrants = coachGroups.reduce((sum, g) => sum + g.registrants.length, 0);

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Coach Roster Report</title>
          ${style}
        </head>
        <body>
          <div class="no-print" style="position:fixed; top:10px; left:10px; z-index:9999; background:#fff; padding:6px 8px; border:1px solid #ccc; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <button onclick="window.print()" style="padding:6px 10px; font-size:12px;">Print</button>
            <span style="font-size:12px; margin-left:8px; opacity:0.8;">Tip: use your browser print dialog to save as PDF.</span>
          </div>

          <div class="header">
            <p class="title">Coach Roster Report</p>
            <p class="subtitle">${escapeHtml(compName)} ${compDate ? "— " + escapeHtml(compDate) : ""}</p>
            ${compLoc ? `<p class="subtitle">${escapeHtml(compLoc)}</p>` : ""}
          </div>

          ${coachSectionsHtml}

          <div class="summary">
            <div class="summary-title">Summary by Coach</div>
            <table class="summary-table">
              <tbody>
                ${summaryRowsHtml}
                <tr style="border-top: 1px solid #ccc;">
                  <td style="font-weight: 700;">Total</td>
                  <td style="font-weight: 700;">${totalRegistrants}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    return html;
  }

  function groupByCoach(regs) {
    const coachMap = new Map(); // coachKey -> { coachName, coachCode, registrants[] }

    for (const r of regs) {
      // Get coach info from coachSelections if available, otherwise fall back to coachName
      let coachName = "";
      let coachCode = "";

      const coachSels = Array.isArray(r.coachSelections) ? r.coachSelections : [];
      if (coachSels.length > 0) {
        // Use first coach selection
        const first = coachSels[0];
        coachName = String(first.name || "").trim();
        coachCode = String(first.internal_code || first.internalCode || "").trim();
      }

      // Fallback to legacy coachName field
      if (!coachName) {
        coachName = String(r.coachName || "").trim() || "(No Coach)";
      }

      const coachKey = coachCode || coachName.toLowerCase();

      if (!coachMap.has(coachKey)) {
        coachMap.set(coachKey, {
          coachName,
          coachCode,
          registrants: [],
        });
      }

      const group = coachMap.get(coachKey);

      // Build registrant info
      const name = `${String(r.firstName || "").trim()} ${String(r.lastName || "").trim()}`.trim();
      const ageDivision = String(r.ageDivision || r.age_division || "").trim();
      const events = extractEventSelections(r).join(", ");

      group.registrants.push({
        name,
        ageDivision,
        events,
      });
    }

    // Sort coaches by name, then sort registrants within each group
    const sortedGroups = Array.from(coachMap.values())
      .sort((a, b) => a.coachName.localeCompare(b.coachName));

    for (const g of sortedGroups) {
      g.registrants.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedGroups;
  }

  return async function generateCoachRoster(competitionId) {
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
        console.warn("[coachRoster] failed to load competition:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    if (regs.length === 0) {
      showToast("No registrations found for this competition.", "info");
      return;
    }

    const coachGroups = groupByCoach(regs);
    const html = buildCoachRosterHtml({ competition: competition || {}, coachGroups });
    openPrintWindow(html, { showToast });
  };
}
