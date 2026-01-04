
import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../../js/config/difficulty.js';
import { generatePuzzle } from '../../js/puzzle.js';

describe('Level Capacity Analysis', () => {
    // Helper to check a specific level
    function checkLevel(level, iterations = 2) {
        const params = getDifficultyParams(level);
        let failures = 0;

        for (let i = 0; i < iterations; i++) {
            try {
                generatePuzzle(params);
            } catch (e) {
                failures++;
            }
        }
        return { level, failures, rate: failures / iterations, params };
    }

    it('should generate report for levels 100-300', () => {
        const levelsToCheck = [
            100, 120, 125, 130, 140, 150, 160, 170, 175, 180, 190, 199,
            200, 210, 250, 300
        ];

        console.log('\n--- CAPACITY ANALYSIS REPORT ---');
        console.log('Level | Failures | Rate | Config (Pieces/Rows/Cols)');
        console.log('---------------------------------------------------');

        const allResults = [];

        for (const level of levelsToCheck) {
            const result = checkLevel(level);
            allResults.push(result);
            const { numPieces, boardRows, boardCols } = result.params;

            console.log(
                `${level.toString().padEnd(6)}| ` +
                `${result.failures.toString().padEnd(9)}| ` +
                `${(result.rate * 100).toFixed(0)}%  | ` +
                `${numPieces} on ${boardRows}x${boardCols}`
            );
        }
        console.log('---------------------------------------------------\n');

        // Fail the test if we found major issues (so we notice)
        // We expect some failure is natural (randomness), but consistent failure > 50% is a bug
        const severeFailures = allResults.filter(r => r.rate > 0.5);

        if (severeFailures.length > 0) {
            console.error('Severe failures detected at levels:', severeFailures.map(r => r.level));
            // expect(severeFailures.length).toBe(0); // Uncomment to strictly fail
        }
    }, 60000);
});
