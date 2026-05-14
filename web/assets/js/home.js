/**
 * Home Page Competition Display
 *
 * Fetches and displays competitions marked for the home page.
 * Shows status badges: Registration Open, Coming Soon, Closed.
 */

function parseMySqlDatetime(dt) {
  if (!dt) return null;
  // MySQL DATETIME commonly comes as "YYYY-MM-DD HH:MM:SS".
  return new Date(String(dt).replace(" ", "T"));
}

function fmtDateRange(start, end) {
  const opts = { month: "short", day: "numeric", year: "numeric" };

  if (!start && !end) return "";
  if (start && !end) return start.toLocaleDateString(undefined, opts);
  if (!start && end) return end.toLocaleDateString(undefined, opts);

  // If same day, just show one date
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString(undefined, opts);
  }

  // If same month/year, abbreviate
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}`;
}

function fmtDeadline(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStatusBadge(status) {
  switch (status) {
    case "registration_open":
      return `<span class="competition-status-badge status-open">
        <span class="status-dot"></span>
        Registration Open
      </span>`;
    case "coming_soon":
      return `<span class="competition-status-badge status-soon">
        <span class="status-dot"></span>
        Coming Soon
      </span>`;
    case "closed":
      return `<span class="competition-status-badge status-closed">
        Closed
      </span>`;
    default:
      return "";
  }
}

function renderFeaturedCard(comp) {
  const start = parseMySqlDatetime(comp.startAt);
  const end = parseMySqlDatetime(comp.endAt);
  const deadline = parseMySqlDatetime(comp.registrationDeadline);

  const dateRange = fmtDateRange(start, end);
  const deadlineStr = fmtDeadline(deadline);
  const imageUrl = comp.imageUrl || "./assets/reg-image.jpg";

  // Determine CTA button
  let ctaHtml = "";
  if (comp.status === "registration_open" && comp.isActive) {
    ctaHtml = `
      <a href="./register.html" class="competition-register-btn">
        <i data-lucide="clipboard-check"></i>
        <span>Register Now</span>
      </a>`;
  } else if (comp.status === "coming_soon") {
    ctaHtml = `
      <span class="competition-info-text">
        <i data-lucide="calendar-clock"></i>
        <span>Registration opens soon</span>
      </span>`;
  } else {
    ctaHtml = `
      <span class="competition-info-text">
        <i data-lucide="calendar-x"></i>
        <span>Registration closed</span>
      </span>`;
  }

  return `
    <div class="competition-card-featured" data-competition-id="${comp.id}">
      <div class="competition-card-image-wrapper">
        <img
          src="${escapeHtml(imageUrl)}"
          alt="${escapeHtml(comp.name)}"
          class="competition-card-image"
          loading="lazy"
          onerror="this.style.display='none'"
        />
      </div>
      <div class="competition-card-body">
        <div class="featured-badge">
          <i data-lucide="star"></i>
          <span>Featured Event</span>
        </div>
        <h3 class="competition-card-title">${escapeHtml(comp.name)}</h3>
        <p class="competition-card-description">${escapeHtml(comp.description || "")}</p>

        <div class="competition-card-meta">
          <div class="competition-meta-item">
            <i data-lucide="map-pin"></i>
            <span>${escapeHtml(comp.location || "Location TBA")}</span>
          </div>
          <div class="competition-meta-item">
            <i data-lucide="calendar-days"></i>
            <span>${escapeHtml(dateRange || "Dates TBA")}</span>
          </div>
          ${deadlineStr ? `
          <div class="competition-meta-item">
            <i data-lucide="clock"></i>
            <span>Registration deadline: <strong>${escapeHtml(deadlineStr)}</strong></span>
          </div>
          ` : ""}
        </div>
        ${ctaHtml}
      </div>
    </div>
  `;
}

function renderSmallCard(comp) {
  const start = parseMySqlDatetime(comp.startAt);
  const end = parseMySqlDatetime(comp.endAt);
  const deadline = parseMySqlDatetime(comp.registrationDeadline);

  const dateRange = fmtDateRange(start, end);
  const deadlineStr = fmtDeadline(deadline);
  const imageUrl = comp.imageUrl || "./assets/reg-image.jpg";
  const statusBadge = getStatusBadge(comp.status);

  // Determine CTA button
  let ctaHtml = "";
  if (comp.status === "registration_open" && comp.isActive) {
    ctaHtml = `
      <div class="competition-card-footer">
        <a href="./register.html" class="competition-register-btn">
          <i data-lucide="clipboard-check"></i>
          <span>Register</span>
        </a>
      </div>`;
  } else if (comp.status === "coming_soon") {
    ctaHtml = `
      <div class="competition-card-footer competition-card-footer-muted">
        <span class="competition-info-text">
          <i data-lucide="calendar-clock"></i>
          <span>Coming soon</span>
        </span>
      </div>`;
  } else {
    ctaHtml = `
      <div class="competition-card-footer competition-card-footer-muted">
        <span class="competition-info-text">
          <i data-lucide="calendar-x"></i>
          <span>Closed</span>
        </span>
      </div>`;
  }

  return `
    <div class="competition-card-small" data-competition-id="${comp.id}">
      <div class="competition-card-image-wrapper">
        <img
          src="${escapeHtml(imageUrl)}"
          alt="${escapeHtml(comp.name)}"
          class="competition-card-image"
          loading="lazy"
          onerror="this.style.display='none'"
        />
        ${statusBadge}
      </div>
      <div class="competition-card-body">
        <h3 class="competition-card-title">${escapeHtml(comp.name)}</h3>
        <p class="competition-card-description">${escapeHtml(comp.description || "")}</p>

        <div class="competition-card-meta">
          <div class="competition-meta-item">
            <i data-lucide="map-pin"></i>
            <span>${escapeHtml(comp.location || "Location TBA")}</span>
          </div>
          <div class="competition-meta-item">
            <i data-lucide="calendar-days"></i>
            <span>${escapeHtml(dateRange || "Dates TBA")}</span>
          </div>
        </div>
      </div>
      ${ctaHtml}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i data-lucide="calendar-off"></i>
      </div>
      <h3 class="empty-state-title">No Upcoming Competitions</h3>
      <p class="empty-state-text">Check back soon for new competition announcements.</p>
    </div>
  `;
}

async function loadCompetitions() {
  const featuredContainer = document.getElementById("featuredCompetition");
  const otherSection = document.getElementById("otherCompetitionsSection");
  const otherContainer = document.getElementById("otherCompetitions");
  const sectionTitle = document.getElementById("competitionsSectionTitle");

  if (!featuredContainer) {
    console.error("featuredCompetition container not found");
    return;
  }

  try {
    let data;
    if (window.api && window.api.competitions && window.api.competitions.getHome) {
      data = await window.api.competitions.getHome();
    } else {
      const res = await fetch("/api/competitions.home.php", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load competitions");
      }
      data = await res.json();
    }

    if (!data?.ok || !Array.isArray(data.competitions)) {
      featuredContainer.innerHTML = renderEmptyState();
      return;
    }

    const competitions = data.competitions;

    if (competitions.length === 0) {
      featuredContainer.innerHTML = renderEmptyState();
      return;
    }

    // Update section title based on count
    if (sectionTitle) {
      sectionTitle.textContent = competitions.length === 1
        ? "Upcoming Competition"
        : "Upcoming Competitions";
    }

    // First competition is featured
    const [featured, ...others] = competitions;
    featuredContainer.innerHTML = renderFeaturedCard(featured);

    // Render remaining competitions in grid
    if (others.length > 0 && otherSection && otherContainer) {
      otherSection.style.display = "block";
      otherContainer.innerHTML = others.map(renderSmallCard).join("");
    }

    // Re-initialize Lucide icons for the new content
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  } catch (e) {
    console.error("Failed to load competitions:", e);
    featuredContainer.innerHTML = renderEmptyState();
  }
}

// Initialize
loadCompetitions();
