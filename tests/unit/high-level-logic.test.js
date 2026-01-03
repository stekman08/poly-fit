
import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../../js/config/difficulty.js';
import { generatePuzzle } from '../../js/puzzle.js';

describe('High Level Stability', () => {
    it('Level 300 should generate puzzle without error', () => {
        const params = getDifficultyParams(300);

        // Check params
        expect(params.numPieces).toBe(7);
        // Verify board size is large enough (>= 42 cells)
        expect(params.boardRows * params.boardCols).toBeGreaterThanOrEqual(42);

        // Attempt generation (should not throw)
        let success = false;
        try {
            const puzzle = generatePuzzle(params);
            expect(puzzle.pieces.length).toBe(7);
            success = true;
        } catch (e) {
            console.error('Generation failed:', e);
        }

        expect(success).toBe(true);
    });

    // Stress test
    it('STRESS: Generate 5 puzzles at level 500', () => {
        const params = getDifficultyParams(500);
        let failures = 0;

        for (let i = 0; i < 5; i++) {
            try {
                generatePuzzle(params);
            } catch (e) {
                console.error(`Failure at iteration ${i}`, e);
                failures++;
            }
        }

        expect(failures).toBe(0);
    }, 30000); // Increased timeout for slow high-level generation matches
});
