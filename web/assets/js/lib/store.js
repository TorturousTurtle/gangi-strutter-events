/**
 * Simple State Management Store
 * Provides reactive state with subscription support
 */

/**
 * Create a simple reactive store
 * @param {Object} initialState - Initial state object
 * @returns {Object} Store with get, set, subscribe methods
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    /**
     * Get current state or a specific key
     * @param {string} [key] - Optional key to get specific value
     * @returns {*} State or state value
     */
    get(key) {
      if (key === undefined) return { ...state };
      return state[key];
    },

    /**
     * Set state (partial update)
     * @param {Object|Function} update - Object to merge or updater function
     */
    set(update) {
      const prevState = { ...state };

      if (typeof update === 'function') {
        state = { ...state, ...update(state) };
      } else {
        state = { ...state, ...update };
      }

      // Notify listeners
      listeners.forEach(listener => {
        try {
          listener(state, prevState);
        } catch (e) {
          console.error('[Store] Listener error:', e);
        }
      });
    },

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function (newState, prevState)
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Reset state to initial values
     */
    reset() {
      this.set(initialState);
    },

    /**
     * Get number of subscribers
     * @returns {number} Subscriber count
     */
    getSubscriberCount() {
      return listeners.size;
    }
  };
}

/**
 * Create a store with localStorage persistence
 * @param {string} key - localStorage key
 * @param {Object} initialState - Initial/default state
 * @returns {Object} Persisted store
 */
export function createPersistedStore(key, initialState = {}) {
  // Load from localStorage
  let savedState = {};
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      savedState = JSON.parse(saved);
    }
  } catch (e) {
    console.warn(`[Store] Failed to load persisted state for "${key}":`, e);
  }

  const store = createStore({ ...initialState, ...savedState });

  // Auto-save on changes
  store.subscribe((state) => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`[Store] Failed to persist state for "${key}":`, e);
    }
  });

  // Add clear method
  store.clear = () => {
    localStorage.removeItem(key);
    store.reset();
  };

  return store;
}

/**
 * Create a store scoped to a specific key path
 * @param {Object} parentStore - Parent store
 * @param {string} path - Dot-notation path to scope
 * @returns {Object} Scoped store
 */
export function scopedStore(parentStore, path) {
  const keys = path.split('.');

  const getNestedValue = (obj, keys) => {
    return keys.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  };

  const setNestedValue = (obj, keys, value) => {
    const result = { ...obj };
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  };

  return {
    get(key) {
      const scoped = getNestedValue(parentStore.get(), keys) || {};
      if (key === undefined) return scoped;
      return scoped[key];
    },

    set(update) {
      const current = getNestedValue(parentStore.get(), keys) || {};
      const newValue = typeof update === 'function'
        ? { ...current, ...update(current) }
        : { ...current, ...update };

      parentStore.set(setNestedValue(parentStore.get(), keys, newValue));
    },

    subscribe(listener) {
      return parentStore.subscribe((state, prevState) => {
        const newScoped = getNestedValue(state, keys);
        const prevScoped = getNestedValue(prevState, keys);

        // Only call listener if scoped state changed
        if (newScoped !== prevScoped) {
          listener(newScoped, prevScoped);
        }
      });
    }
  };
}

/**
 * Combine multiple stores into one
 * @param {Object} stores - Object of named stores
 * @returns {Object} Combined store
 */
export function combineStores(stores) {
  const getState = () => {
    const combined = {};
    for (const [name, store] of Object.entries(stores)) {
      combined[name] = store.get();
    }
    return combined;
  };

  return {
    get(key) {
      if (key === undefined) return getState();
      return stores[key]?.get();
    },

    set(key, update) {
      if (stores[key]) {
        stores[key].set(update);
      }
    },

    subscribe(listener) {
      const unsubscribes = [];

      for (const store of Object.values(stores)) {
        unsubscribes.push(
          store.subscribe(() => listener(getState()))
        );
      }

      return () => unsubscribes.forEach(unsub => unsub());
    },

    getStore(key) {
      return stores[key];
    }
  };
}

/**
 * Create a derived store that computes values from other stores
 * @param {Array<Object>} stores - Array of source stores
 * @param {Function} derive - Function to compute derived state
 * @returns {Object} Derived store (read-only)
 */
export function derivedStore(stores, derive) {
  const listeners = new Set();
  let currentValue = derive(...stores.map(s => s.get()));

  // Subscribe to all source stores
  stores.forEach(store => {
    store.subscribe(() => {
      const newValue = derive(...stores.map(s => s.get()));
      if (newValue !== currentValue) {
        const prev = currentValue;
        currentValue = newValue;
        listeners.forEach(l => l(currentValue, prev));
      }
    });
  });

  return {
    get() {
      return currentValue;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// Export for global scope (backward compatibility)
if (typeof window !== 'undefined') {
  window.Store = {
    createStore,
    createPersistedStore,
    scopedStore,
    combineStores,
    derivedStore
  };
}
