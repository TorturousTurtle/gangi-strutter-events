/**
 * Simple Client-Side Router
 * Hash-based routing for single-page admin interface
 */

/**
 * Create a router instance
 * @param {Object} options - Router options
 * @param {string} options.defaultRoute - Default route when no hash present
 * @param {Function} options.onNavigate - Callback when route changes
 * @returns {Object} Router instance
 */
export function createRouter(options = {}) {
  const {
    defaultRoute = 'dashboard',
    onNavigate = null
  } = options;

  const routes = new Map();
  const middleware = [];
  let currentRoute = null;
  let currentParams = {};

  /**
   * Parse the current hash into route and params
   * @returns {Object} { route, params }
   */
  function parseHash() {
    const hash = window.location.hash.slice(1) || defaultRoute;
    const [route, queryString] = hash.split('?');
    const params = {};

    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      for (const [key, value] of searchParams) {
        params[key] = value;
      }
    }

    return { route: route || defaultRoute, params };
  }

  /**
   * Handle hash change
   */
  async function handleHashChange() {
    const { route, params } = parseHash();

    // Run middleware
    for (const fn of middleware) {
      const result = await fn(route, params, currentRoute);
      if (result === false) return; // Middleware blocked navigation
    }

    const prevRoute = currentRoute;
    const prevParams = { ...currentParams };

    currentRoute = route;
    currentParams = params;

    // Call route handler if registered
    const handler = routes.get(route);
    if (handler) {
      try {
        await handler(params, { prevRoute, prevParams });
      } catch (e) {
        console.error(`[Router] Error in route handler for "${route}":`, e);
      }
    }

    // Call global navigate callback
    if (onNavigate) {
      onNavigate(route, params, { prevRoute, prevParams });
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);

  return {
    /**
     * Register a route handler
     * @param {string} route - Route name
     * @param {Function} handler - Handler function (params, context)
     */
    on(route, handler) {
      routes.set(route, handler);
      return this; // Allow chaining
    },

    /**
     * Remove a route handler
     * @param {string} route - Route name
     */
    off(route) {
      routes.delete(route);
      return this;
    },

    /**
     * Navigate to a route
     * @param {string} route - Route name
     * @param {Object} params - Optional URL parameters
     */
    navigate(route, params = {}) {
      const queryString = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
      window.location.hash = route + queryString;
    },

    /**
     * Navigate without adding to history
     * @param {string} route - Route name
     * @param {Object} params - Optional URL parameters
     */
    replace(route, params = {}) {
      const queryString = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
      const url = window.location.pathname + '#' + route + queryString;
      window.history.replaceState(null, '', url);
      handleHashChange();
    },

    /**
     * Get current route info
     * @returns {Object} { route, params }
     */
    getCurrent() {
      return { route: currentRoute, params: { ...currentParams } };
    },

    /**
     * Add middleware that runs before each navigation
     * @param {Function} fn - Middleware function (route, params, prevRoute) => boolean
     */
    use(fn) {
      middleware.push(fn);
      return this;
    },

    /**
     * Update URL params without full navigation
     * @param {Object} params - Params to merge
     */
    updateParams(params) {
      const merged = { ...currentParams, ...params };
      // Remove null/undefined values
      Object.keys(merged).forEach(key => {
        if (merged[key] == null) delete merged[key];
      });
      this.replace(currentRoute, merged);
    },

    /**
     * Go back in history
     */
    back() {
      window.history.back();
    },

    /**
     * Initialize router (call after registering routes)
     */
    init() {
      handleHashChange();
      return this;
    },

    /**
     * Destroy router (remove event listeners)
     */
    destroy() {
      window.removeEventListener('hashchange', handleHashChange);
      routes.clear();
      middleware.length = 0;
    }
  };
}

/**
 * Create a tab-based router that syncs with tab UI
 * @param {Object} options - Options
 * @param {string} options.tabContainerSelector - Selector for tab container
 * @param {string} options.tabSelector - Selector for tab buttons
 * @param {string} options.panelSelector - Selector for tab panels
 * @param {string} options.activeClass - Class for active tab
 * @param {string} options.defaultTab - Default tab ID
 * @returns {Object} Tab router instance
 */
export function createTabRouter(options = {}) {
  const {
    tabContainerSelector = '[data-tabs]',
    tabSelector = '[data-tab]',
    panelSelector = '[data-tab-panel]',
    activeClass = 'active',
    defaultTab = null
  } = options;

  const listeners = new Set();
  let currentTab = null;

  function getTabFromHash() {
    const hash = window.location.hash.slice(1);
    return hash || defaultTab;
  }

  function activateTab(tabId, updateHash = true) {
    if (!tabId || tabId === currentTab) return;

    const container = document.querySelector(tabContainerSelector);
    if (!container) return;

    // Update tab buttons
    const tabs = container.querySelectorAll(tabSelector);
    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabId;
      tab.classList.toggle(activeClass, isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    // Update panels
    const panels = document.querySelectorAll(panelSelector);
    panels.forEach(panel => {
      const isActive = panel.dataset.tabPanel === tabId;
      panel.classList.toggle('hidden', !isActive);
      panel.classList.toggle(activeClass, isActive);
    });

    const prevTab = currentTab;
    currentTab = tabId;

    // Update URL hash
    if (updateHash && tabId !== getTabFromHash()) {
      window.history.pushState(null, '', `#${tabId}`);
    }

    // Notify listeners
    listeners.forEach(fn => fn(tabId, prevTab));
  }

  function handleHashChange() {
    const tabId = getTabFromHash();
    if (tabId) activateTab(tabId, false);
  }

  function handleTabClick(e) {
    const tab = e.target.closest(tabSelector);
    if (tab) {
      e.preventDefault();
      activateTab(tab.dataset.tab);
    }
  }

  // Set up event listeners
  window.addEventListener('hashchange', handleHashChange);
  document.addEventListener('click', handleTabClick);

  return {
    /**
     * Switch to a tab
     * @param {string} tabId - Tab ID
     */
    go(tabId) {
      activateTab(tabId);
    },

    /**
     * Get current tab ID
     * @returns {string} Current tab ID
     */
    getCurrent() {
      return currentTab;
    },

    /**
     * Subscribe to tab changes
     * @param {Function} fn - Callback (newTab, prevTab)
     * @returns {Function} Unsubscribe function
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Initialize (call after DOM ready)
     */
    init() {
      const initialTab = getTabFromHash();
      if (initialTab) {
        activateTab(initialTab, false);
      } else if (defaultTab) {
        activateTab(defaultTab, false);
      }
      return this;
    },

    /**
     * Destroy router
     */
    destroy() {
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('click', handleTabClick);
      listeners.clear();
    }
  };
}

// Export for global scope (backward compatibility)
if (typeof window !== 'undefined') {
  window.Router = {
    createRouter,
    createTabRouter
  };
}
