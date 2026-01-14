/**
 * Worker Manager
 * Handles puzzle generation worker communication, pre-generation, and retry logic
 */

import { getDifficultyParams } from './config/difficulty.js';
import { MAX_WORKER_RETRIES } from './config/constants.js';

/**
 * Creates a worker manager for puzzle generation
 * @param {Object} options
 * @param {Function} options.onPuzzleReady - Called when puzzle is ready to start (puzzleData) => void
 * @param {Function} options.onError - Called on unrecoverable error () => void
 * @param {Function} options.showLoading - Show loading overlay () => void
 * @param {Function} options.hideLoading - Hide loading overlay () => void
 * @param {Function} options.showError - Show error UI with retry button () => void
 * @returns {Object} Worker manager API
 */
export function createWorkerManager(options) {
    const {
        onPuzzleReady,
        onError,
        showLoading,
        hideLoading,
        showError
    } = options;

    const worker = new Worker('js/worker.js', { type: 'module' });

    let preGeneratedPuzzle = null;
    let isGenerating = false;
    let pendingLevelStart = null;
    let pendingConfig = null;
    let generationRetryCount = 0;

    // Handle worker messages
    worker.onmessage = function (e) {
        const { type, puzzle, error, reqId } = e.data;

        if (type === 'PUZZLE_GENERATED') {
            generationRetryCount = 0; // Reset on success

            if (pendingLevelStart !== null) {
                // We were waiting for this!
                const completedLevel = pendingLevelStart;
                pendingLevelStart = null;
                hideLoading();
                onPuzzleReady(puzzle);
                // Pre-generate next level
                preGenerateNextLevel(completedLevel + 1);
            } else {
                // Store for later (background pre-generation)
                preGeneratedPuzzle = puzzle;
            }
            isGenerating = false;
        } else if (type === 'ERROR') {
            isGenerating = false;

            if (pendingLevelStart !== null) {
                // Failed while user was waiting
                generationRetryCount++;

                if (generationRetryCount > MAX_WORKER_RETRIES) {
                    showError();
                    pendingLevelStart = null;
                    isGenerating = false;
                    return;
                }

                // Retry
                isGenerating = true;
                worker.postMessage({ type: 'GENERATE', config: pendingConfig, reqId: Date.now() });
            }
        }
    };

    /**
     * Pre-generate puzzle for the next level in background
     * @param {number} nextLevel - Level number to pre-generate
     */
    function preGenerateNextLevel(nextLevel) {
        if (isGenerating) return; // Already busy

        // Don't pre-generate if we already have the right one
        if (preGeneratedPuzzle && preGeneratedPuzzle.level === nextLevel) return;

        isGenerating = true;
        generationRetryCount = 0;
        preGeneratedPuzzle = null; // Clear old

        const config = getDifficultyParams(nextLevel);
        config.level = nextLevel;

        worker.postMessage({
            type: 'GENERATE',
            config,
            reqId: Date.now()
        });
    }

    /**
     * Start a level - uses pre-generated puzzle if available, otherwise generates
     * @param {number} level - Level number to start
     */
    function startLevel(level) {
        // Check if we have a pre-generated puzzle for this level
        if (preGeneratedPuzzle && preGeneratedPuzzle.level === level) {
            const p = preGeneratedPuzzle;
            preGeneratedPuzzle = null;
            onPuzzleReady(p);

            // Immediately start working on the NEXT one
            preGenerateNextLevel(level + 1);
            return;
        }

        // Check if we are currently generating THIS level
        if (isGenerating) {
            showLoading();
            pendingLevelStart = level;
            return;
        }

        // Nothing pre-generated, and not generating. Start now.
        showLoading();

        isGenerating = true;
        generationRetryCount = 0;
        pendingLevelStart = level;

        pendingConfig = getDifficultyParams(level);
        pendingConfig.level = level;
        worker.postMessage({ type: 'GENERATE', config: pendingConfig, reqId: Date.now() });
    }

    /**
     * Retry generation after failure (called from retry button)
     * @param {number} level - Level to retry
     */
    function retry(level) {
        generationRetryCount = 0;
        isGenerating = true;
        pendingLevelStart = level;

        const config = getDifficultyParams(level);
        config.level = level;
        pendingConfig = config;
        worker.postMessage({ type: 'GENERATE', config, reqId: Date.now() });
    }

    /**
     * Get the raw worker instance (for testing)
     */
    function getWorker() {
        return worker;
    }

    return {
        preGenerateNextLevel,
        startLevel,
        retry,
        getWorker
    };
}
