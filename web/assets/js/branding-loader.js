// web/assets/js/branding-loader.js
// Loads branding configuration and applies it to the page at runtime

(function () {
  "use strict";

  const BRANDING_API = "/api/branding/config.php";
  const CACHE_KEY = "gkp_branding_cache";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached branding if still valid.
   */
  function getCachedBranding() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Cache branding data.
   */
  function cacheBranding(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Apply branding CSS to the page.
   */
  function applyBrandingCSS(css) {
    if (!css) return;

    let styleEl = document.getElementById("branding-dynamic-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "branding-dynamic-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  /**
   * Apply branding metadata to the page.
   */
  function applyBrandingMeta(branding) {
    if (!branding) return;

    // Update page title if organization name is set
    if (branding.organizationName && document.title) {
      // Only update if the title contains the default or is the org name
      const baseTitle = document.title.replace(/^GKP Events/, "").trim();
      document.title = baseTitle
        ? `${branding.organizationName} ${baseTitle}`
        : branding.organizationName;
    }

    // Update favicon if provided
    if (branding.faviconUrl) {
      let faviconEl = document.querySelector('link[rel="icon"]');
      if (!faviconEl) {
        faviconEl = document.createElement("link");
        faviconEl.rel = "icon";
        document.head.appendChild(faviconEl);
      }
      faviconEl.href = branding.faviconUrl;
    }

    // Dispatch event for components that need to react to branding
    window.dispatchEvent(
      new CustomEvent("brandingLoaded", { detail: branding })
    );
  }

  /**
   * Load and apply branding.
   */
  async function loadBranding() {
    // Try cache first for instant render
    const cached = getCachedBranding();
    if (cached) {
      applyBrandingCSS(cached.css);
      applyBrandingMeta(cached.branding);
    }

    // Fetch fresh data
    try {
      let data;
      // Use central API client if available
      if (window.api && window.api.config) {
        data = await window.api.config.branding();
      } else {
        // Fallback for when API client isn't loaded
        const response = await fetch(BRANDING_API);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        data = await response.json();
      }

      if (!data.ok) {
        throw new Error(data.error || "Failed to load branding");
      }

      // Apply and cache
      applyBrandingCSS(data.css);
      applyBrandingMeta(data.branding);
      cacheBranding(data);

      return data;
    } catch (error) {
      console.warn("Failed to load branding:", error);
      // Return cached data if available, otherwise null
      return cached || null;
    }
  }

  /**
   * Force refresh branding (bypass cache).
   */
  async function refreshBranding() {
    localStorage.removeItem(CACHE_KEY);
    return loadBranding();
  }

  // Expose API
  window.GKPBranding = {
    load: loadBranding,
    refresh: refreshBranding,
    clearCache: () => localStorage.removeItem(CACHE_KEY),
  };

  // Auto-load on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadBranding);
  } else {
    loadBranding();
  }
})();
