// web/assets/js/admin/tabs/registrationFields.js
// Registration Fields tab module

import { initRegistrationFieldsEventsTab } from "./registrationFields/events.js";
import { initRegistrationFieldsSubTabs } from "./registrationFields/subtabs.js";

export function initRegistrationFieldsTab({
  els,
  API,
  fetchJson,
  showToast,
  escapeHtml,
  money,

  // shared state accessors
  getCurrentCompetitionId,
  getCurrentEventCatalog,
  setCurrentEventCatalog,
  getCurrentRegConfig,
  setCurrentRegConfig,
  getCurrentFieldsConfig,
  setCurrentFieldsConfig,

  // dirty state hooks (keep in admin.js for now)
  markRegFieldsDirty,
  clearRegFieldsDirty,
}) {

  function readCompetitionFromEls() {
    const id = Number(getCurrentCompetitionId() || 0);

    const facilityFeeRaw = els.facilityFee
      ? String(els.facilityFee.value || "").trim()
      : "";
    const facilityFeeNum = facilityFeeRaw === "" ? 0 : Number(facilityFeeRaw);

    const productEnabled = els.productEnabled ? !!els.productEnabled.checked : false;
    const productNameRaw = els.productName ? String(els.productName.value || "").trim() : "";
    const productPriceRaw = els.productPrice ? String(els.productPrice.value || "").trim() : "";
    const productPriceNum = productPriceRaw === "" ? 0 : Number(productPriceRaw);

    return {
      id,
      name: els.name ? els.name.value.trim() : "",
      location: els.location ? els.location.value.trim() : "",
      startDate: els.start ? els.start.value : "",
      endDate: els.end ? els.end.value : "",
      registrationDeadline: els.deadline ? els.deadline.value : "",
      description: els.desc ? els.desc.value.trim() : "",
      facilityFee:
        Number.isFinite(facilityFeeNum) && facilityFeeNum >= 0
          ? facilityFeeNum
          : 0,
      productEnabled,
      productName: productEnabled ? productNameRaw : "",
      productPrice:
        productEnabled && Number.isFinite(productPriceNum) && productPriceNum >= 0
          ? productPriceNum
          : 0,
      isActive: els.active ? !!els.active.checked : false,
    };
  }

  async function saveRegistrationFields() {
    const competitionId = getCurrentCompetitionId();
    if (!competitionId) {
      showToast("Select a competition first.", "error");
      return;
    }

    // Snapshot current config from DOM before saving
    if (eventsTab?.snapshotFromDom) eventsTab.snapshotFromDom();

    // Snapshot form fields config if available
    if (subTabs?.formFieldsTab?.snapshotToParent) {
      subTabs.formFieldsTab.snapshotToParent();
    }

    const payload = readCompetitionFromEls();
    payload.id = Number(competitionId);

    // Persist these on the competition row
    payload.eventCatalog = getCurrentEventCatalog();
    payload.registrationOptions = getCurrentRegConfig();
    payload.fieldsConfig = getCurrentFieldsConfig();

    const res = await fetchJson(API.saveCompetition, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res?.ok) throw new Error(res?.error || "Save failed.");

    // Save coaches config (if wired) as part of the same overall save.
    // coachesTab comes from initRegistrationFieldsSubTabs(...) and may expose save().
    if (subTabs?.coachesTab && typeof subTabs.coachesTab.save === "function") {
      await subTabs.coachesTab.save();
    }

    showToast("Registration fields saved.", "success");
    if (els.regEventsSaveBtn) els.regEventsSaveBtn.disabled = true;
    clearRegFieldsDirty();

    // Auto-refresh after a short delay to show updated data
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  const eventsTab = initRegistrationFieldsEventsTab({
    els,
    API,
    fetchJson,
    showToast,
    escapeHtml,
    money,
    getCurrentCompetitionId,
    getCurrentEventCatalog,
    setCurrentEventCatalog,
    getCurrentRegConfig,
    setCurrentRegConfig,
    markRegFieldsDirty,
  });

  const subTabs = initRegistrationFieldsSubTabs({
    els,
    API,
    fetchJson,
    showToast,
    escapeHtml,
    getCurrentCompetitionId,
    getCurrentFieldsConfig,
    setCurrentFieldsConfig,
    markRegFieldsDirty,
  });

  els.regEventsSaveBtn?.addEventListener(
    "click",
    async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!els.regEventsSaveBtn) return;

      try {
        els.regEventsSaveBtn.disabled = true;
        await saveRegistrationFields();
      } catch (err) {
        console.error(err);
        els.regEventsSaveBtn.disabled = false;
        showToast(err?.message || "Failed to save registration fields.", "error");
      }
    },
    true
  );

  // Public API of this tab module
  return {
    loadEventOptions: eventsTab.loadEventOptions,
    renderRegFields: eventsTab.renderRegFields,
    readRegFieldsFromDom: eventsTab.readRegFieldsFromDom,
    // helper so admin.js can keep currentRegConfig synced before save
    snapshotFromDom: () => eventsTab.snapshotFromDom(),
    clearDirty: clearRegFieldsDirty,
    subTabs,
    saveRegistrationFields,
  };
}
