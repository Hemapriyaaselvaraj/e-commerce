/**
 * Date formatting utilities for consistent local date display
 * Supports Indian locale (en-IN) as primary with fallback options
 */

const DEFAULT_LOCALE = 'en-IN';
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date to local date string
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-IN')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(date, locale = DEFAULT_LOCALE, options = {}) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE
  };
  
  return dateObj.toLocaleDateString(locale, { ...defaultOptions, ...options });
}

/**
 * Format date and time to local string
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-IN')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date and time string
 */
function formatDateTime(date, locale = DEFAULT_LOCALE, options = {}) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIMEZONE
  };
  
  return dateObj.toLocaleString(locale, { ...defaultOptions, ...options });
}

/**
 * Format time only to local string
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-IN')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string
 */
function formatTime(date, locale = DEFAULT_LOCALE, options = {}) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIMEZONE
  };
  
  return dateObj.toLocaleTimeString(locale, { ...defaultOptions, ...options });
}

/**
 * Format date for form inputs (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string for input[type="date"]
 */
function formatDateForInput(date) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toISOString().split('T')[0];
}

/**
 * Format date range
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} locale - Locale code (default: 'en-IN')
 * @returns {string} Formatted date range string
 */
function formatDateRange(startDate, endDate, locale = DEFAULT_LOCALE) {
  const start = formatDate(startDate, locale);
  const end = formatDate(endDate, locale);
  
  if (!start && !end) return '';
  if (!start) return `Until ${end}`;
  if (!end) return `From ${start}`;
  
  return `${start} to ${end}`;
}

/**
 * Get relative time (e.g., "2 days ago", "in 3 hours")
 * @param {Date|string} date - Date to compare
 * @param {string} locale - Locale code (default: 'en-IN')
 * @returns {string} Relative time string
 */
function getRelativeTime(date, locale = DEFAULT_LOCALE) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (Math.abs(diffInSeconds) < 60) return 'Just now';
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  const intervals = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds);
    if (count >= 1) {
      return rtf.format(diffInSeconds < 0 ? count : -count, interval.unit);
    }
  }
  
  return 'Just now';
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDate,
    formatDateTime,
    formatTime,
    formatDateForInput,
    formatDateRange,
    getRelativeTime,
    DEFAULT_LOCALE,
    DEFAULT_TIMEZONE
  };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.DateFormatter = {
    formatDate,
    formatDateTime,
    formatTime,
    formatDateForInput,
    formatDateRange,
    getRelativeTime,
    DEFAULT_LOCALE,
    DEFAULT_TIMEZONE
  };
}