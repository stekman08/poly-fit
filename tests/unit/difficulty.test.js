import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../../js/config/difficulty.js';

describe('Difficulty Curve', () => {
    describe('Piece count progression', () => {
        it('should use 3 pieces for levels 1-14', () => {
            for (const level of [1, 7, 14]) {
                const params = getDifficultyParams(level);
                expect(params.numPieces).toBe(3);
            }
        });

        it('should use 4 pieces for levels 15-49', () => {
            for (const level of [15, 30, 49]) {
                const params = getDifficultyParams(level);
                expect(params.numPieces).toBe(4);
            }
        });

        it('should use 5 pieces for levels 50-124', () => {
            for (const level of [50, 75, 100, 124]) {
                const params = getDifficultyParams(level);
                expect(params.numPieces).toBe(5);
            }
        });

        it('should use 6 pieces for levels 125-199', () => {
            for (const level of [125, 150, 175, 199]) {
                const params = getDifficultyParams(level);
                expect(params.numPieces).toBe(6);
            }
        });

        it('should use 7 pieces for levels 200+', () => {
            for (const level of [200, 300, 500]) {
                const params = getDifficultyParams(level);
                expect(params.numPieces).toBe(7);
            }
        });
    });

    describe('Board dimensions', () => {
        it('should have sufficient cells for piece count', () => {
            const testLevels = [1, 15, 50, 100, 125, 175, 200, 300];

            for (const level of testLevels) {
                const params = getDifficultyParams(level);
                const cells = params.boardRows * params.boardCols;
                const minCells = params.numPieces * 3;

                expect(cells).toBeGreaterThanOrEqual(minCells);
            }
        });

        it('should use larger boards for 6+ pieces', () => {
            for (let i = 0; i < 10; i++) {
                const params = getDifficultyParams(125);
                const cells = params.boardRows * params.boardCols;
                expect(cells).toBeGreaterThanOrEqual(30);
            }
        });

        it('should use large boards for 7 pieces', () => {
            for (let i = 0; i < 10; i++) {
                const params = getDifficultyParams(200);
                const cells = params.boardRows * params.boardCols;
                expect(cells).toBeGreaterThanOrEqual(35);
            }
        });
    });

    describe('Parameter consistency', () => {
        it('should return all required parameters', () => {
            const params = getDifficultyParams(100);

            expect(params).toHaveProperty('numPieces');
            expect(params).toHaveProperty('boardRows');
            expect(params).toHaveProperty('boardCols');
            expect(params).toHaveProperty('numHoles');
            expect(params).toHaveProperty('asymmetricBias');
        });

        it('should have numHoles >= 0', () => {
            for (const level of [1, 50, 100, 200]) {
                const params = getDifficultyParams(level);
                expect(params.numHoles).toBeGreaterThanOrEqual(0);
            }
        });

        it('should have asymmetricBias between 0 and 1', () => {
            for (const level of [1, 50, 100, 200]) {
                const params = getDifficultyParams(level);
                expect(params.asymmetricBias).toBeGreaterThanOrEqual(0);
                expect(params.asymmetricBias).toBeLessThanOrEqual(1);
            }
        });
    });
});
