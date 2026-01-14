import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../js/config/difficulty.js', () => ({
    getDifficultyParams: vi.fn((level) => ({
        rows: 5,
        cols: 5,
        pieceCount: 3 + Math.floor(level / 50)
    }))
}));

vi.mock('../../js/config/constants.js', () => ({
    MAX_WORKER_RETRIES: 3
}));

import { createWorkerManager } from '../../js/worker-manager.js';
import { getDifficultyParams } from '../../js/config/difficulty.js';

describe('worker-manager', () => {
    let mockWorkerInstance;
    let capturedOnMessage;

    beforeEach(() => {
        // Create a mock Worker instance
        mockWorkerInstance = {
            postMessage: vi.fn(),
            _onmessage: null
        };

        // Define onmessage as a property to capture the setter
        Object.defineProperty(mockWorkerInstance, 'onmessage', {
            get() { return this._onmessage; },
            set(fn) {
                this._onmessage = fn;
                capturedOnMessage = fn;
            },
            configurable: true
        });

        // Create a proper constructor function
        function MockWorkerClass(url, options) {
            return mockWorkerInstance;
        }

        vi.stubGlobal('Worker', MockWorkerClass);
        vi.mocked(getDifficultyParams).mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('preGenerateNextLevel', () => {
        it('posts GENERATE message to worker', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.preGenerateNextLevel(5);

            expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATE',
                    config: expect.objectContaining({ level: 5 })
                })
            );
        });

        it('does not generate if already generating', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.preGenerateNextLevel(5);
            manager.preGenerateNextLevel(6);

            // Should only post once
            expect(mockWorkerInstance.postMessage).toHaveBeenCalledTimes(1);
        });

        it('stores generated puzzle for later use', () => {
            const onPuzzleReady = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady,
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.preGenerateNextLevel(5);

            // Simulate worker response
            capturedOnMessage({
                data: {
                    type: 'PUZZLE_GENERATED',
                    puzzle: { level: 5, grid: [[1]] }
                }
            });

            // onPuzzleReady should NOT be called for background pre-generation
            expect(onPuzzleReady).not.toHaveBeenCalled();
        });
    });

    describe('startLevel', () => {
        it('uses pre-generated puzzle if available', () => {
            const onPuzzleReady = vi.fn();
            const showLoading = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady,
                onError: vi.fn(),
                showLoading,
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            // Pre-generate level 5
            manager.preGenerateNextLevel(5);
            capturedOnMessage({
                data: {
                    type: 'PUZZLE_GENERATED',
                    puzzle: { level: 5, grid: [[1]] }
                }
            });

            // Now start level 5
            manager.startLevel(5);

            expect(showLoading).not.toHaveBeenCalled();
            expect(onPuzzleReady).toHaveBeenCalledWith({ level: 5, grid: [[1]] });
        });

        it('shows loading and generates when no pre-generated puzzle', () => {
            const onPuzzleReady = vi.fn();
            const showLoading = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady,
                onError: vi.fn(),
                showLoading,
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.startLevel(10);

            expect(showLoading).toHaveBeenCalled();
            expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATE',
                    config: expect.objectContaining({ level: 10 })
                })
            );
        });

        it('hides loading and calls onPuzzleReady when puzzle arrives', () => {
            const onPuzzleReady = vi.fn();
            const hideLoading = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady,
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading,
                showError: vi.fn()
            });

            manager.startLevel(10);

            capturedOnMessage({
                data: {
                    type: 'PUZZLE_GENERATED',
                    puzzle: { level: 10, data: 'test' }
                }
            });

            expect(hideLoading).toHaveBeenCalled();
            expect(onPuzzleReady).toHaveBeenCalledWith({ level: 10, data: 'test' });
        });

        it('sets isGenerating to false after puzzle received (allows subsequent generation)', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.startLevel(10);

            capturedOnMessage({
                data: {
                    type: 'PUZZLE_GENERATED',
                    puzzle: { level: 10 }
                }
            });

            // After receiving puzzle, isGenerating should be false
            // so preGenerateNextLevel should work now
            mockWorkerInstance.postMessage.mockClear();
            manager.preGenerateNextLevel(11);

            expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATE',
                    config: expect.objectContaining({ level: 11 })
                })
            );
        });

        it('shows loading when waiting for in-progress generation', () => {
            const showLoading = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading,
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            // Start pre-generating level 5 (in progress)
            manager.preGenerateNextLevel(5);

            // Clear to check startLevel behavior
            showLoading.mockClear();

            // Try to start level 5 while it's being generated
            manager.startLevel(5);

            expect(showLoading).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('retries on error when user is waiting', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.startLevel(10);
            mockWorkerInstance.postMessage.mockClear();

            // Simulate error
            capturedOnMessage({
                data: {
                    type: 'ERROR',
                    error: 'Generation failed'
                }
            });

            // Should retry
            expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATE'
                })
            );
        });

        it('shows error after max retries exceeded', () => {
            const showError = vi.fn();
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError
            });

            manager.startLevel(10);

            // Simulate MAX_WORKER_RETRIES + 1 errors (mocked to 3)
            for (let i = 0; i < 4; i++) {
                capturedOnMessage({
                    data: {
                        type: 'ERROR',
                        error: 'Generation failed'
                    }
                });
            }

            expect(showError).toHaveBeenCalled();
        });

        it('does not retry if no user waiting', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            // Pre-generate in background
            manager.preGenerateNextLevel(5);
            mockWorkerInstance.postMessage.mockClear();

            // Simulate error (no user waiting)
            capturedOnMessage({
                data: {
                    type: 'ERROR',
                    error: 'Generation failed'
                }
            });

            // Should NOT retry for background generation
            expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('retry', () => {
        it('resets retry count and starts generation', () => {
            const manager = createWorkerManager({
                onPuzzleReady: vi.fn(),
                onError: vi.fn(),
                showLoading: vi.fn(),
                hideLoading: vi.fn(),
                showError: vi.fn()
            });

            manager.retry(15);

            expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATE',
                    config: expect.objectContaining({ level: 15 })
                })
            );
        });
    });
});
