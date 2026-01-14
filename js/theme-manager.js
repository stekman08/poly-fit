/**
 * Theme Manager
 * Handles color theme cycling, persistence, and application
 */

import { safeGetItem, safeSetItem } from './storage.js';

const THEMES = [
    { name: 'cyan', primary: '#00E5FF', secondary: '#00B8CC' },
    { name: 'magenta', primary: '#F92672', secondary: '#E02266' },
    { name: 'green', primary: '#A6E22E', secondary: '#8FD125' },
    { name: 'orange', primary: '#FD971F', secondary: '#E0851A' }
];

const THEME_STORAGE_KEY = 'polyfit-theme';

/**
 * Creates a theme manager instance
 * @param {Object} options
 * @param {Object} options.haptics - Haptics module for feedback
 * @returns {Object} Theme manager with load(), cycle(), getCurrentTheme()
 */
export function createThemeManager(options = {}) {
    const { haptics } = options;
    let currentIndex = 0;

    function apply(theme) {
        document.documentElement.style.setProperty('--neon-blue', theme.primary);
    }

    function load() {
        const savedTheme = safeGetItem(THEME_STORAGE_KEY);
        if (savedTheme) {
            const index = THEMES.findIndex(t => t.name === savedTheme);
            if (index !== -1) {
                currentIndex = index;
                apply(THEMES[index]);
            }
        }
    }

    function cycle() {
        currentIndex = (currentIndex + 1) % THEMES.length;
        const theme = THEMES[currentIndex];
        apply(theme);
        safeSetItem(THEME_STORAGE_KEY, theme.name);
        if (haptics) haptics.vibrateRotate();
    }

    function getCurrentTheme() {
        return THEMES[currentIndex];
    }

    function getCurrentIndex() {
        return currentIndex;
    }

    return {
        load,
        cycle,
        getCurrentTheme,
        getCurrentIndex,
        getThemeCount: () => THEMES.length
    };
}
