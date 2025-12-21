function setUnavailable(msg = "Please check back later.") {
  document.getElementById("eventName").textContent = "Event unavailable";
  document.getElementById("eventDescription").textContent = msg;
  document.getElementById("eventLocation").textContent = "";
  document.getElementById("eventDates").textContent = "";
  const regEl = document.getElementById("eventDeadline");
  if (regEl) regEl.textContent = "";
}

function parseMySqlDatetime(dt) {
  if (!dt) return null;
  // MySQL DATETIME commonly comes as "YYYY-MM-DD HH:MM:SS".
  // Convert to ISO-ish so Date() parses consistently.
  return new Date(String(dt).replace(" ", "T"));
}

function fmtRange(start, end) {
  const opts = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  };

  if (!start && !end) return "";
  if (start && !end) return start.toLocaleString(undefined, opts);
  if (!start && end) return end.toLocaleString(undefined, opts);
  return `${start.toLocaleString(undefined, opts)} – ${end.toLocaleString(undefined, opts)}`;
}

function fmtDeadline(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

async function loadCurrentCompetition() {
  // Use the competitions list API and select the active competition (isActive), fallback to first.
  const res = await fetch("/api/competitions.list.php", { cache: "no-store" });

  if (!res.ok) {
    setUnavailable();
    return;
  }

  const data = await res.json();
  if (!data?.ok || !Array.isArray(data.competitions)) {
    setUnavailable("Bad response from server.");
    return;
  }

  const list = data.competitions;
  if (list.length === 0) {
    setUnavailable("No active event is configured yet.");
    return;
  }

  const current = list.find((c) => c && c.isActive) || list[0];

  const start = parseMySqlDatetime(current.start_at);
  const end = parseMySqlDatetime(current.end_at);
  const deadline = parseMySqlDatetime(current.registration_deadline);

  document.getElementById("eventName").textContent = current.name || "";
  document.getElementById("eventDescription").textContent = current.description || "";
  document.getElementById("eventLocation").textContent = current.location || "";
  document.getElementById("eventDates").textContent = fmtRange(start, end);

  const deadlineEl = document.getElementById("eventDeadline");
  if (deadlineEl) deadlineEl.textContent = fmtDeadline(deadline);
}

loadCurrentCompetition().catch((e) => {
  console.error(e);
  setUnavailable();
});
