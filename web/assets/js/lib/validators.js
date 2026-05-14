/**
 * Validators Library
 * Form validation rules and utilities
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Object<string, string>} errors - Field errors keyed by field name
 */

/**
 * Check if a value is empty (null, undefined, or empty string)
 * @param {*} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validate that a value is not empty
 * @param {*} value - Value to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function required(value, message = 'This field is required') {
  return isEmpty(value) ? message : null;
}

/**
 * Validate email format
 * @param {string} value - Email to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function email(value, message = 'Please enter a valid email address') {
  if (isEmpty(value)) return null; // Use required() for required check
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(value) ? null : message;
}

/**
 * Validate phone number format
 * @param {string} value - Phone to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function phone(value, message = 'Please enter a valid phone number') {
  if (isEmpty(value)) return null;
  // Accept 10+ digits, allowing common separators
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 10 ? null : message;
}

/**
 * Validate minimum length
 * @param {string} value - Value to validate
 * @param {number} min - Minimum length
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function minLength(value, min, message = null) {
  if (isEmpty(value)) return null;
  const msg = message || `Must be at least ${min} characters`;
  return String(value).length >= min ? null : msg;
}

/**
 * Validate maximum length
 * @param {string} value - Value to validate
 * @param {number} max - Maximum length
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function maxLength(value, max, message = null) {
  if (isEmpty(value)) return null;
  const msg = message || `Must be no more than ${max} characters`;
  return String(value).length <= max ? null : msg;
}

/**
 * Validate minimum numeric value
 * @param {number|string} value - Value to validate
 * @param {number} min - Minimum value
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function minValue(value, min, message = null) {
  if (isEmpty(value)) return null;
  const num = Number(value);
  const msg = message || `Must be at least ${min}`;
  return Number.isFinite(num) && num >= min ? null : msg;
}

/**
 * Validate maximum numeric value
 * @param {number|string} value - Value to validate
 * @param {number} max - Maximum value
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function maxValue(value, max, message = null) {
  if (isEmpty(value)) return null;
  const num = Number(value);
  const msg = message || `Must be no more than ${max}`;
  return Number.isFinite(num) && num <= max ? null : msg;
}

/**
 * Validate against a regex pattern
 * @param {string} value - Value to validate
 * @param {RegExp} pattern - Regex pattern
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function pattern(value, regex, message = 'Invalid format') {
  if (isEmpty(value)) return null;
  return regex.test(value) ? null : message;
}

/**
 * Validate date is not in the future
 * @param {string} value - Date string to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function notFutureDate(value, message = 'Date cannot be in the future') {
  if (isEmpty(value)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date <= new Date() ? null : message;
}

/**
 * Validate date is not in the past
 * @param {string} value - Date string to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function notPastDate(value, message = 'Date cannot be in the past') {
  if (isEmpty(value)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  // Compare dates only (not times)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date >= today ? null : message;
}

/**
 * Validate that a value is numeric
 * @param {*} value - Value to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function numeric(value, message = 'Must be a number') {
  if (isEmpty(value)) return null;
  return Number.isFinite(Number(value)) ? null : message;
}

/**
 * Validate that a value is a positive number
 * @param {*} value - Value to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function positiveNumber(value, message = 'Must be a positive number') {
  if (isEmpty(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? null : message;
}

/**
 * Validate that a value is a non-negative number
 * @param {*} value - Value to validate
 * @param {string} message - Error message
 * @returns {string|null} Error message or null if valid
 */
export function nonNegative(value, message = 'Must be zero or greater') {
  if (isEmpty(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? null : message;
}

/**
 * Run multiple validators on a single value
 * @param {*} value - Value to validate
 * @param {Array<Function>} validators - Array of validator functions
 * @returns {string|null} First error message or null if all valid
 */
export function compose(value, validators) {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
}

/**
 * Validate an object of fields against a schema
 * @param {Object} data - Object with field values
 * @param {Object} schema - Object with field validators { fieldName: [validators] }
 * @returns {ValidationResult} Validation result
 */
export function validateForm(data, schema) {
  const errors = {};

  for (const [field, validators] of Object.entries(schema)) {
    const value = data[field];
    const validatorList = Array.isArray(validators) ? validators : [validators];

    for (const validator of validatorList) {
      const error = typeof validator === 'function' ? validator(value) : null;
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Create a required validator with custom message
 * @param {string} message - Custom error message
 * @returns {Function} Validator function
 */
export function requiredWith(message) {
  return (value) => required(value, message);
}

/**
 * Create an email validator with custom message
 * @param {string} message - Custom error message
 * @returns {Function} Validator function
 */
export function emailWith(message) {
  return (value) => email(value, message);
}

/**
 * Create a minLength validator with custom params
 * @param {number} min - Minimum length
 * @param {string} message - Custom error message
 * @returns {Function} Validator function
 */
export function minLengthWith(min, message) {
  return (value) => minLength(value, min, message);
}

/**
 * Create a pattern validator with custom params
 * @param {RegExp} regex - Pattern to match
 * @param {string} message - Custom error message
 * @returns {Function} Validator function
 */
export function patternWith(regex, message) {
  return (value) => pattern(value, regex, message);
}

// Export for global scope (backward compatibility)
if (typeof window !== 'undefined') {
  window.Validators = {
    isEmpty,
    required,
    email,
    phone,
    minLength,
    maxLength,
    minValue,
    maxValue,
    pattern,
    notFutureDate,
    notPastDate,
    numeric,
    positiveNumber,
    nonNegative,
    compose,
    validateForm,
    requiredWith,
    emailWith,
    minLengthWith,
    patternWith
  };
}
