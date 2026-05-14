/**
 * Central API Client
 * Handles all HTTP requests with consistent error handling
 */

// ===== Endpoint Constants =====
const ENDPOINTS = {
  // Auth
  auth: {
    login: '/api/auth/login.php',
    logout: '/api/auth/logout.php',
    check: '/api/auth/check.php'
  },
  // Competitions
  competitions: {
    list: '/api/competitions.list.php',
    get: '/api/competitions.get.php',
    save: '/api/competitions.save.php',
    delete: '/api/competitions.delete.php',
    public: '/api/competition.public.php',
    home: '/api/competitions.home.php'
  },
  // Registrations
  registrations: {
    list: '/api/admin-list.php',
    create: '/api/registrations.create.php',
    update: '/api/registrations.update.php',
    delete: '/api/registrations.delete.php',
    register: '/api/register.php'
  },
  // Coaches
  coaches: {
    list: '/api/coaches.list.php',
    get: '/api/coaches.get.php',
    save: '/api/coaches.save.php',
    delete: '/api/coaches.delete.php'
  },
  // Competition Coaches
  competitionCoaches: {
    list: '/api/competition_coaches.list.php',
    save: '/api/competition_coaches.save.php'
  },
  // Events
  events: {
    options: '/api/event_options.list.php'
  },
  // Config
  config: {
    app: '/api/config.php',
    branding: '/api/branding/config.php',
    fields: '/api/fields.php'
  },
  // Settings
  settings: {
    get: '/api/settings/get.php',
    save: '/api/settings/save.php'
  }
};

// ===== ApiError Class =====
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ===== ApiClient Class =====
class ApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    this.onError = options.onError || null;
    this._csrfToken = null;
  }

  /**
   * Get the current CSRF token.
   * Checks sessionStorage first, then instance variable.
   */
  getCsrfToken() {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('csrf_token');
      if (stored) return stored;
    }
    return this._csrfToken;
  }

  /**
   * Set the CSRF token.
   * Stores in both instance and sessionStorage.
   */
  setCsrfToken(token) {
    this._csrfToken = token;
    if (typeof sessionStorage !== 'undefined' && token) {
      sessionStorage.setItem('csrf_token', token);
    }
  }

  /**
   * Clear the CSRF token (on logout).
   */
  clearCsrfToken() {
    this._csrfToken = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('csrf_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = this.baseUrl + endpoint;
    const headers = { ...this.defaultHeaders, ...options.headers };

    // Add CSRF token for mutating requests (POST, PUT, DELETE)
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const config = {
      credentials: 'include',
      headers,
      ...options
    };

    // Don't set Content-Type for FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);
    return this._handleResponse(response, url);
  }

  async _handleResponse(response, url) {
    const text = await response.text();
    let data = null;
    let parseFailed = false;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      parseFailed = true;
    }

    // PHP error detection (HTML output with 200 status)
    if (response.ok && parseFailed) {
      const preview = (text || '').slice(0, 300);
      const err = new ApiError(
        `Expected JSON but got: ${preview}`,
        response.status,
        { text }
      );
      this._notifyError(err);
      throw err;
    }

    // HTTP error with JSON body
    if (!response.ok) {
      const msg = data?.error || data?.message || text || `Request failed (${response.status})`;
      const err = new ApiError(msg, response.status, data);
      this._notifyError(err);
      throw err;
    }

    // API-level error (ok: false with 200 status)
    if (data && data.ok === false) {
      const err = new ApiError(data.error || 'Request failed', response.status, data);
      this._notifyError(err);
      throw err;
    }

    return data;
  }

  _notifyError(err) {
    if (this.onError) {
      this.onError(err);
    }
  }

  // ===== HTTP Method Shortcuts =====
  get(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(body)
    });
  }

  postForm(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  }

  // ===== Resource Methods =====

  // Competitions
  competitions = {
    list: () => this.get(ENDPOINTS.competitions.list),
    get: (id) => this.get(ENDPOINTS.competitions.get, { id }),
    save: (data) => this.post(ENDPOINTS.competitions.save, data),
    delete: (id) => this.post(ENDPOINTS.competitions.delete, { id }),
    getPublic: () => this.get(ENDPOINTS.competitions.public),
    getHome: () => this.get(ENDPOINTS.competitions.home)
  };

  // Registrations
  registrations = {
    /**
     * List registrations for a competition
     * @param {number|null} competitionId Competition ID (optional, defaults to current)
     * @param {Object} options Pagination and filter options
     * @param {number} options.page Page number (default: 1)
     * @param {number} options.perPage Items per page (default: 50, max: 100)
     * @returns {Promise<{registrations: Array, pagination: Object}>}
     */
    list: (competitionId, options = {}) => {
      const params = {};
      if (competitionId) params.competition_id = competitionId;
      if (options.page) params.page = options.page;
      if (options.perPage) params.per_page = options.perPage;
      return this.get(ENDPOINTS.registrations.list, params);
    },
    create: (data) => this.post(ENDPOINTS.registrations.create, data),
    update: (id, updates) => this.post(ENDPOINTS.registrations.update, { id, updates }),
    delete: (id) => this.post(ENDPOINTS.registrations.delete, { id }),
    // For public registration form - GET returns config, POST submits registration
    getConfig: () => this.get(ENDPOINTS.registrations.register),
    submit: (data) => this.post(ENDPOINTS.registrations.register, data)
  };

  // Coaches
  coaches = {
    list: () => this.get(ENDPOINTS.coaches.list),
    get: (id) => this.get(ENDPOINTS.coaches.get, { id }),
    save: (data) => this.post(ENDPOINTS.coaches.save, data),
    delete: (id) => this.post(ENDPOINTS.coaches.delete, { id })
  };

  // Competition Coaches
  competitionCoaches = {
    list: (competitionId) => this.get(ENDPOINTS.competitionCoaches.list, { competition_id: competitionId }),
    save: (data) => this.post(ENDPOINTS.competitionCoaches.save, data)
  };

  // Events
  events = {
    options: () => this.get(ENDPOINTS.events.options)
  };

  // Config
  config = {
    app: () => this.get(ENDPOINTS.config.app),
    branding: () => this.get(ENDPOINTS.config.branding),
    fields: () => this.get(ENDPOINTS.config.fields)
  };

  // Settings
  settings = {
    get: (key) => this.get(ENDPOINTS.settings.get, key ? { key } : {}),
    save: (data) => this.post(ENDPOINTS.settings.save, data)
  };

  // Auth
  auth = {
    /**
     * Log in with username and password.
     * On success, stores the CSRF token for future requests.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{ok: boolean, csrf_token?: string}>}
     */
    login: async (username, password) => {
      const result = await this.post(ENDPOINTS.auth.login, { username, password });
      if (result.ok && result.csrf_token) {
        this.setCsrfToken(result.csrf_token);
      }
      return result;
    },

    /**
     * Log out and clear the session.
     * Clears the stored CSRF token.
     * @returns {Promise<{ok: boolean}>}
     */
    logout: async () => {
      const result = await this.post(ENDPOINTS.auth.logout, {});
      this.clearCsrfToken();
      return result;
    },

    /**
     * Check authentication status.
     * Updates the CSRF token if authenticated.
     * @returns {Promise<{ok: boolean, authenticated: boolean, user?: string, csrf_token?: string}>}
     */
    check: async () => {
      const result = await this.get(ENDPOINTS.auth.check);
      if (result.ok && result.authenticated && result.csrf_token) {
        this.setCsrfToken(result.csrf_token);
      }
      return result;
    }
  };
}

// ===== Default Instance =====
const api = new ApiClient({
  onError: (err) => {
    // Default error handler - logs to console
    // Applications should override this via api.onError = (err) => { ... }
    console.error('[API Error]', err.message, err.status);
  }
});

// ===== Exports =====

// ES module exports
export { ApiClient, ApiError, api, ENDPOINTS };

// Global scope exports for backward compatibility
if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
  window.ApiError = ApiError;
  window.api = api;
  window.API_ENDPOINTS = ENDPOINTS;
}
