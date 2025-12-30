import { describe, it, expect } from 'vitest';
import { getShapeDimensions } from '../../js/shapes.js';
import { isValidPlacement } from '../../js/validation.js';

describe('Bug fixes', () => {
    describe('Empty shape handling', () => {
        it('getShapeDimensions returns 0x0 for empty shape', () => {
            const dims = getShapeDimensions([]);
            expect(dims.width).toBe(0);
            expect(dims.height).toBe(0);
        });

        it('getShapeDimensions returns 0x0 for null shape', () => {
            const dims = getShapeDimensions(null);
            expect(dims.width).toBe(0);
            expect(dims.height).toBe(0);
        });

        it('getShapeDimensions returns 0x0 for undefined shape', () => {
            const dims = getShapeDimensions(undefined);
            expect(dims.width).toBe(0);
            expect(dims.height).toBe(0);
        });

        it('code using getShapeDimensions should handle 0 width gracefully', () => {
            const dims = getShapeDimensions([]);
            // This simulates the check in input.js:119
            // if (x < 0 || x + pieceW > boardCols)
            const x = 0;
            const boardCols = 5;
            const pieceW = dims.width; // 0

            // With pieceW = 0, this check becomes: 0 + 0 > 5 = false
            // So an empty piece at x=0 would pass bounds check
            // This is technically correct but we should reject empty pieces earlier
            expect(pieceW).toBe(0);
            expect(x + pieceW > boardCols).toBe(false);
        });
    });

    describe('Validation bypass - pieces below board', () => {
        const grid = [
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
        ];
        const shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; // Domino

        it('rejects piece partially on board and below', () => {
            // Piece at y=4 with height 1 extends into y=4 (on board) only
            // But if placed at y=5, it would be entirely below
            const result = isValidPlacement(shape, 0, 4, grid, []);
            expect(result).toBe(true); // This is valid - on board

            // Piece spanning board edge (y=4) and below (y=5)
            const verticalShape = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
            const spanning = isValidPlacement(verticalShape, 0, 4, grid, []);
            expect(spanning).toBe(false); // Should reject - spans board and dock
        });

        it('should reject piece entirely below board (BUG: currently passes)', () => {
            // Piece at y=10 is entirely below the 5-row board
            // Current bug: hasBlockOnBoard=false, hasBlockBelowBoard=true
            // The check `if (hasBlockOnBoard && hasBlockBelowBoard)` is false
            // So it returns true, which is WRONG
            const result = isValidPlacement(shape, 0, 10, grid, []);
            // This SHOULD be false, but current implementation returns true
            // After fix, this should be false
            expect(result).toBe(false);
        });

        it('should reject piece entirely above board', () => {
            // Piece at y=-5 is entirely above the board
            const result = isValidPlacement(shape, 0, -5, grid, []);
            // Pieces above board should also be rejected for board placement
            expect(result).toBe(false);
        });
    });
});
