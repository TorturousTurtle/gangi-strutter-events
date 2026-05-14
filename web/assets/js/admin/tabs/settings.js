// web/assets/js/admin/tabs/settings.js
// Settings tab module for payment provider and branding configuration

export function initSettingsTab({ els, API, fetchJson, showToast }) {
  // API endpoints
  const SETTINGS_API = {
    get: "/api/settings/get.php",
    save: "/api/settings/save.php",
    testConnection: "/api/settings/test-connection.php",
    brandingConfig: "/api/branding/config.php",
  };

  // DOM elements
  const form = document.getElementById("settingsForm");
  const providerSelect = document.getElementById("paymentProvider");
  const stripeConfig = document.getElementById("stripeConfig");
  const paypalConfig = document.getElementById("paypalConfig");
  const squareConfig = document.getElementById("squareConfig");
  const saveBtn = document.getElementById("settingsSaveBtn");
  const errorEl = document.getElementById("settingsError");

  // Stripe fields
  const stripeMode = document.getElementById("stripeMode");
  const stripePublishableKey = document.getElementById("stripePublishableKey");
  const stripeSecretKey = document.getElementById("stripeSecretKey");
  const stripeWebhookSecret = document.getElementById("stripeWebhookSecret");
  const stripeTestBtn = document.getElementById("stripeTestBtn");

  // PayPal fields
  const paypalMode = document.getElementById("paypalMode");
  const paypalClientId = document.getElementById("paypalClientId");
  const paypalClientSecret = document.getElementById("paypalClientSecret");
  const paypalTestBtn = document.getElementById("paypalTestBtn");

  // Square fields
  const squareMode = document.getElementById("squareMode");
  const squareApplicationId = document.getElementById("squareApplicationId");
  const squareAccessToken = document.getElementById("squareAccessToken");
  const squareLocationId = document.getElementById("squareLocationId");
  const squareTestBtn = document.getElementById("squareTestBtn");

  // Pay Later fields
  const payLaterEnabled = document.getElementById("payLaterEnabled");
  const payLaterInstructions = document.getElementById("payLaterInstructions");

  // Branding fields
  const brandOrgName = document.getElementById("brandOrgName");
  const brandTagline = document.getElementById("brandTagline");
  const brandPrimaryColor = document.getElementById("brandPrimaryColor");
  const brandPrimaryColorPicker = document.getElementById("brandPrimaryColorPicker");
  const brandSecondaryColor = document.getElementById("brandSecondaryColor");
  const brandSecondaryColorPicker = document.getElementById("brandSecondaryColorPicker");
  const brandLogoUrl = document.getElementById("brandLogoUrl");
  const colorPresets = document.getElementById("colorPresets");

  // Preview elements
  const previewHeader = document.getElementById("previewHeader");
  const previewLogo = document.getElementById("previewLogo");
  const previewOrgName = document.getElementById("previewOrgName");
  const previewTagline = document.getElementById("previewTagline");
  const previewPrimaryBtn = document.getElementById("previewPrimaryBtn");
  const previewSecondaryBtn = document.getElementById("previewSecondaryBtn");

  let isDirty = false;

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
    errorEl.classList.toggle("hidden", !msg);
  }

  function markDirty() {
    isDirty = true;
    if (saveBtn) saveBtn.disabled = false;
  }

  function clearDirty() {
    isDirty = false;
  }

  function updateProviderVisibility() {
    const provider = providerSelect?.value || "none";

    if (stripeConfig) stripeConfig.classList.toggle("hidden", provider !== "stripe");
    if (paypalConfig) paypalConfig.classList.toggle("hidden", provider !== "paypal");
    if (squareConfig) squareConfig.classList.toggle("hidden", provider !== "square");
  }

  /**
   * Update the branding preview based on current field values.
   */
  function updateBrandingPreview() {
    const primary = brandPrimaryColor?.value || "#6366f1";
    const secondary = brandSecondaryColor?.value || "#f59e0b";
    const orgName = brandOrgName?.value || "GKP Events";
    const tagline = brandTagline?.value || "Competition Registration Made Simple";
    const logoUrl = brandLogoUrl?.value || "";

    // Update preview header gradient
    if (previewHeader) {
      const hoverColor = darkenColor(primary, 20);
      previewHeader.style.background = `linear-gradient(135deg, ${primary}, ${hoverColor})`;
    }

    // Update preview text
    if (previewOrgName) previewOrgName.textContent = orgName;
    if (previewTagline) previewTagline.textContent = tagline;

    // Update preview logo
    if (previewLogo) {
      if (logoUrl) {
        previewLogo.src = logoUrl;
        previewLogo.style.display = "block";
        previewLogo.onerror = () => { previewLogo.style.display = "none"; };
      } else {
        previewLogo.style.display = "none";
      }
    }

    // Update preview buttons
    if (previewPrimaryBtn) {
      previewPrimaryBtn.style.background = primary;
      previewPrimaryBtn.style.color = getContrastColor(primary);
    }
    if (previewSecondaryBtn) {
      previewSecondaryBtn.style.background = secondary;
      previewSecondaryBtn.style.color = getContrastColor(secondary);
    }
  }

  /**
   * Sync color picker with text input.
   */
  function syncColorInputs(picker, textInput) {
    if (!picker || !textInput) return;

    picker.addEventListener("input", () => {
      textInput.value = picker.value;
      updateBrandingPreview();
      markDirty();
    });

    textInput.addEventListener("input", () => {
      const value = textInput.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        picker.value = value;
      }
      updateBrandingPreview();
      markDirty();
    });
  }

  /**
   * Darken a hex color by a percentage.
   */
  function darkenColor(hex, percent) {
    hex = hex.replace("#", "");
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * percent / 100));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * percent / 100));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /**
   * Get contrasting text color (black or white) for a background.
   */
  function getContrastColor(hex) {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#111827" : "#ffffff";
  }

  async function loadSettings() {
    try {
      // Load payment settings
      const paymentData = await fetchJson(`${SETTINGS_API.get}?category=payment`);

      if (!paymentData?.ok) {
        throw new Error(paymentData?.error || "Failed to load payment settings");
      }

      const s = paymentData.settings || {};

      // Payment provider
      if (providerSelect) providerSelect.value = s.payment_provider || "none";

      // Stripe
      if (stripeMode) stripeMode.value = s.stripe_mode || "test";
      if (stripePublishableKey) stripePublishableKey.value = s.stripe_publishable_key || "";
      if (stripeSecretKey) stripeSecretKey.value = s.stripe_secret_key || "";
      if (stripeWebhookSecret) stripeWebhookSecret.value = s.stripe_webhook_secret || "";

      // PayPal
      if (paypalMode) paypalMode.value = s.paypal_mode || "sandbox";
      if (paypalClientId) paypalClientId.value = s.paypal_client_id || "";
      if (paypalClientSecret) paypalClientSecret.value = s.paypal_client_secret || "";

      // Square
      if (squareMode) squareMode.value = s.square_mode || "sandbox";
      if (squareApplicationId) squareApplicationId.value = s.square_application_id || "";
      if (squareAccessToken) squareAccessToken.value = s.square_access_token || "";
      if (squareLocationId) squareLocationId.value = s.square_location_id || "";

      // Pay Later
      if (payLaterEnabled) payLaterEnabled.checked = s.pay_later_enabled === "1" || s.pay_later_enabled === true;
      if (payLaterInstructions) payLaterInstructions.value = s.pay_later_instructions || "";

      updateProviderVisibility();

      // Load branding settings
      await loadBrandingSettings();

      clearDirty();
      showError(null);
    } catch (e) {
      console.error("Failed to load settings:", e);
      showError(e.message || "Failed to load settings");
    }
  }

  async function loadBrandingSettings() {
    try {
      const data = await fetchJson(`${SETTINGS_API.get}?category=branding`);

      if (!data?.ok) {
        // Branding might not be set up yet, use defaults
        console.warn("Could not load branding settings, using defaults");
        return;
      }

      const b = data.settings || {};

      // Populate branding fields
      if (brandOrgName) brandOrgName.value = b.organizationName || "GKP Events";
      if (brandTagline) brandTagline.value = b.tagline || "Competition Registration Made Simple";

      const primaryColor = b.primaryColor || "#6366f1";
      const secondaryColor = b.secondaryColor || "#f59e0b";

      if (brandPrimaryColor) brandPrimaryColor.value = primaryColor;
      if (brandPrimaryColorPicker) brandPrimaryColorPicker.value = primaryColor;
      if (brandSecondaryColor) brandSecondaryColor.value = secondaryColor;
      if (brandSecondaryColorPicker) brandSecondaryColorPicker.value = secondaryColor;
      if (brandLogoUrl) brandLogoUrl.value = b.logoUrl || "";

      // Update preview
      updateBrandingPreview();
    } catch (e) {
      console.warn("Failed to load branding settings:", e);
    }
  }

  function collectBrandingSettings() {
    return {
      organizationName: brandOrgName?.value || "",
      tagline: brandTagline?.value || "",
      primaryColor: brandPrimaryColor?.value || "#6366f1",
      secondaryColor: brandSecondaryColor?.value || "#f59e0b",
      logoUrl: brandLogoUrl?.value || "",
    };
  }

  function collectSettings() {
    const settings = {
      payment_provider: providerSelect?.value || "none",
      pay_later_enabled: payLaterEnabled?.checked ? "1" : "0",
      pay_later_instructions: payLaterInstructions?.value || "",
    };

    // Stripe (only include if not masked/unchanged)
    settings.stripe_mode = stripeMode?.value || "test";
    settings.stripe_publishable_key = stripePublishableKey?.value || "";
    if (stripeSecretKey?.value && !stripeSecretKey.value.includes("****")) {
      settings.stripe_secret_key = stripeSecretKey.value;
    }
    if (stripeWebhookSecret?.value && !stripeWebhookSecret.value.includes("****")) {
      settings.stripe_webhook_secret = stripeWebhookSecret.value;
    }

    // PayPal
    settings.paypal_mode = paypalMode?.value || "sandbox";
    settings.paypal_client_id = paypalClientId?.value || "";
    if (paypalClientSecret?.value && !paypalClientSecret.value.includes("****")) {
      settings.paypal_client_secret = paypalClientSecret.value;
    }

    // Square
    settings.square_mode = squareMode?.value || "sandbox";
    settings.square_application_id = squareApplicationId?.value || "";
    if (squareAccessToken?.value && !squareAccessToken.value.includes("****")) {
      settings.square_access_token = squareAccessToken.value;
    }
    settings.square_location_id = squareLocationId?.value || "";

    return settings;
  }

  async function saveSettings() {
    showError(null);

    const paymentSettings = collectSettings();
    const brandingSettings = collectBrandingSettings();

    try {
      if (saveBtn) saveBtn.disabled = true;

      // Save payment settings
      const paymentData = await fetchJson(SETTINGS_API.save, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: paymentSettings, category: "payment" }),
      });

      if (!paymentData?.ok) {
        throw new Error(paymentData?.error || "Failed to save payment settings");
      }

      // Save branding settings
      const brandingData = await fetchJson(SETTINGS_API.save, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: brandingSettings, category: "branding" }),
      });

      if (!brandingData?.ok) {
        throw new Error(brandingData?.error || "Failed to save branding settings");
      }

      showToast("Settings saved successfully.", "success");
      clearDirty();

      // Reload to get masked values
      await loadSettings();
    } catch (e) {
      console.error("Failed to save settings:", e);
      showError(e.message || "Failed to save settings");
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function testConnection(provider) {
    try {
      // Save settings first to ensure we're testing current values
      const settings = collectSettings();
      await fetchJson(SETTINGS_API.save, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      const data = await fetchJson(SETTINGS_API.testConnection, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (data?.success) {
        showToast(`${provider}: ${data.message}`, "success");
      } else {
        showToast(`${provider}: ${data.message || "Connection failed"}`, "error");
      }

      // Reload settings after save
      await loadSettings();
    } catch (e) {
      console.error(`Failed to test ${provider} connection:`, e);
      showToast(`${provider}: ${e.message || "Connection test failed"}`, "error");
    }
  }

  // Wire up event listeners
  providerSelect?.addEventListener("change", () => {
    updateProviderVisibility();
    markDirty();
  });

  // Mark dirty on any input change
  form?.addEventListener("input", markDirty);
  form?.addEventListener("change", markDirty);

  // Save button
  saveBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  // Test connection buttons
  stripeTestBtn?.addEventListener("click", () => testConnection("stripe"));
  paypalTestBtn?.addEventListener("click", () => testConnection("paypal"));
  squareTestBtn?.addEventListener("click", () => testConnection("square"));

  // Prevent form submission
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveSettings();
  });

  // Warn on leaving with unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ===== Branding Event Listeners =====

  // Sync color pickers with text inputs
  syncColorInputs(brandPrimaryColorPicker, brandPrimaryColor);
  syncColorInputs(brandSecondaryColorPicker, brandSecondaryColor);

  // Branding field change listeners
  brandOrgName?.addEventListener("input", () => {
    updateBrandingPreview();
    markDirty();
  });

  brandTagline?.addEventListener("input", () => {
    updateBrandingPreview();
    markDirty();
  });

  brandLogoUrl?.addEventListener("input", () => {
    updateBrandingPreview();
    markDirty();
  });

  // Color preset click handlers
  colorPresets?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-primary]");
    if (!btn) return;

    const primary = btn.dataset.primary;
    const secondary = btn.dataset.secondary;

    if (brandPrimaryColor) brandPrimaryColor.value = primary;
    if (brandPrimaryColorPicker) brandPrimaryColorPicker.value = primary;
    if (brandSecondaryColor) brandSecondaryColor.value = secondary;
    if (brandSecondaryColorPicker) brandSecondaryColorPicker.value = secondary;

    updateBrandingPreview();
    markDirty();
  });

  // Initial load
  loadSettings();

  return {
    loadSettings,
    saveSettings,
  };
}
