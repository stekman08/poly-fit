import { describe, it, expect } from 'vitest';
import { isValidPlacement } from '../../js/validation.js';

describe('isValidPlacement - overlap detection', () => {
    const grid5x5 = [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
    ];

    const square = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
    ];

    const otherPieces = [
        { x: 0, y: 0, currentShape: square }
    ];

    it('rejects placement that overlaps another piece', () => {
        const result = isValidPlacement(square, 1, 0, grid5x5, otherPieces);
        expect(result).toBe(false);
    });

    it('accepts placement that does not overlap', () => {
        const result = isValidPlacement(square, 3, 0, grid5x5, otherPieces);
        expect(result).toBe(true);
    });
});

describe('isValidPlacement', () => {
    const grid5x5 = [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 0, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
    ];

    const verticalLine = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
    ];

    it('rejects piece partially below board', () => {
        const result = isValidPlacement(verticalLine, 0, 4, grid5x5);
        expect(result).toBe(false);
    });

    it('accepts piece fully on valid target spots', () => {
        const result = isValidPlacement(verticalLine, 0, 0, grid5x5);
        expect(result).toBe(true);
    });

    it('rejects piece on wall (0 in grid)', () => {
        const result = isValidPlacement(verticalLine, 2, 1, grid5x5);
        expect(result).toBe(false);
    });

    it('rejects piece fully in dock area (triggers dock placement)', () => {
        // Pieces in dock area are outside the board, so isValidPlacement returns false
        // This is correct - it triggers the dock placement logic in input.js
        const result = isValidPlacement(verticalLine, 0, 6, grid5x5);
        expect(result).toBe(false);
    });

    it('rejects piece horizontally outside board', () => {
        const result = isValidPlacement(verticalLine, -1, 0, grid5x5);
        expect(result).toBe(false);
    });

    it('rejects piece at bottom edge extending below', () => {
        const lShape = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
        ];
        const result = isValidPlacement(lShape, 0, 4, grid5x5);
        expect(result).toBe(false);
    });
});
