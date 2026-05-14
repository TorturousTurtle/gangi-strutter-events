// web/assets/js/admin/reports/shared.js

export function chunkArray(arr, size) {
  const out = [];
  const n = Array.isArray(arr) ? arr.length : 0;
  for (let i = 0; i < n; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function formatCompetitionDate(c) {
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

  const s = String(raw).trim();
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return s;

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function extractEventSelections(reg) {
  const selections =
    Array.isArray(reg?.eventSelections)
      ? reg.eventSelections
      : Array.isArray(reg?.event_selections)
      ? reg.event_selections
      : [];

  return (selections || [])
    .map((e) => (e && e.name ? String(e.name) : ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getRegistrationsForCompetition(competitionId, API, fetchJson) {
  const qs = new URLSearchParams();
  if (competitionId) qs.set("competition_id", String(competitionId));

  const url = qs.toString()
    ? `${API.listRegistrations}?${qs.toString()}`
    : API.listRegistrations;

  return fetchJson(url, { method: "GET" }).then((data) =>
    Array.isArray(data?.registrations) ? data.registrations : []
  );
}
