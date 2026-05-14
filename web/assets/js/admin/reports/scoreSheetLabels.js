
import {
  chunkArray,
  formatCompetitionDate,
  extractEventSelections,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeScoreSheetLabelsReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
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

    const style = `
      <style>
        @page { size: letter portrait; margin: 0; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }

        .sheet { width: 8.5in; height: 11in; box-sizing: border-box; page-break-after: always; break-after: page; }

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

    const body = (sheets || [])
      .map((sheet) => {
        const slots = Array.from({ length: 30 }).map(
          (_, i) => sheet.labels[i] || null
        );

        const labelHtml = slots
          .map((l) => {
            if (!l) return `<div class="label"></div>`;

            const age = l.ageDivision ? String(l.ageDivision).trim() : "";
            const eventLine = age
              ? `${String(l.eventName || "").trim()} (${age})`
              : String(l.eventName || "").trim();

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

  return async function generateScoreSheetLabels(competitionId) {
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
        console.warn("[scoreSheetLabels] failed to load competition:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    const items = [];
    regs.forEach((r) => {
      const ageDivision = String(r?.ageDivision ?? r?.age_division ?? "").trim();
      const selections = extractEventSelections(r);

      const name = `${String(r?.firstName ?? r?.first_name ?? "").trim()} ${String(
        r?.lastName ?? r?.last_name ?? ""
      ).trim()}`.trim();

      selections.forEach((eventNameRaw) => {
        const eventName = String(eventNameRaw || "").trim();
        if (!eventName) return;

        items.push({ eventName, ageDivision, name });
      });
    });

    if (items.length === 0) {
      showToast("No labels to generate (no registrations / no event selections).", "info");
      return;
    }

    items.sort((a, b) => {
      const en = String(a.eventName || "").localeCompare(String(b.eventName || ""));
      if (en !== 0) return en;

      const ad = String(a.ageDivision || "").localeCompare(String(b.ageDivision || ""));
      if (ad !== 0) return ad;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const sheets = chunkArray(items, 30).map((labels) => ({ labels }));

    const html = buildScoreSheetLabelsHtml({ competition: competition || {}, sheets });
    openPrintWindow(html, { showToast });
  };
}
