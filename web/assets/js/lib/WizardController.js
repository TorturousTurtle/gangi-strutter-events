/**
 * WizardController.js
 *
 * Multi-step form wizard controller for registration flow.
 * Manages step state, navigation, validation, and localStorage persistence.
 */

class WizardController {
  /**
   * @param {Object} config - Wizard configuration
   * @param {string[]} config.steps - Array of step IDs ['participant', 'coach', 'events', 'extras', 'review']
   * @param {string} config.storageKey - localStorage key for draft data
   * @param {Function} config.onStepChange - Callback when step changes (currentStep, previousStep)
   * @param {Function} config.onValidate - Callback to validate a step (stepId) => { valid: bool, errors: {} }
   * @param {Function} config.onComplete - Callback when wizard completes
   */
  constructor(config) {
    this.steps = config.steps || ['participant', 'coach', 'events', 'extras', 'review'];
    this.storageKey = config.storageKey || 'registrationDraft';
    this.onStepChange = config.onStepChange || (() => {});
    this.onValidate = config.onValidate || (() => ({ valid: true, errors: {} }));
    this.onComplete = config.onComplete || (() => {});

    this.currentStepIndex = 0;
    this.stepData = {};
    this.stepValidation = {};

    // Initialize from URL or localStorage
    this._initializeState();
  }

  /**
   * Initialize state from URL params or localStorage
   */
  _initializeState() {
    // Check URL for step parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = urlParams.get('step');

    if (urlStep) {
      const stepIndex = this.steps.indexOf(urlStep);
      if (stepIndex !== -1) {
        this.currentStepIndex = stepIndex;
      }
    }

    // Load draft data from localStorage
    this._loadDraft();
  }

  /**
   * Load draft data from localStorage
   */
  _loadDraft() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          this.stepData = parsed.stepData || {};
          this.stepValidation = parsed.stepValidation || {};

          // Restore step index if saved
          if (typeof parsed.currentStepIndex === 'number') {
            this.currentStepIndex = Math.min(parsed.currentStepIndex, this.steps.length - 1);
          }
        }
      }
    } catch (e) {
      console.warn('[WizardController] Failed to load draft:', e);
    }
  }

  /**
   * Save draft data to localStorage
   */
  _saveDraft() {
    try {
      const data = {
        stepData: this.stepData,
        stepValidation: this.stepValidation,
        currentStepIndex: this.currentStepIndex,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[WizardController] Failed to save draft:', e);
    }
  }

  /**
   * Update URL to reflect current step
   */
  _updateUrl() {
    const stepId = this.steps[this.currentStepIndex];
    const url = new URL(window.location.href);
    url.searchParams.set('step', stepId);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Get current step ID
   */
  getCurrentStep() {
    return this.steps[this.currentStepIndex];
  }

  /**
   * Get current step index (0-based)
   */
  getCurrentStepIndex() {
    return this.currentStepIndex;
  }

  /**
   * Get total number of steps
   */
  getTotalSteps() {
    return this.steps.length;
  }

  /**
   * Check if on first step
   */
  isFirstStep() {
    return this.currentStepIndex === 0;
  }

  /**
   * Check if on last step
   */
  isLastStep() {
    return this.currentStepIndex === this.steps.length - 1;
  }

  /**
   * Check if a step has been completed (validated and passed)
   */
  isStepCompleted(stepId) {
    return this.stepValidation[stepId] === true;
  }

  /**
   * Get step completion status for all steps
   */
  getStepStatuses() {
    return this.steps.map((stepId, index) => ({
      id: stepId,
      index: index,
      isActive: index === this.currentStepIndex,
      isCompleted: this.stepValidation[stepId] === true,
      isAccessible: index <= this.currentStepIndex || this._canAccessStep(index)
    }));
  }

  /**
   * Check if a step can be accessed (all previous steps completed)
   */
  _canAccessStep(stepIndex) {
    for (let i = 0; i < stepIndex; i++) {
      if (!this.stepValidation[this.steps[i]]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Set data for a specific step
   */
  setStepData(stepId, data) {
    this.stepData[stepId] = { ...this.stepData[stepId], ...data };
    this._saveDraft();
  }

  /**
   * Get data for a specific step
   */
  getStepData(stepId) {
    return this.stepData[stepId] || {};
  }

  /**
   * Get all collected data across all steps
   */
  getAllData() {
    const combined = {};
    this.steps.forEach(stepId => {
      const data = this.stepData[stepId] || {};
      Object.assign(combined, data);
    });
    return combined;
  }

  /**
   * Validate current step
   * @returns {Object} { valid: boolean, errors: {} }
   */
  validateCurrentStep() {
    const stepId = this.getCurrentStep();
    const result = this.onValidate(stepId, this.getStepData(stepId));

    this.stepValidation[stepId] = result.valid;
    this._saveDraft();

    return result;
  }

  /**
   * Navigate to next step
   * @returns {boolean} True if navigation succeeded
   */
  next() {
    // Validate current step first
    const validation = this.validateCurrentStep();
    if (!validation.valid) {
      return false;
    }

    if (this.isLastStep()) {
      // Complete wizard
      this.onComplete(this.getAllData());
      return true;
    }

    const previousStep = this.getCurrentStep();
    this.currentStepIndex++;
    const currentStep = this.getCurrentStep();

    this._updateUrl();
    this._saveDraft();
    this.onStepChange(currentStep, previousStep, 'forward');

    return true;
  }

  /**
   * Navigate to previous step
   * @returns {boolean} True if navigation succeeded
   */
  back() {
    if (this.isFirstStep()) {
      return false;
    }

    const previousStep = this.getCurrentStep();
    this.currentStepIndex--;
    const currentStep = this.getCurrentStep();

    this._updateUrl();
    this._saveDraft();
    this.onStepChange(currentStep, previousStep, 'backward');

    return true;
  }

  /**
   * Jump to a specific step (if accessible)
   * @param {string} stepId - The step ID to jump to
   * @returns {boolean} True if navigation succeeded
   */
  goToStep(stepId) {
    const targetIndex = this.steps.indexOf(stepId);
    if (targetIndex === -1) {
      console.warn(`[WizardController] Unknown step: ${stepId}`);
      return false;
    }

    // Can always go back
    if (targetIndex < this.currentStepIndex) {
      const previousStep = this.getCurrentStep();
      this.currentStepIndex = targetIndex;
      this._updateUrl();
      this._saveDraft();
      this.onStepChange(stepId, previousStep, 'jump');
      return true;
    }

    // Going forward requires validation of all intermediate steps
    if (!this._canAccessStep(targetIndex)) {
      return false;
    }

    const previousStep = this.getCurrentStep();
    this.currentStepIndex = targetIndex;
    this._updateUrl();
    this._saveDraft();
    this.onStepChange(stepId, previousStep, 'jump');
    return true;
  }

  /**
   * Reset wizard to initial state
   */
  reset() {
    this.currentStepIndex = 0;
    this.stepData = {};
    this.stepValidation = {};
    localStorage.removeItem(this.storageKey);
    this._updateUrl();
    this.onStepChange(this.getCurrentStep(), null, 'reset');
  }

  /**
   * Clear saved draft without resetting current state
   */
  clearDraft() {
    localStorage.removeItem(this.storageKey);
  }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WizardController;
}

// Also attach to window for script tag usage
if (typeof window !== 'undefined') {
  window.WizardController = WizardController;
}
