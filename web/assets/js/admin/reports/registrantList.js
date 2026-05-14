import {
  formatCompetitionDate,
  extractEventSelections,
  getRegistrationsForCompetition,
} from "./shared.js";
import { openPrintWindow } from "./printWindow.js";

export function makeRegistrantListReporter({
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCompetitionsCache,
}) {
  function buildPrintableRegistrantListHtml({ competition, regs }) {
    const compDate = formatCompetitionDate(competition);
    const compName =
      competition?.name ?? competition?.competitionName ?? competition?.title ?? "";
    const compLoc =
      competition?.location ?? competition?.venue ?? competition?.city ?? "";

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
        .c-created { white-space: nowrap; font-size: 10px; line-height: 1.1; }
        .c-email, .c-phone { overflow-wrap: anywhere; word-break: break-word; }
        td.c-email, td.c-phone { font-size: 10px; line-height: 1.15; }

        @media print { .no-print { display: none !important; } }
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
        const created = createdRaw
          ? new Date(createdRaw.replace(" ", "T")).toLocaleDateString()
          : "";

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

  return async function generatePrintableRegistrantList(competitionId) {
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
        console.warn("[registrantList] failed to load competition:", e);
      }
    }

    const regs = await getRegistrationsForCompetition(competitionId, API, fetchJson);

    regs.sort((a, b) => {
      const ad = String(a?.createdAt ?? a?.created_at ?? "");
      const bd = String(b?.createdAt ?? b?.created_at ?? "");
      if (ad && bd && ad !== bd) return bd.localeCompare(ad);
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });

    const html = buildPrintableRegistrantListHtml({
      competition: competition || {},
      regs,
    });
    openPrintWindow(html, { showToast });
  };
}
