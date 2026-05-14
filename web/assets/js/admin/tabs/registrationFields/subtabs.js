import { initRegistrationFieldsCoachesTab } from "./coaches.js";
import { initRegistrationFieldsFormFieldsTab } from "./formFields.js";

export function initRegistrationFieldsSubTabs({
  els,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  getCurrentCompetitionId,
  getCurrentFieldsConfig,
  setCurrentFieldsConfig,
  markRegFieldsDirty,
} = {}) {
  const emptyReturn = { coachesTab: null, formFieldsTab: null, load: null, save: null };

  if (!els) return emptyReturn;

  const tbody = els.availableRegEventsTbody;
  if (!tbody) return emptyReturn;

  const table = tbody.closest("table");
  const tableWrap = table?.parentElement || table;

  const tabRoot =
    tbody.closest("#tab-fields") ||
    tbody.closest("#tab-registration-fields") ||
    tableWrap?.closest("#tab-fields") ||
    tableWrap?.closest("#tab-registration-fields");

  const root = tabRoot || tableWrap?.parentElement || tableWrap;
  if (!root) return emptyReturn;

  const headings = root.querySelectorAll("h1,h2,h3,h4");
  for (const h of headings) {
    const t = String(h.textContent || "").trim();
    if (/^registration\s+fields$/i.test(t)) {
      h.style.display = "none";
      break;
    }
  }

  // Find the container where we'll append the coaches/formFields panels
  // This should be OUTSIDE the eventsTableWrapper so they don't get hidden together
  const eventsTableWrapper = document.getElementById("eventsTableWrapper");
  const eventsBox = eventsTableWrapper?.parentElement ||
    tbody.closest(".admin-section-card") ||
    tbody.closest(".p-4") ||
    tbody.closest(".card") ||
    tableWrap;

  // Shared description line (the one that starts with “Add events and decide …”).
  let sharedDescEl = null;
  let sharedDescOriginal = null;

  // Shared title exists in some layouts; we hide it when present.
  let sharedTitleEl = null;

  // Prefer a title element from the broader root if present
  const rootHeadings = root.querySelectorAll("h1,h2,h3,h4");
  for (const el of rootHeadings) {
    const t = String(el.textContent || "").trim();
    if (/^available\s+events$/i.test(t) || /^available\s+coaches$/i.test(t) || /^coaches$/i.test(t)) {
      sharedTitleEl = el;
      break;
    }
  }

  // Find the events description line. IMPORTANT: do NOT select a container that also contains buttons,
  // otherwise setting textContent will destroy the buttons (they become plain text).
  const descCandidates = root.querySelectorAll("p,div,span");
  for (const el of descCandidates) {
    // Skip anything that contains action buttons
    if (el.querySelector && el.querySelector("button")) continue;

    const t = String(el.textContent || "").trim();
    if (!t) continue;

    if (t.includes("Add events and decide")) {
      // Prefer the actual paragraph element if possible
      if (el.tagName === "P") {
        sharedDescEl = el;
        sharedDescOriginal = t;
        break;
      }

      // Otherwise, accept only if it looks like a standalone description (not a big wrapper)
      if (t.length < 220 && !t.includes("Create new") && !t.includes("Add event")) {
        sharedDescEl = el;
        sharedDescOriginal = t;
        break;
      }
    }
  }

  // If we didn't find a <p> first pass, do a second pass that prefers <p>
  if (!sharedDescEl) {
    const ps = root.querySelectorAll("p");
    for (const p of ps) {
      const t = String(p.textContent || "").trim();
      if (t.includes("Add events and decide") && !p.querySelector("button")) {
        sharedDescEl = p;
        sharedDescOriginal = t;
        break;
      }
    }
  }

  // Shared Add button (Add event / Add coach)
  let btnAddEvent = els.regEventAddBtn || null;
  if (!btnAddEvent) {
    const btns = root.querySelectorAll("button");
    for (const b of btns) {
      const t = String(b.textContent || "").trim();
      if (/^add\s+event$/i.test(t) || /^add\s+coach$/i.test(t)) {
        btnAddEvent = b;
        break;
      }
    }
  }

  // Check if subtabs already exist (avoid duplicates)
  const sectionCardCheck = eventsTableWrapper?.closest(".admin-section-card") || root;
  if (sectionCardCheck.querySelector("[data-regfields-subtabs='1']")) return emptyReturn;

  let activeSubTab = "events";

  const nav = document.createElement("div");
  nav.setAttribute("data-regfields-subtabs", "1");
  nav.style.display = "flex";
  nav.style.gap = "18px";
  nav.style.alignItems = "flex-end";
  nav.style.margin = "0 0 14px 0";
  nav.style.padding = "0 0 10px 0";
  nav.style.borderBottom = "1px solid rgba(0,0,0,0.08)";

  const btnEvents = document.createElement("button");
  btnEvents.type = "button";
  btnEvents.textContent = "Available Events";
  btnEvents.className = "";
  btnEvents.dataset.subtab = "events";
  btnEvents.style.background = "transparent";
  btnEvents.style.border = "none";
  btnEvents.style.padding = "8px 2px";
  btnEvents.style.outline = "none";
  btnEvents.style.boxShadow = "none";

  const btnCoaches = document.createElement("button");
  btnCoaches.type = "button";
  btnCoaches.textContent = "Coaches";
  btnCoaches.className = "";
  btnCoaches.dataset.subtab = "coaches";
  btnCoaches.style.background = "transparent";
  btnCoaches.style.border = "none";
  btnCoaches.style.padding = "8px 2px";
  btnCoaches.style.outline = "none";
  btnCoaches.style.boxShadow = "none";

  const btnFormFields = document.createElement("button");
  btnFormFields.type = "button";
  btnFormFields.textContent = "Form Fields";
  btnFormFields.className = "";
  btnFormFields.dataset.subtab = "formFields";
  btnFormFields.style.background = "transparent";
  btnFormFields.style.border = "none";
  btnFormFields.style.padding = "8px 2px";
  btnFormFields.style.outline = "none";
  btnFormFields.style.boxShadow = "none";

  nav.appendChild(btnEvents);
  nav.appendChild(btnCoaches);
  nav.appendChild(btnFormFields);

  // Create a wrapper for nav + add button
  const navWrapper = document.createElement("div");
  navWrapper.style.display = "flex";
  navWrapper.style.justifyContent = "space-between";
  navWrapper.style.alignItems = "center";
  navWrapper.style.marginBottom = "14px";
  navWrapper.style.padding = "16px 16px 14px 16px";
  navWrapper.style.borderBottom = "1px solid rgba(0,0,0,0.08)";

  // Remove border from nav since wrapper now has it
  nav.style.margin = "0";
  nav.style.padding = "0";
  nav.style.borderBottom = "none";

  navWrapper.appendChild(nav);

  // Move the add button into the nav wrapper
  if (btnAddEvent) {
    // Remove from original location
    btnAddEvent.parentElement?.removeChild(btnAddEvent);
    navWrapper.appendChild(btnAddEvent);
  }

  // Insert wrapper before the section header (tabs should be above the title)
  const sectionCard = eventsTableWrapper?.closest(".admin-section-card");
  const sectionHeader = sectionCard?.querySelector(".admin-section-header");
  if (sectionHeader) {
    sectionCard.insertBefore(navWrapper, sectionHeader);
  } else if (eventsTableWrapper) {
    eventsTableWrapper.parentElement?.insertBefore(navWrapper, eventsTableWrapper);
  } else {
    root.insertBefore(navWrapper, root.firstChild);
  }

  const coachesTab = initRegistrationFieldsCoachesTab({
    root,
    eventsBox,
    API,
    fetchJson,
    showToast,
    escapeHtml,
    getCurrentCompetitionId,
    markRegFieldsDirty,
  });

  const formFieldsTab = initRegistrationFieldsFormFieldsTab({
    root,
    eventsBox,
    API,
    fetchJson,
    showToast,
    escapeHtml,
    getCurrentCompetitionId,
    getCurrentFieldsConfig,
    setCurrentFieldsConfig,
    markRegFieldsDirty,
  });

  // When Coaches is active, the shared "Add" button should add a coach row,
  // and must NOT trigger the Events tab's Add Event handler.
  if (btnAddEvent && !btnAddEvent.dataset.regfieldsAddCoachWired) {
    btnAddEvent.dataset.regfieldsAddCoachWired = "1";
    btnAddEvent.addEventListener(
      "click",
      (e) => {
        if (activeSubTab !== "coaches") return;

        // Stop the Events tab listener (registered elsewhere) from running.
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        if (coachesTab && typeof coachesTab.startAddCoach === "function") {
          coachesTab.startAddCoach();
        }
      },
      true
    );
  }

  // When Form Fields is active, the shared "Add" button should open the add field modal.
  if (btnAddEvent && !btnAddEvent.dataset.regfieldsAddFieldWired) {
    btnAddEvent.dataset.regfieldsAddFieldWired = "1";
    btnAddEvent.addEventListener(
      "click",
      (e) => {
        if (activeSubTab !== "formFields") return;

        // Stop the Events tab listener (registered elsewhere) from running.
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        if (formFieldsTab && typeof formFieldsTab.startAddField === "function") {
          formFieldsTab.startAddField();
        }
      },
      true
    );
  }

  // Mark the container that holds the Events UI (and where Coaches will render into)
  if (eventsBox) eventsBox.setAttribute("data-regfields-panel", "events");

  function setButtonActive(btn, on) {
    btn.style.fontWeight = on ? "800" : "600";
    btn.style.opacity = on ? "1" : "0.75";
    btn.style.color = on ? "#1d4ed8" : "#111827";
    btn.style.borderBottom = on ? "3px solid #2563eb" : "3px solid transparent";
    btn.style.marginBottom = "-11px"; // tucks underline onto nav border
  }

  function setActive(next) {
    activeSubTab = next;
    if (activeSubTab === "coaches" && coachesTab?.load) {
      // Load on demand so it always reflects the currently-selected competition.
      coachesTab.load();
    }
    if (activeSubTab === "formFields" && formFieldsTab?.load) {
      // Load on demand so it always reflects the currently-selected competition.
      formFieldsTab.load();
    }

    // Find the section card and its elements
    const sectionCard = document.getElementById("eventsTableWrapper")?.closest(".admin-section-card");
    const coachesPanelEl = sectionCard?.querySelector("[data-regfields-panel='coaches']") || root.querySelector("[data-regfields-panel='coaches']");
    const formFieldsPanelEl = sectionCard?.querySelector("[data-regfields-panel='formFields']") || root.querySelector("[data-regfields-panel='formFields']");
    const sectionTitle = sectionCard?.querySelector(".admin-section-title");
    const sectionSubtitle = sectionCard?.querySelector(".admin-section-subtitle");

    // Update the section title and description based on active tab
    if (sectionTitle) {
      // Keep the icon if present
      const icon = sectionTitle.querySelector("i, svg");
      const iconHtml = icon ? icon.outerHTML : '';

      if (activeSubTab === "formFields") {
        sectionTitle.innerHTML = iconHtml + " Form Fields";
      } else if (activeSubTab === "coaches") {
        sectionTitle.innerHTML = iconHtml + " Coaches";
      } else {
        sectionTitle.innerHTML = iconHtml + " Available Events";
      }
    }
    if (sectionSubtitle) {
      if (activeSubTab === "formFields") {
        sectionSubtitle.textContent = "Configure which fields appear on the registration form for this competition.";
      } else if (activeSubTab === "coaches") {
        sectionSubtitle.textContent = "Choose which coaches appear on the registration form, and whether their code prints on judging sheets.";
      } else {
        sectionSubtitle.textContent = "Configure which events appear on the registration form and set prices.";
      }
    }
    // Reuse the existing Add button as a shared action button.
    // Events: "Add event" (existing behavior)
    // Coaches: "Add coach"
    // Form Fields: "Add field"
    if (btnAddEvent) {
      btnAddEvent.style.display = "";
      btnAddEvent.disabled = false;
      btnAddEvent.title = "";
      let label = "Add event";
      if (activeSubTab === "formFields") {
        label = "Add field";
      } else if (activeSubTab === "coaches") {
        label = "Add coach";
      }
      btnAddEvent.innerHTML = `<i data-lucide="plus"></i> ${label}`;
      // Re-initialize the icon
      if (typeof lucide !== "undefined") {
        lucide.createIcons({ nodes: [btnAddEvent] });
      }
    }
    // Switch visible content: hide the entire events wrapper (table + explanation)
    const eventsTableWrapper = document.getElementById("eventsTableWrapper");
    if (eventsTableWrapper) {
      eventsTableWrapper.style.display = (activeSubTab === "coaches" || activeSubTab === "formFields") ? "none" : "";
    }
    if (coachesPanelEl) {
      if (activeSubTab === "coaches") coachesPanelEl.classList.remove("hidden");
      else coachesPanelEl.classList.add("hidden");
    }
    if (formFieldsPanelEl) {
      if (activeSubTab === "formFields") formFieldsPanelEl.classList.remove("hidden");
      else formFieldsPanelEl.classList.add("hidden");
    }
    setButtonActive(btnEvents, activeSubTab === "events");
    setButtonActive(btnCoaches, activeSubTab === "coaches");
    setButtonActive(btnFormFields, activeSubTab === "formFields");
  }

  btnEvents.addEventListener("click", () => setActive("events"));
  btnCoaches.addEventListener("click", () => setActive("coaches"));
  btnFormFields.addEventListener("click", () => setActive("formFields"));

  setActive(activeSubTab);

  return {
    coachesTab,
    formFieldsTab,
    load: coachesTab?.load,
    save: coachesTab?.save,
  };
}
