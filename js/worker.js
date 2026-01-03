import { generatePuzzle } from './puzzle.js';

self.onmessage = function (e) {
    const { type, config, reqId } = e.data;

    if (type === 'GENERATE') {
        try {
            // Generate the puzzle with the provided configuration
            const puzzle = generatePuzzle(config);

            // Send back the result
            self.postMessage({
                type: 'PUZZLE_GENERATED',
                puzzle,
                reqId
            });
        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                error: error.message,
                reqId
            });
        }
    }
};
