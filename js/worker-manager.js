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
 * @param {Function} options.showLoading - Show loading overlay () => void
 * @param {Function} options.hideLoading - Hide loading overlay () => void
 * @param {Function} options.showError - Show error UI with retry button () => void
 * @returns {Object} Worker manager API
 */
export function createWorkerManager(options) {
    const {
        onPuzzleReady,
        showLoading,
        hideLoading,
        showError
    } = options;

    const worker = new Worker('js/worker.js', { type: 'module' });

    let preGeneratedPuzzle = null;
    let isGenerating = false;
    let waitingLevel = null;
    let currentRequest = null;
    let currentConfig = null;
    let generationRetryCount = 0;

    function postGenerate(level, kind, configOverride = null) {
        const config = configOverride ?? getDifficultyParams(level);
        config.level = level;
        const reqId = Date.now();

        currentRequest = { level, kind, reqId };
        currentConfig = config;
        isGenerating = true;

        worker.postMessage({
            type: 'GENERATE',
            config,
            reqId
        });
    }

    // Handle worker messages
    worker.onmessage = function (e) {
        const { type, puzzle, error, reqId } = e.data;

        if (type === 'PUZZLE_GENERATED') {
            if (currentRequest && reqId && currentRequest.reqId !== reqId) {
                return;
            }
            generationRetryCount = 0; // Reset on success
            isGenerating = false;

            const completedLevel = currentRequest?.level ?? puzzle?.level;
            const puzzleWithLevel = puzzle?.level !== undefined ? puzzle : { ...puzzle, level: completedLevel };
            const waitingForThisLevel = waitingLevel !== null && puzzleWithLevel?.level === waitingLevel;

            currentRequest = null;
            currentConfig = null;

            if (waitingForThisLevel) {
                const deliveredLevel = waitingLevel;
                waitingLevel = null;
                hideLoading();
                onPuzzleReady(puzzleWithLevel);
                // Pre-generate next level
                preGenerateNextLevel(deliveredLevel + 1);
            } else {
                // Store for later (background pre-generation)
                preGeneratedPuzzle = puzzleWithLevel;

                if (waitingLevel !== null) {
                    // User is waiting for a different level; start it now
                    showLoading();
                    generationRetryCount = 0;
                    postGenerate(waitingLevel, 'user');
                }
            }
        } else if (type === 'ERROR') {
            if (currentRequest && reqId && currentRequest.reqId !== reqId) {
                return;
            }
            isGenerating = false;
            const failedLevel = currentRequest?.level ?? null;
            const userWaitingForFailed = waitingLevel !== null && waitingLevel === failedLevel;

            if (userWaitingForFailed) {
                // Failed while user was waiting
                generationRetryCount++;

                if (generationRetryCount > MAX_WORKER_RETRIES) {
                    showError();
                    waitingLevel = null;
                    currentRequest = null;
                    currentConfig = null;
                    isGenerating = false;
                    return;
                }

                // Retry
                postGenerate(failedLevel, 'user', currentConfig);
                return;
            }

            currentRequest = null;
            currentConfig = null;

            if (waitingLevel !== null) {
                // Switch from failed pre-generation to the user-requested level
                generationRetryCount = 0;
                postGenerate(waitingLevel, 'user');
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

        generationRetryCount = 0;
        preGeneratedPuzzle = null; // Clear old

        postGenerate(nextLevel, 'pre');
    }

    /**
     * Start a level - uses pre-generated puzzle if available, otherwise generates
     * @param {number} level - Level number to start
     */
    function startLevel(level) {
        waitingLevel = level;
        // Check if we have a pre-generated puzzle for this level
        if (preGeneratedPuzzle && preGeneratedPuzzle.level === level) {
            const p = preGeneratedPuzzle;
            preGeneratedPuzzle = null;
            waitingLevel = null;
            onPuzzleReady(p);

            // Immediately start working on the NEXT one
            preGenerateNextLevel(level + 1);
            return;
        }

        // Check if we are currently generating THIS level
        if (isGenerating) {
            showLoading();
            return;
        }

        // Nothing pre-generated, and not generating. Start now.
        showLoading();

        generationRetryCount = 0;
        postGenerate(level, 'user');
    }

    /**
     * Retry generation after failure (called from retry button)
     * @param {number} level - Level to retry
     */
    function retry(level) {
        generationRetryCount = 0;
        waitingLevel = level;

        postGenerate(level, 'user');
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
