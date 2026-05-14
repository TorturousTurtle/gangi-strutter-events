// web/assets/js/admin/tabs/downloadables.js
// Reports & Exports tab module

export function initDownloadablesTab({
  API,
  fetchJson, // not used yet but passed for symmetry/future
  showToast,
  escapeHtml, // not used yet but passed for symmetry/future

  // call these existing functions from admin.js (kept there for now)
  generatePrintableJudgingSheets,
  generateScoreSheetLabels,
  generatePrintableRegistrantList,

  // New Phase 4 reporters
  generateFinancialSummary,
  generateCoachRoster,
  generateEventBreakdown,
  openAdvancedExportModal,
}) {
  const panel = document.getElementById("tab-downloadables");
  if (!panel) return { init: () => {} };

  const errorEl = document.getElementById("downloadablesError");
  const buttons = Array.from(panel.querySelectorAll("button[data-report]"));

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  function getSelectedCompetitionId() {
    const sel = document.getElementById("competitionSelect");
    const v = sel ? String(sel.value || "").trim() : "";
    return v;
  }

  // Map report keys -> endpoints (placeholders for now)
  const endpoints = {
    // existing endpoint (already linked on Overview tab)
    registrants_csv: "../api/admin-export.php",

    // TODO: implement these PHP endpoints
    registrants_print: "../api/admin/reports/registrants.print.php",

    // Printable Judging Sheets (currently generated client-side)
    coach_checkin: "../api/admin/reports/judging-sheets.print.php",

    // Score Sheet Labels (currently generated client-side)
    score_sheet_labels: "../api/admin/reports/score-sheet-labels.print.php",
  };

  function wire() {
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        clearError();

        const key = btn.getAttribute("data-report");
        if (!key) {
          showError("Unknown report type.");
          return;
        }

        const competitionId = getSelectedCompetitionId();
        if (!competitionId) {
          showError("Select a competition first (Current Event tab).");
          return;
        }

        if (key === "coach_checkin") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generatePrintableJudgingSheets(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate judging sheets.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Printable Judging Sheets";
          }
          return;
        }

        if (key === "score_sheet_labels") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generateScoreSheetLabels(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate score sheet labels.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Score Sheet Labels";
          }
          return;
        }

        if (key === "registrants_print") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generatePrintableRegistrantList(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate printable registrant list.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Registrant List";
          }
          return;
        }

        // Financial Summary report
        if (key === "financial_summary") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generateFinancialSummary(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate financial summary.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Financial Summary";
          }
          return;
        }

        // Coach Roster report
        if (key === "coach_roster") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generateCoachRoster(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate coach roster.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Coach Roster";
          }
          return;
        }

        // Event Breakdown report
        if (key === "event_breakdown") {
          try {
            btn.disabled = true;
            btn.textContent = "Generating…";
            await generateEventBreakdown(competitionId);
          } catch (e) {
            console.error(e);
            showError(e?.message || "Failed to generate event breakdown.");
          } finally {
            btn.disabled = false;
            btn.textContent = "Event Breakdown";
          }
          return;
        }

        // Advanced Export Modal
        if (key === "advanced_export") {
          if (typeof openAdvancedExportModal === "function") {
            openAdvancedExportModal();
          } else {
            showError("Advanced export not available.");
          }
          return;
        }

        // Default behavior for other report types
        if (!endpoints[key]) {
          showError("Unknown report type.");
          return;
        }

        const url = new URL(endpoints[key], window.location.href);
        url.searchParams.set("competition_id", competitionId);
        window.open(url.toString(), "_blank", "noopener");
      });
    });
  }

  // wire immediately (matches how admin.js did it)
  wire();

  return { wire };
}
