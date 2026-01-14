/**
 * Cheat Code Detector
 * Sequence: Title(1) -> Level(2) -> Title(3) -> Level(4)
 * Total: 10 taps alternating between TITLE and LEVEL
 */

/**
 * Creates a cheat code detector with pure logic (no DOM dependency)
 * @param {Object} options
 * @param {Function} options.onSuccess - Called when sequence is completed
 * @param {Function} options.onProgress - Called on each correct tap with (current, total)
 * @param {number} options.resetDelay - Timeout before reset (default 1500ms)
 * @returns {Object} Detector with tap(), reset(), getProgress(), getExpectedLength()
 */
export function createCheatCodeDetector(options = {}) {
    const EXPECTED = ['TITLE', 'LEVEL', 'LEVEL', 'TITLE', 'TITLE', 'TITLE', 'LEVEL', 'LEVEL', 'LEVEL', 'LEVEL'];
    const RESET_DELAY = options.resetDelay ?? 1500;

    let tapIndex = 0;
    let resetTimer = null;
    const onSuccess = options.onSuccess ?? (() => {});
    const onProgress = options.onProgress ?? (() => {});

    function reset() {
        tapIndex = 0;
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = null;
    }

    function tap(targetName) {
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(reset, RESET_DELAY);

        if (targetName === EXPECTED[tapIndex]) {
            // Correct tap
            tapIndex++;
            onProgress(tapIndex, EXPECTED.length);

            if (tapIndex >= EXPECTED.length) {
                // Sequence complete!
                onSuccess();
                reset();
                return { success: true, progress: EXPECTED.length };
            }
            return { success: false, progress: tapIndex };
        } else if (targetName === 'TITLE') {
            // Wrong tap, but TITLE can restart sequence
            tapIndex = 1;
            onProgress(tapIndex, EXPECTED.length);
            return { success: false, progress: tapIndex, restarted: true };
        } else {
            // Wrong tap - full reset
            reset();
            return { success: false, progress: 0, reset: true };
        }
    }

    return {
        tap,
        reset,
        getProgress: () => tapIndex,
        getExpectedLength: () => EXPECTED.length
    };
}

/**
 * Sets up cheat code detection with DOM event listeners
 * @param {Object} callbacks
 * @param {Function} callbacks.onSuccess - Called when cheat code is triggered
 * @param {Object} callbacks.haptics - Haptics module for feedback
 * @returns {Object|null} The detector instance, or null if elements not found
 */
export function setupCheatCode(callbacks = {}) {
    const { onSuccess, haptics } = callbacks;

    const titleEl = document.getElementById('title-display');
    const levelEl = document.getElementById('level-display');

    if (!titleEl || !levelEl) return null;

    const detector = createCheatCodeDetector({
        onSuccess: () => {
            if (haptics) haptics.vibrateWin();
            if (onSuccess) onSuccess();
        },
        onProgress: () => {
            if (haptics) haptics.vibrateRotate();
        }
    });

    titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        detector.tap('TITLE');
    });

    levelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        detector.tap('LEVEL');
    });

    return detector;
}
