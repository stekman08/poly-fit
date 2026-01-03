
import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../../js/config/difficulty.js';
import { generatePuzzle } from '../../js/puzzle.js';

describe('Global Stability Verification (0 - Infinity)', () => {

    function checkLevelStability(level, iterations = 5) {
        const params = getDifficultyParams(level);
        let failures = 0;

        for (let i = 0; i < iterations; i++) {
            try {
                generatePuzzle(params);
            } catch (e) {
                failures++;
            }
        }
        return {
            level,
            failures,
            rate: (failures / iterations) * 100,
            config: `${params.numPieces} pieces on ${params.boardRows}x${params.boardCols}`
        };
    }

    it('should have 0% failure rate across all difficulty tiers', () => {
        // Test key milestones and high levels
        const levels = [
            1,      // Intro
            50,     // 5 pieces start
            100,    // Extreme shapes start
            125,    // 6 pieces start (previously broken)
            175,    // Hard pieces dominate (previously broken)
            199,    // Peak 6-piece difficulty (previously broken)
            200,    // 7 pieces start
            300,    // High level
            500,    // Very high level
            1000    // "Infinite"
        ];

        console.log('\n--- GLOBAL STABILITY REPORT ---');
        console.log('Level | Failures | Rate | Config');
        console.log('------------------------------------------------');

        let totalFailures = 0;

        for (const level of levels) {
            const result = checkLevelStability(level);
            console.log(
                `${result.level.toString().padEnd(6)}| ` +
                `${result.failures.toString().padEnd(9)}| ` +
                `${result.rate.toFixed(0)}%   | ` +
                `${result.config}`
            );
            totalFailures += result.failures;

            // Assert 0 failures for every level
            expect(result.failures).toBe(0);
        }
        console.log('------------------------------------------------\n');
        expect(totalFailures).toBe(0);
    }, 30000);
});
