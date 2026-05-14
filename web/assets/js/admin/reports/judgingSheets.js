import {
  chunkArray,
  formatCompetitionDate,
  extractEventSelections,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeJudgingSheetsReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
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
          <th class="col-coach"></th>
          <th class="col-name">Twirler</th>
          ${scoreCols
            .map((c) => `<th class="col-score col-score-head">${escapeHtml(c)}</th>`)
            .join("")}
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

        .col-coach { width: 3%; text-align: left; }
        .col-name { width: 13%; text-align: left; }
        .col-score { width: 6.4%; text-align: center; }

        /* Remove the vertical border line between Coach Code and Twirler columns */
        th.col-coach, td.col-coach { border-right: 0 !important; }
        th.col-name, td.col-name { border-left: 0 !important; }

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

        .page-header { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 6px; }
        .page-header, .table-wrap, .footer { break-inside: avoid; page-break-inside: avoid; }
        table { break-inside: avoid; page-break-inside: avoid; }

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
      .map((p) => {
        const rowsHtml = (p.rows || [])
          .map((r) => {
            const coachCode = String(r.coachCode || "");
            const name = String(r.contestantName || "");

            const blanks = scoreCols.map(() => `<td></td>`).join("");

            return `
              <tr>
                <td class="col-coach">${escapeHtml(coachCode)}</td>
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

  return async function generatePrintableJudgingSheets(competitionId) {
    let competition =
      (getCompetitionsCache() || []).find(
        (c) => String(c.id) === String(competitionId)
      ) || null;

    const needsFetch =
      !competition || !competition.name || !competition.location || !competition.start_at;

    if (needsFetch) {
      try {
        const qs = new URLSearchParams({ id: String(competitionId) }).toString();
        const data = await fetchJson(`${API.getCompetition}?${qs}`, { method: "GET" });
        if (data?.competition) competition = data.competition;
      } catch (e) {
        console.warn("[judgingSheets] failed to load competition for print:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    // Allowlist of coach IDs whose codes may print on judging sheets for this competition.
    // Controlled in Registration Fields > Coaches (include_code_on_judging_sheet).
    let allowedCoachIdsForPrint = null;
    try {
      if (API?.listCompetitionCoaches) {
        const qs2 = new URLSearchParams({ competition_id: String(competitionId) }).toString();
        const cfg = await fetchJson(`${API.listCompetitionCoaches}?${qs2}`, { method: "GET" });
        const rows = Array.isArray(cfg?.coaches) ? cfg.coaches : [];
        allowedCoachIdsForPrint = new Set(
          rows
            .filter((row) => Number(row?.include_code_on_judging_sheet ?? 0) === 1)
            .map((row) => Number(row?.coach_id ?? row?.id ?? 0))
            .filter((id) => id > 0)
        );
      }
    } catch (e) {
      console.warn("[judgingSheets] failed to load coach print config:", e);
      allowedCoachIdsForPrint = null;
    }

    const groups = new Map();

    regs.forEach((r) => {
      const ageDivision =
        String(r?.ageDivision ?? r?.age_division ?? "").trim() || "(No age division)";
      
      const selections = extractEventSelections(r);

      const contestantName = `${String(r?.firstName ?? r?.first_name ?? "").trim()} ${String(
        r?.lastName ?? r?.last_name ?? ""
      ).trim()}`.trim();

      const coachCode = (() => {
        // Prefer already-decoded coach selections if provided by admin-list.php
        let arr = Array.isArray(r?.coachSelections) ? r.coachSelections : null;

        if (!arr) {
          const raw = r?.coach_selections_json ?? r?.coachSelectionsJson ?? null;
          if (!raw) return "";
          try {
            arr = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch {
            return "";
          }
        }

        if (!Array.isArray(arr)) return "";

        const codes = arr
          .map((c) => {
            const id = Number(c?.id ?? c?.coach_id ?? 0);
            const code = String(c?.internal_code ?? c?.internalCode ?? "").trim();
            const upper = code.toUpperCase();

            // Ignore free-text/OTHER entries and invalid ids
            if (!code || upper === "OTHER" || id <= 0) return "";

            // Enforce competition-level allowlist when available
            if (allowedCoachIdsForPrint && allowedCoachIdsForPrint.size > 0) {
              if (!allowedCoachIdsForPrint.has(id)) return "";
            }

            return code;
          })
          .filter(Boolean);

        return codes.join(", ");
      })();

      selections.forEach((eventNameRaw) => {
        const eventName = String(eventNameRaw || "").trim();
        if (!eventName) return;

        const key = `${eventName}|||${ageDivision}`;
        if (!groups.has(key)) groups.set(key, { eventName, ageDivision, rows: [] });

        groups.get(key).rows.push({
          coachCode,
          contestantName,
        });
      });
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const en = a.eventName.localeCompare(b.eventName);
      if (en !== 0) return en;
      return a.ageDivision.localeCompare(b.ageDivision);
    });

    sortedGroups.forEach((g) => {
      g.rows.sort((a, b) => a.contestantName.localeCompare(b.contestantName));
    });

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
      showToast(
        "No judging sheets to generate (no registrations / no event selections).",
        "info"
      );
      return;
    }

    const html = buildJudgingSheetsHtml({ competition: competition || {}, pages });
    openPrintWindow(html, { showToast });
  };
}
