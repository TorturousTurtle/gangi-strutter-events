// web/assets/js/admin/tabs/currentEvent.js
// Current Event (Competition) tab module — owns picker + CRUD + form fill/serialize.
// Keeps state in the parent (admin.js) via getters/setters + hook callbacks.

export async function initCurrentEventTab({
  els,
  API,
  fetchJson,
  showToast,
  showInlineError,
  setFormEnabled,
  toDatetimeLocalValue,

  // shared state accessors (stored in admin.js)
  getCompetitionsCache,
  setCompetitionsCache,
  getCurrentCompetitionId,
  setCurrentCompetitionId,

  // hooks back into admin.js (so other tabs can react)
  onCompetitionLoaded,
  onCompetitionCleared,
}) {
  // Keep the last-loaded competition so we can preserve fields not edited in this tab
  let lastLoadedCompetition = null;

  // Image upload elements
  const imageInput = document.getElementById("competitionImageInput");
  const imageUploadBtn = document.getElementById("competitionImageUploadBtn");
  const imageRemoveBtn = document.getElementById("competitionImageRemoveBtn");
  const imagePreviewImg = document.getElementById("competitionImagePreviewImg");
  const imagePlaceholder = document.getElementById("competitionImagePlaceholder");
  const imageUrlInput = document.getElementById("competitionImageUrl");

  // Home page display elements
  const showOnHomeInput = document.getElementById("competitionShowOnHome");
  const displayOrderInput = document.getElementById("competitionDisplayOrder");

  // Top bar picker (synced with main picker in Event tab)
  const topBarPicker = document.getElementById("competitionSelectTop");

  function safeJsonParse(maybeJson, fallback) {
    if (maybeJson == null) return fallback;
    if (typeof maybeJson === "object") return maybeJson;
    const s = String(maybeJson).trim();
    if (!s) return fallback;
    try {
      return JSON.parse(s);
    } catch (_) {
      return fallback;
    }
  }

  function setCompetitionImage(url) {
    if (url) {
      if (imagePreviewImg) {
        imagePreviewImg.src = url;
        imagePreviewImg.style.display = "block";
      }
      if (imagePlaceholder) imagePlaceholder.style.display = "none";
      if (imageRemoveBtn) imageRemoveBtn.style.display = "inline-flex";
      if (imageUrlInput) imageUrlInput.value = url;
    } else {
      if (imagePreviewImg) {
        imagePreviewImg.src = "";
        imagePreviewImg.style.display = "none";
      }
      if (imagePlaceholder) imagePlaceholder.style.display = "flex";
      if (imageRemoveBtn) imageRemoveBtn.style.display = "none";
      if (imageUrlInput) imageUrlInput.value = "";
    }
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload/image.php", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    if (!data.ok || !data.url) {
      throw new Error(data.error || "Upload failed");
    }

    return data.url;
  }

  function initImageUpload() {
    if (!imageInput || !imageUploadBtn) return;

    imageUploadBtn.addEventListener("click", () => {
      imageInput.click();
    });

    imageInput.addEventListener("change", async () => {
      const file = imageInput.files?.[0];
      if (!file) return;

      try {
        setFormEnabled(false);
        showToast("Uploading image...");
        const url = await uploadImage(file);
        setCompetitionImage(url);
        showToast("Image uploaded successfully.");
      } catch (e) {
        console.error(e);
        showInlineError(e.message || "Failed to upload image.");
      } finally {
        setFormEnabled(true);
        imageInput.value = "";
      }
    });

    imageRemoveBtn?.addEventListener("click", () => {
      setCompetitionImage(null);
    });
  }

  function clearEventForm() {
    if (els.name) els.name.value = "";
    if (els.location) els.location.value = "";
    if (els.start) els.start.value = "";
    if (els.end) els.end.value = "";
    if (els.desc) els.desc.value = "";
    if (els.active) els.active.checked = false;
    if (els.deadline) els.deadline.value = "";
    if (els.deleteBtn) els.deleteBtn.disabled = true;
    if (els.facilityFee) els.facilityFee.value = "";

    if (els.productEnabled) els.productEnabled.checked = false;
    if (els.productName) {
      els.productName.value = "";
      els.productName.disabled = true;
    }
    if (els.productPrice) {
      els.productPrice.value = "";
      els.productPrice.disabled = true;
    }
    setCompetitionImage(null);

    // Reset home page display settings
    if (showOnHomeInput) showOnHomeInput.checked = true; // Default to show new competitions
    if (displayOrderInput) displayOrderInput.value = "0";

    lastLoadedCompetition = null;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function syncOptionalProductControls() {
    const enabled = !!(els.productEnabled && els.productEnabled.checked);
    if (els.productName) els.productName.disabled = !enabled;
    if (els.productPrice) els.productPrice.disabled = !enabled;
  }

  function renderCompetitionToForm(c) {
    if (!c) return;

    if (els.name) els.name.value = c.name || "";
    if (els.location) els.location.value = c.location || "";
    if (els.start) els.start.value = toDatetimeLocalValue(c.start_at);
    if (els.end) els.end.value = toDatetimeLocalValue(c.end_at);
    if (els.deadline)
      els.deadline.value = toDatetimeLocalValue(c.registration_deadline);
    if (els.desc) els.desc.value = c.description || "";
    if (els.active) els.active.checked = Boolean(c.isActive);

    if (els.deleteBtn) els.deleteBtn.disabled = !c.id;

    if (els.facilityFee) {
      const fee = Number(c.facility_fee ?? c.facilityFee ?? 0);
      els.facilityFee.value =
        Number.isFinite(fee) && fee > 0 ? fee.toFixed(2) : "";
    }

    // Optional product (e.g., T-shirt) controlled by admin
    if (els.productEnabled) {
      const enabled = Boolean(
        c.productEnabled ??
          c.product_enabled ??
          c.merchEnabled ??
          c.merch_enabled ??
          false
      );
      els.productEnabled.checked = enabled;
    }

    if (els.productName) {
      els.productName.value =
        (c.productName ?? c.product_name ?? c.merchName ?? c.merch_name ?? "") ||
        "";
    }

    if (els.productPrice) {
      const price = Number(
        c.productPrice ?? c.product_price ?? c.merchPrice ?? c.merch_price ?? 0
      );
      els.productPrice.value =
        Number.isFinite(price) && price > 0 ? price.toFixed(2) : "";
    }

    syncOptionalProductControls();

    // Set competition image
    setCompetitionImage(c.imageUrl ?? c.image_url ?? null);

    // Home page display settings
    if (showOnHomeInput) {
      showOnHomeInput.checked = Boolean(c.showOnHome ?? c.show_on_home ?? false);
    }
    if (displayOrderInput) {
      displayOrderInput.value = String(c.displayOrder ?? c.display_order ?? 0);
    }
  }

  function readCompetitionFromForm() {
    const currentId = getCurrentCompetitionId();
    const facilityFeeRaw = els.facilityFee
      ? String(els.facilityFee.value || "").trim()
      : "";
    const facilityFee = facilityFeeRaw === "" ? 0 : Number(facilityFeeRaw);

    const productEnabled = els.productEnabled ? !!els.productEnabled.checked : false;
    const productNameRaw = els.productName ? String(els.productName.value || "").trim() : "";
    const productPriceRaw = els.productPrice ? String(els.productPrice.value || "").trim() : "";
    const productPrice = productPriceRaw === "" ? 0 : Number(productPriceRaw);

    const preservedEventCatalog = safeJsonParse(
      lastLoadedCompetition?.eventCatalog ?? lastLoadedCompetition?.event_catalog_json ?? null,
      null
    );
    const preservedRegistrationOptions = safeJsonParse(
      lastLoadedCompetition?.registrationOptions ?? lastLoadedCompetition?.registration_config_json ?? null,
      null
    );

    return {
      id: currentId ? Number(currentId) : 0,
      name: els.name ? els.name.value.trim() : "",
      location: els.location ? els.location.value.trim() : "",
      startDate: els.start ? els.start.value : "",
      endDate: els.end ? els.end.value : "",
      registrationDeadline: els.deadline ? els.deadline.value : "",
      description: els.desc ? els.desc.value.trim() : "",
      facilityFee:
        Number.isFinite(facilityFee) && facilityFee >= 0 ? facilityFee : 0,
      isActive: els.active ? !!els.active.checked : false,

      productEnabled,
      productName: productEnabled ? productNameRaw : "",
      productPrice:
        productEnabled && Number.isFinite(productPrice) && productPrice >= 0
          ? productPrice
          : 0,

      // Preserve registration fields managed by the Registration Fields tab
      eventCatalog: preservedEventCatalog,
      registrationOptions: preservedRegistrationOptions,

      // Competition image
      imageUrl: imageUrlInput ? imageUrlInput.value || null : null,

      // Home page display settings
      showOnHome: showOnHomeInput ? !!showOnHomeInput.checked : false,
      displayOrder: displayOrderInput ? parseInt(displayOrderInput.value, 10) || 0 : 0,
    };
  }

  function renderCompetitionPicker(list) {
    const opts = [];
    opts.push(`<option value="">Select a competition…</option>`);

    list.forEach((c) => {
      const label = c.isActive ? `${c.name} (Active)` : c.name;
      opts.push(
        `<option value="${escapeHtml(String(c.id))}">${escapeHtml(label)}</option>`
      );
    });

    const html = opts.join("");

    // Update both pickers
    if (els.picker) els.picker.innerHTML = html;
    if (topBarPicker) topBarPicker.innerHTML = html;
  }

  // Sync picker values (call after changing either picker)
  function syncPickers(value) {
    if (els.picker) els.picker.value = value;
    if (topBarPicker) topBarPicker.value = value;
  }

  async function saveCompetition(payload) {
    if (!payload.name) throw new Error("Competition name is required.");
    if (!payload.startDate) throw new Error("Start date/time is required.");
    if (!payload.registrationDeadline)
      throw new Error("Registration deadline is required.");

    if (payload.productEnabled) {
      if (!payload.productName) throw new Error("Optional product name is required when enabled.");
      if (!(typeof payload.productPrice === "number") || !Number.isFinite(payload.productPrice)) {
        throw new Error("Optional product price must be a valid number.");
      }
      if (payload.productPrice < 0) throw new Error("Optional product price cannot be negative.");
    }

    return fetchJson(API.saveCompetition, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function deleteCompetition(id) {
    return fetchJson(API.deleteCompetition, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id) }),
    });
  }

  async function loadCompetitionById(id) {
    if (!id) return;
    showInlineError(null);

    const qs = new URLSearchParams({ id: String(id) }).toString();
    const data = await fetchJson(`${API.getCompetition}?${qs}`, {
      method: "GET",
    });

    if (!data?.competition) throw new Error("No competition returned from API.");

    setCurrentCompetitionId(Number(data.competition.id || 0) || null);
    if (els.deleteBtn) els.deleteBtn.disabled = !getCurrentCompetitionId();

    renderCompetitionToForm(data.competition);

    lastLoadedCompetition = data.competition;

    if (typeof onCompetitionLoaded === "function") {
      await onCompetitionLoaded(data.competition);
    }
  }

  async function loadCompetitionsList({ autoSelectActive = true } = {}) {
    const data = await fetchJson(API.listCompetitions, { method: "GET" });
    const list = Array.isArray(data?.competitions) ? data.competitions : [];

    setCompetitionsCache(list);
    renderCompetitionPicker(list);

    if (!autoSelectActive || !els.picker) return;

    // Prefer active competition; fallback to first item
    const active = list.find((c) => c.isActive) || list[0];
    if (active) {
      syncPickers(String(active.id));
      await loadCompetitionById(active.id);
    } else {
      clearEventForm();
      setCurrentCompetitionId(null);
      if (typeof onCompetitionCleared === "function") onCompetitionCleared();
    }
  }

  // Shared handler for competition picker changes
  async function handlePickerChange(selectedId) {
    // Sync both pickers
    syncPickers(selectedId);

    if (!selectedId) {
      setCurrentCompetitionId(null);
      clearEventForm();
      if (typeof onCompetitionCleared === "function") onCompetitionCleared();
      return;
    }

    try {
      setFormEnabled(false);
      await loadCompetitionById(selectedId);
    } catch (e) {
      console.error(e);
      showInlineError(e.message || "Failed to load competition.");
    } finally {
      setFormEnabled(true);
    }
  }

  // -------- Wire events (once) --------
  els.picker?.addEventListener("change", () => handlePickerChange(els.picker.value));
  topBarPicker?.addEventListener("change", () => handlePickerChange(topBarPicker.value));

  els.createBtn?.addEventListener("click", () => {
    showInlineError(null);
    setCurrentCompetitionId(null);
    syncPickers("");
    clearEventForm();
    if (els.active) els.active.checked = true;
    showToast("Ready to create a new competition.");
    if (typeof onCompetitionCleared === "function") onCompetitionCleared();
  });

  els.productEnabled?.addEventListener("change", () => {
    syncOptionalProductControls();
  });

  els.deleteBtn?.addEventListener("click", async () => {
    showInlineError(null);

    const id = getCurrentCompetitionId();
    if (!id) {
      showInlineError("Select an existing competition to delete.");
      return;
    }

    if (!confirm("Delete this competition? This cannot be undone.")) return;

    try {
      setFormEnabled(false);
      const res = await deleteCompetition(id);
      if (!res?.ok) throw new Error(res?.error || "Delete failed.");

      showToast("Competition deleted.");
      await loadCompetitionsList({ autoSelectActive: true });
    } catch (e) {
      console.error(e);
      showInlineError(e.message || "Failed to delete competition.");
    } finally {
      setFormEnabled(true);
    }
  });

  els.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showInlineError(null);

    try {
      setFormEnabled(false);

      const payload = readCompetitionFromForm();
      const res = await saveCompetition(payload);

      if (!res?.ok) throw new Error(res?.error || "Failed to save competition.");

      // If API returns created/updated competition id, keep it selected
      const savedId = res?.id ? Number(res.id) : payload.id;
      showToast("Competition saved.");

      await loadCompetitionsList({ autoSelectActive: false });

      if (savedId) {
        syncPickers(String(savedId));
        await loadCompetitionById(savedId);
      }
    } catch (e2) {
      console.error(e2);
      showInlineError(e2.message || "Failed to save competition.");
    } finally {
      setFormEnabled(true);
    }
  });

  // Ensure optional product controls are in a consistent state on first render
  syncOptionalProductControls();

  // Initialize image upload
  initImageUpload();

  // Initial load
  await loadCompetitionsList({ autoSelectActive: true });
}
