import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock puzzle.js before importing worker
vi.mock('../../js/puzzle.js', () => ({
    generatePuzzle: vi.fn()
}));

import { generatePuzzle } from '../../js/puzzle.js';

describe('worker', () => {
    let messageHandler;
    let mockPostMessage;

    beforeEach(() => {
        // Reset puzzle mock
        vi.mocked(generatePuzzle).mockReset();

        // Mock self.postMessage
        mockPostMessage = vi.fn();

        // Create a mock self object
        vi.stubGlobal('self', {
            postMessage: mockPostMessage,
            onmessage: null
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Helper to load the worker and capture the message handler
    async function loadWorker() {
        // Clear the module cache to reload the worker
        vi.resetModules();

        // Re-mock after reset
        vi.doMock('../../js/puzzle.js', () => ({
            generatePuzzle: vi.fn()
        }));

        // Set up self before loading
        vi.stubGlobal('self', {
            postMessage: mockPostMessage,
            onmessage: null
        });

        // Import the worker module
        await import('../../js/worker.js');

        // Get the handler that was set
        messageHandler = self.onmessage;
    }

    it('generates puzzle and posts PUZZLE_GENERATED on success', async () => {
        await loadWorker();

        const mockPuzzle = { level: 1, grid: [[1]] };
        const { generatePuzzle: mockGenerate } = await import('../../js/puzzle.js');
        vi.mocked(mockGenerate).mockReturnValue(mockPuzzle);

        const event = {
            data: {
                type: 'GENERATE',
                config: { level: 1, rows: 5, cols: 5 },
                reqId: 12345
            }
        };

        messageHandler(event);

        expect(mockGenerate).toHaveBeenCalledWith({ level: 1, rows: 5, cols: 5 });
        expect(mockPostMessage).toHaveBeenCalledWith({
            type: 'PUZZLE_GENERATED',
            puzzle: mockPuzzle,
            reqId: 12345
        });
    });

    it('posts ERROR message when puzzle generation throws', async () => {
        await loadWorker();

        const { generatePuzzle: mockGenerate } = await import('../../js/puzzle.js');
        vi.mocked(mockGenerate).mockImplementation(() => {
            throw new Error('Generation failed');
        });

        const event = {
            data: {
                type: 'GENERATE',
                config: { level: 1 },
                reqId: 99999
            }
        };

        messageHandler(event);

        expect(mockPostMessage).toHaveBeenCalledWith({
            type: 'ERROR',
            error: 'Generation failed',
            reqId: 99999
        });
    });

    it('ignores messages with unknown type', async () => {
        await loadWorker();

        const event = {
            data: {
                type: 'UNKNOWN_TYPE',
                config: {},
                reqId: 11111
            }
        };

        messageHandler(event);

        expect(mockPostMessage).not.toHaveBeenCalled();
    });
});
