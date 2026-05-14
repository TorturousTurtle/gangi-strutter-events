/**
 * Formatters Library
 * Consistent formatting functions for dates, currency, phone numbers, etc.
 */

/**
 * Format a number as currency (USD)
 * @param {number|string} value - The value to format
 * @param {boolean} showSymbol - Whether to include the $ symbol (default: true)
 * @returns {string} Formatted currency string
 */
export function formatMoney(value, showSymbol = true) {
  const num = Number(value);
  if (!Number.isFinite(num)) return showSymbol ? '$0.00' : '0.00';
  const formatted = num.toFixed(2);
  return showSymbol ? `$${formatted}` : formatted;
}

/**
 * Format a number as currency, returns empty string for zero/invalid
 * @param {number|string} value - The value to format
 * @returns {string} Formatted currency string or empty
 */
export function formatMoneyOrEmpty(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '';
  return `$${num.toFixed(2)}`;
}

/**
 * Format a date string for display
 * @param {string|Date} value - ISO date string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(value, options = {}) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };

  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format a datetime string for display
 * @param {string|Date} value - ISO datetime string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(value, options = {}) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  };

  return date.toLocaleString(undefined, defaultOptions);
}

/**
 * Format a date range for display
 * @param {string|Date} start - Start date
 * @param {string|Date} end - End date
 * @returns {string} Formatted date range
 */
export function formatDateRange(start, end) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (!start && !end) return '';
  if (start && !end) return formatDateTime(startDate);
  if (!start && end) return formatDateTime(endDate);

  return `${formatDateTime(startDate)} – ${formatDateTime(endDate)}`;
}

/**
 * Format a phone number for display
 * @param {string} value - Phone number string
 * @returns {string} Formatted phone number
 */
export function formatPhone(value) {
  if (!value) return '';

  // Remove all non-digits
  const digits = String(value).replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX for 10-digit numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Format as +X (XXX) XXX-XXXX for 11-digit numbers (with country code)
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if we can't format
  return value;
}

/**
 * Format a date string to YYYY-MM-DD for date inputs
 * @param {string|Date} value - Date value
 * @returns {string} YYYY-MM-DD formatted string
 */
export function formatDateInput(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

/**
 * Format a datetime string to YYYY-MM-DDTHH:MM for datetime-local inputs
 * @param {string|Date} value - DateTime value
 * @returns {string} YYYY-MM-DDTHH:MM formatted string
 */
export function formatDateTimeInput(value) {
  if (!value) return '';

  // Handle MySQL datetime format "YYYY-MM-DD HH:MM:SS"
  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');

  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';

  // Adjust for timezone offset to get local time
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Parse a MySQL datetime string to Date object
 * @param {string} value - MySQL datetime string (YYYY-MM-DD HH:MM:SS)
 * @returns {Date|null} Date object or null
 */
export function parseMySqlDatetime(value) {
  if (!value) return null;

  // Convert "YYYY-MM-DD HH:MM:SS" to ISO format
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);

  return isNaN(date.getTime()) ? null : date;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate a string to a maximum length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength - 3) + '...';
}

/**
 * Format a number with thousands separators
 * @param {number|string} value - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString();
}

/**
 * Format a percentage
 * @param {number} value - Value between 0 and 1 (or 0 and 100)
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercent(value, decimals = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';

  // If value is already 0-100, use as-is; otherwise multiply by 100
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(decimals)}%`;
}

// Export for global scope (backward compatibility)
if (typeof window !== 'undefined') {
  window.Formatters = {
    formatMoney,
    formatMoneyOrEmpty,
    formatDate,
    formatDateTime,
    formatDateRange,
    formatPhone,
    formatDateInput,
    formatDateTimeInput,
    parseMySqlDatetime,
    escapeHtml,
    truncate,
    formatNumber,
    formatPercent
  };
}
