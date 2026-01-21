import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCheatCodeDetector, setupCheatCode } from '../../js/cheat-code.js';

describe('CheatCodeDetector', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('correct sequence', () => {
        it('triggers success on complete sequence: 5x TITLE', () => {
            const onSuccess = vi.fn();
            const detector = createCheatCodeDetector({ onSuccess });

            detector.tap('TITLE');   // 1
            detector.tap('TITLE');   // 2
            detector.tap('TITLE');   // 3
            detector.tap('TITLE');   // 4
            const result = detector.tap('TITLE'); // 5

            expect(result.success).toBe(true);
            expect(onSuccess).toHaveBeenCalledOnce();
        });

        it('calls onProgress on each correct tap', () => {
            const onProgress = vi.fn();
            const detector = createCheatCodeDetector({ onProgress });

            detector.tap('TITLE');
            expect(onProgress).toHaveBeenCalledWith(1, 5);

            detector.tap('TITLE');
            expect(onProgress).toHaveBeenCalledWith(2, 5);

            detector.tap('TITLE');
            expect(onProgress).toHaveBeenCalledWith(3, 5);
        });

        it('returns correct progress values', () => {
            const detector = createCheatCodeDetector();

            expect(detector.tap('TITLE').progress).toBe(1);
            expect(detector.tap('TITLE').progress).toBe(2);
            expect(detector.tap('TITLE').progress).toBe(3);
        });

        it('getProgress() tracks current position', () => {
            const detector = createCheatCodeDetector();

            expect(detector.getProgress()).toBe(0);
            detector.tap('TITLE');
            expect(detector.getProgress()).toBe(1);
            detector.tap('TITLE');
            expect(detector.getProgress()).toBe(2);
        });

        it('getExpectedLength() returns 5', () => {
            const detector = createCheatCodeDetector();
            expect(detector.getExpectedLength()).toBe(5);
        });
    });

    describe('wrong sequence', () => {
        it('resets when tapping LEVEL first', () => {
            const onSuccess = vi.fn();
            const detector = createCheatCodeDetector({ onSuccess });

            const result = detector.tap('LEVEL');

            expect(result.reset).toBe(true);
            expect(result.progress).toBe(0);
            expect(detector.getProgress()).toBe(0);
        });

        it('resets when tapping LEVEL mid-sequence', () => {
            const detector = createCheatCodeDetector();

            detector.tap('TITLE');  // progress: 1
            detector.tap('TITLE');  // progress: 2
            const result = detector.tap('LEVEL');

            expect(result.reset).toBe(true);
            expect(detector.getProgress()).toBe(0);
        });
    });

    describe('timeout', () => {
        it('resets after RESET_DELAY (default 1500ms)', () => {
            const detector = createCheatCodeDetector();

            detector.tap('TITLE');
            expect(detector.getProgress()).toBe(1);

            vi.advanceTimersByTime(1600);
            expect(detector.getProgress()).toBe(0);
        });

        it('respects custom resetDelay', () => {
            const detector = createCheatCodeDetector({ resetDelay: 500 });

            detector.tap('TITLE');
            expect(detector.getProgress()).toBe(1);

            vi.advanceTimersByTime(400);
            expect(detector.getProgress()).toBe(1); // Still active

            vi.advanceTimersByTime(200);
            expect(detector.getProgress()).toBe(0); // Now reset
        });

        it('resets timer on each tap', () => {
            const detector = createCheatCodeDetector({ resetDelay: 1500 });

            detector.tap('TITLE');
            vi.advanceTimersByTime(1000);

            detector.tap('TITLE');
            vi.advanceTimersByTime(1000);

            // Total 2000ms elapsed, but timer reset after second tap
            expect(detector.getProgress()).toBe(2);

            vi.advanceTimersByTime(600);
            // Now 1600ms since last tap - should be reset
            expect(detector.getProgress()).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('can complete sequence after LEVEL reset', () => {
            const onSuccess = vi.fn();
            const detector = createCheatCodeDetector({ onSuccess });

            // Start, then mess up with LEVEL
            detector.tap('TITLE');
            detector.tap('LEVEL'); // Reset

            // Now complete correctly from beginning
            detector.tap('TITLE');
            detector.tap('TITLE');
            detector.tap('TITLE');
            detector.tap('TITLE');
            detector.tap('TITLE');

            expect(onSuccess).toHaveBeenCalledOnce();
        });

        it('resets progress after success', () => {
            const detector = createCheatCodeDetector();

            // Complete sequence
            ['TITLE', 'TITLE', 'TITLE', 'TITLE', 'TITLE']
                .forEach(t => detector.tap(t));

            expect(detector.getProgress()).toBe(0);
        });

        it('can trigger sequence multiple times', () => {
            const onSuccess = vi.fn();
            const detector = createCheatCodeDetector({ onSuccess });

            const sequence = ['TITLE', 'TITLE', 'TITLE', 'TITLE', 'TITLE'];

            // First time
            sequence.forEach(t => detector.tap(t));
            expect(onSuccess).toHaveBeenCalledTimes(1);

            // Second time
            sequence.forEach(t => detector.tap(t));
            expect(onSuccess).toHaveBeenCalledTimes(2);
        });

        it('manual reset() clears progress', () => {
            const detector = createCheatCodeDetector();

            detector.tap('TITLE');
            detector.tap('TITLE');
            expect(detector.getProgress()).toBe(2);

            detector.reset();
            expect(detector.getProgress()).toBe(0);
        });
    });
});

describe('setupCheatCode', () => {
    let mockTitleEl;
    let mockLevelEl;
    let mockAttributes;
    let originalDocument;

    beforeEach(() => {
        vi.useFakeTimers();
        originalDocument = global.document;

        // Create mock elements with event listener support
        mockAttributes = {};
        mockTitleEl = {
            addEventListener: vi.fn(),
            hasAttribute: vi.fn((attr) => !!mockAttributes[attr]),
            setAttribute: vi.fn((attr, value) => { mockAttributes[attr] = value; })
        };
        mockLevelEl = {
            addEventListener: vi.fn()
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        global.document = originalDocument;
    });

    it('returns null when title-display element is missing', () => {
        global.document = {
            getElementById: vi.fn().mockReturnValue(null)
        };

        const result = setupCheatCode({ onSuccess: vi.fn() });

        expect(result).toBeNull();
    });

    it('returns null when level-display element is missing', () => {
        global.document = {
            getElementById: vi.fn((id) => {
                if (id === 'title-display') return mockTitleEl;
                return null;
            })
        };

        const result = setupCheatCode({ onSuccess: vi.fn() });

        expect(result).toBeNull();
    });

    it('clicking title element calls tap with TITLE', () => {
        global.document = {
            getElementById: vi.fn((id) => {
                if (id === 'title-display') return mockTitleEl;
                if (id === 'level-display') return mockLevelEl;
                return null;
            })
        };

        const detector = setupCheatCode({ onSuccess: vi.fn() });

        // Get the click handler
        const clickHandler = mockTitleEl.addEventListener.mock.calls[0][1];
        const mockEvent = { stopPropagation: vi.fn() };

        clickHandler(mockEvent);

        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(detector.getProgress()).toBe(1);
    });

    it('clicking level element resets progress', () => {
        global.document = {
            getElementById: vi.fn((id) => {
                if (id === 'title-display') return mockTitleEl;
                if (id === 'level-display') return mockLevelEl;
                return null;
            })
        };

        const detector = setupCheatCode({ onSuccess: vi.fn() });

        // First tap TITLE to start sequence
        const titleHandler = mockTitleEl.addEventListener.mock.calls[0][1];
        titleHandler({ stopPropagation: vi.fn() });
        expect(detector.getProgress()).toBe(1);

        // Then tap LEVEL - should reset
        const levelHandler = mockLevelEl.addEventListener.mock.calls[0][1];
        const mockEvent = { stopPropagation: vi.fn() };
        levelHandler(mockEvent);

        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(detector.getProgress()).toBe(0);
    });

    it('calls haptics.vibrateRotate on progress', () => {
        const mockHaptics = { vibrateRotate: vi.fn(), vibrateWin: vi.fn() };

        global.document = {
            getElementById: vi.fn((id) => {
                if (id === 'title-display') return mockTitleEl;
                if (id === 'level-display') return mockLevelEl;
                return null;
            })
        };

        setupCheatCode({ onSuccess: vi.fn(), haptics: mockHaptics });

        // Trigger title click
        const titleHandler = mockTitleEl.addEventListener.mock.calls[0][1];
        titleHandler({ stopPropagation: vi.fn() });

        expect(mockHaptics.vibrateRotate).toHaveBeenCalled();
    });

    it('calls haptics.vibrateWin and onSuccess when sequence completes', () => {
        const mockHaptics = { vibrateRotate: vi.fn(), vibrateWin: vi.fn() };
        const onSuccess = vi.fn();

        global.document = {
            getElementById: vi.fn((id) => {
                if (id === 'title-display') return mockTitleEl;
                if (id === 'level-display') return mockLevelEl;
                return null;
            })
        };

        setupCheatCode({ onSuccess, haptics: mockHaptics });

        const titleHandler = mockTitleEl.addEventListener.mock.calls[0][1];
        const mockEvent = { stopPropagation: vi.fn() };

        // Complete sequence: 5x TITLE
        titleHandler(mockEvent);  // 1
        titleHandler(mockEvent);  // 2
        titleHandler(mockEvent);  // 3
        titleHandler(mockEvent);  // 4
        titleHandler(mockEvent);  // 5

        expect(mockHaptics.vibrateWin).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
    });
});
