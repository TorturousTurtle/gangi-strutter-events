/**
 * Branding Module
 *
 * Fetches tenant configuration and applies branding:
 * - Injects CSS custom properties for theming
 * - Populates header/footer with organization details
 * - Provides config access to other modules
 */

const Branding = (function () {
  let config = null;
  let configPromise = null;

  /**
   * Fetch configuration from the API (cached).
   * @returns {Promise<Object>} The configuration object
   */
  async function fetchConfig() {
    if (config) return config;
    if (configPromise) return configPromise;

    configPromise = (async () => {
      try {
        let data;
        // Use central API client if available
        if (window.api && window.api.config) {
          data = await window.api.config.app();
        } else {
          // Fallback for when API client isn't loaded
          const res = await fetch('/api/config.php');
          if (!res.ok) throw new Error('Failed to load config');
          data = await res.json();
        }

        if (!data.ok) throw new Error(data.error || 'Config error');
        config = data.config;
        return config;
      } catch (err) {
        console.error('Branding: Failed to load config', err);
        // Return defaults on error
        config = getDefaults();
        return config;
      }
    })();

    return configPromise;
  }

  /**
   * Default configuration (fallback if API fails).
   */
  function getDefaults() {
    return {
      organization: {
        name: 'GKP Events',
        tagline: 'Competition Registration Made Simple',
      },
      branding: {
        logo: '/assets/gkp-logo.png',
        colors: {
          primary: '#0b5cff',
          primaryHover: '#0849c6',
          accent: '#e9c001',
          accentHover: '#d4af01',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          background: '#f8fafc',
          surface: '#ffffff',
          text: '#111827',
          textMuted: '#6b7280',
          headerText: '#ffffff',
          footerBg: '#4a4a4a',
          footerText: '#e5e7eb',
        },
        fonts: {
          heading: "'Inter', system-ui, sans-serif",
          body: "'Inter', system-ui, sans-serif",
        },
      },
      terminology: {
        participant: 'Twirler',
        instructor: 'Coach',
        group: 'Team',
      },
    };
  }

  /**
   * Convert hex color to RGB values.
   * @param {string} hex - Hex color like "#0b5cff"
   * @returns {string} RGB values like "11, 92, 255"
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }

  /**
   * Inject CSS custom properties from branding config.
   * @param {Object} branding - The branding configuration
   */
  function applyCssVariables(branding) {
    const colors = branding.colors || {};
    const fonts = branding.fonts || {};
    const root = document.documentElement;

    // Primary colors
    if (colors.primary) {
      root.style.setProperty('--color-primary', colors.primary);
      root.style.setProperty('--color-primary-rgb', hexToRgb(colors.primary));
      root.style.setProperty('--color-primary-light', `rgba(${hexToRgb(colors.primary)}, 0.1)`);
    }
    if (colors.primaryHover) {
      root.style.setProperty('--color-primary-hover', colors.primaryHover);
    }

    // Accent colors
    if (colors.accent) {
      root.style.setProperty('--color-accent', colors.accent);
      root.style.setProperty('--color-accent-rgb', hexToRgb(colors.accent));
    }
    if (colors.accentHover) {
      root.style.setProperty('--color-accent-hover', colors.accentHover);
    }

    // Status colors
    if (colors.success) root.style.setProperty('--color-success', colors.success);
    if (colors.warning) root.style.setProperty('--color-warning', colors.warning);
    if (colors.error) root.style.setProperty('--color-error', colors.error);

    // Neutral colors
    if (colors.background) root.style.setProperty('--color-background', colors.background);
    if (colors.surface) root.style.setProperty('--color-surface', colors.surface);
    if (colors.text) root.style.setProperty('--color-text', colors.text);
    if (colors.textMuted) root.style.setProperty('--color-text-muted', colors.textMuted);

    // Header/Footer
    if (colors.headerBg) {
      root.style.setProperty('--color-header-bg', colors.headerBg);
    } else if (colors.primary && colors.primaryHover) {
      root.style.setProperty(
        '--color-header-bg',
        `linear-gradient(90deg, ${colors.primary}, ${colors.primaryHover})`
      );
    }
    if (colors.headerText) root.style.setProperty('--color-header-text', colors.headerText);
    if (colors.footerBg) root.style.setProperty('--color-footer-bg', colors.footerBg);
    if (colors.footerText) root.style.setProperty('--color-footer-text', colors.footerText);

    // Fonts
    if (fonts.heading) root.style.setProperty('--font-heading', fonts.heading);
    if (fonts.body) root.style.setProperty('--font-body', fonts.body);
  }

  /**
   * Populate header element with branding.
   * @param {Object} cfg - Full configuration object
   */
  function applyHeader(cfg) {
    const header = document.querySelector('#site-header header, header');
    if (!header) return;

    const org = cfg.organization || {};
    const branding = cfg.branding || {};
    const colors = branding.colors || {};

    // Update header background
    const bgColor = colors.headerBg || `linear-gradient(90deg, ${colors.primary || '#0b5cff'}, ${colors.primaryHover || '#0849c6'})`;
    header.style.background = bgColor;

    // Update logo
    const logoImg = header.querySelector('img[alt*="logo"], img[src*="logo"]');
    if (logoImg && branding.logo) {
      logoImg.src = branding.logo;
      logoImg.alt = `${org.name || 'Organization'} logo`;
    }

    // Update organization name
    const nameEl = header.querySelector('h1');
    if (nameEl && org.name) {
      nameEl.textContent = org.name;
    }
  }

  /**
   * Populate footer element with branding.
   * @param {Object} cfg - Full configuration object
   */
  function applyFooter(cfg) {
    const footer = document.querySelector('#site-footer footer, footer');
    if (!footer) return;

    const org = cfg.organization || {};
    const branding = cfg.branding || {};
    const colors = branding.colors || {};

    // Update footer background
    if (colors.footerBg) {
      footer.style.backgroundColor = colors.footerBg;
    }

    // Update organization name in footer
    const nameEl = footer.querySelector('.font-semibold, p:first-child');
    if (nameEl && org.name) {
      nameEl.textContent = org.name;
    }

    // Update copyright year
    const yearEl = footer.querySelector('#footerYear');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  /**
   * Update page title with organization name.
   * @param {Object} cfg - Full configuration object
   */
  function applyPageTitle(cfg) {
    const org = cfg.organization || {};
    if (org.name && document.title) {
      // Append org name if not already present
      if (!document.title.includes(org.name)) {
        document.title = `${document.title} | ${org.name}`;
      }
    }
  }

  /**
   * Initialize branding - fetch config and apply.
   * Call this after fragments are loaded.
   * @returns {Promise<Object>} The configuration object
   */
  async function init() {
    const cfg = await fetchConfig();

    applyCssVariables(cfg.branding || {});
    applyHeader(cfg);
    applyFooter(cfg);
    applyPageTitle(cfg);

    // Dispatch event for other modules that need config
    window.dispatchEvent(new CustomEvent('brandingLoaded', { detail: cfg }));

    return cfg;
  }

  /**
   * Get a terminology term with optional fallback.
   * @param {string} key - Term key (e.g., 'participant', 'instructor')
   * @param {string} fallback - Fallback value
   * @returns {string}
   */
  function term(key, fallback = '') {
    if (!config || !config.terminology) return fallback;
    return config.terminology[key] || fallback;
  }

  /**
   * Get current configuration (must call init first).
   * @returns {Object|null}
   */
  function getConfig() {
    return config;
  }

  /**
   * Check if a feature is enabled.
   * @param {string} path - Dot notation path (e.g., 'registration.enabled')
   * @param {boolean} defaultValue
   * @returns {boolean}
   */
  function featureEnabled(path, defaultValue = false) {
    if (!config || !config.features) return defaultValue;

    const keys = path.split('.');
    let value = config.features;

    for (const key of keys) {
      if (value === null || value === undefined || typeof value !== 'object') {
        return defaultValue;
      }
      value = value[key];
    }

    return value === true;
  }

  // Public API
  return {
    init,
    fetchConfig,
    getConfig,
    term,
    featureEnabled,
    applyCssVariables,
  };
})();

// Export for ES modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Branding;
}
