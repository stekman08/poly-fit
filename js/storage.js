/**
 * Safe localStorage helpers
 * Handles private browsing, disabled storage, quota exceeded, etc.
 */

/**
 * Safely get an item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Value to return if key doesn't exist or storage fails
 * @returns {string|*} The stored value or defaultValue
 */
export function safeGetItem(key, defaultValue = null) {
    try {
        return localStorage.getItem(key) ?? defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Safely set an item in localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
export function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}
