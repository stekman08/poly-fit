
import { describe, it, expect } from 'vitest';
import { rotateShape, flipShape, normalizeShape, getShapeDimensions, SHAPES } from '../../js/shapes.js';

describe('Shape Transformations', () => {
    // Define a simple L-shape:
    // [0,0], [0,1], [0,2], [1,2]
    // |
    // |
    // L
    const lShape = [
        {x: 0, y: 0},
        {x: 0, y: 1},
        {x: 0, y: 2},
        {x: 1, y: 2}
    ];

    it('should rotate a shape 90 degrees clockwise', () => {
        // Rotated L-shape (lying down):
        // (x,y) -> (-y, x)
        // 0,0 -> 0,0
        // 0,1 -> -1,0
        // 0,2 -> -2,0
        // 1,2 -> -2,1
        const rotated = rotateShape(lShape);

        // We expect the coordinates to change.
        // Note: The actual coordinates might be negative, 'normalizeShape' fixes that for drawing,
        // but let's test the raw rotation math first.
        const expected = [
            {x: 0, y: 0},
            {x: -1, y: 0},
            {x: -2, y: 0},
            {x: -2, y: 1}
        ];

        // Allow for any order of points
        expect(rotated).toEqual(expect.arrayContaining(expected));
        expect(rotated.length).toBe(4);
    });

    it('should flip a shape horizontally', () => {
        // Flipped L-shape:
        // (x,y) -> (-x, y)
        // 0,0 -> 0,0
        // 0,1 -> 0,1
        // 0,2 -> 0,2
        // 1,2 -> -1,2
        const flipped = flipShape(lShape);
        const expected = [
            {x: 0, y: 0},
            {x: 0, y: 1},
            {x: 0, y: 2},
            {x: -1, y: 2}
        ];
        expect(flipped).toEqual(expect.arrayContaining(expected));
    });

    it('should normalize coordinates to be zero-based', () => {
        // Create a shape with negative coordinates
        const shape = [{x: -2, y: 5}, {x: -1, y: 5}];
        const normalized = normalizeShape(shape);

        // Min X is -2, Min Y is 5.
        // Subtract Min X (-2) -> Add 2 to X
        // Subtract Min Y (5) -> Subtract 5 from Y
        const expected = [
            {x: 0, y: 0},
            {x: 1, y: 0}
        ];
        expect(normalized).toEqual(expect.arrayContaining(expected));
    });
});

describe('Shape Definitions', () => {
    it('should have correct block counts for all shapes', () => {
        expect(SHAPES.Domino.length).toBe(2);
        expect(SHAPES.Line3.length).toBe(3);
        expect(SHAPES.Corner3.length).toBe(3);
        expect(SHAPES.T.length).toBe(4);
        expect(SHAPES.L.length).toBe(4);
        expect(SHAPES.S.length).toBe(4);
        expect(SHAPES.Square.length).toBe(4);
        expect(SHAPES.Line4.length).toBe(4);
        expect(SHAPES.C.length).toBe(5);
        expect(SHAPES.P.length).toBe(5);
        expect(SHAPES.L5.length).toBe(5);
        expect(SHAPES.W.length).toBe(5);
        expect(SHAPES.Y.length).toBe(5);
    });

    it('W pentomino should form staircase pattern', () => {
        // W shape:
        // ■ ■
        //   ■
        //   ■ ■
        const w = normalizeShape(SHAPES.W);
        expect(w).toContainEqual({ x: 0, y: 0 });
        expect(w).toContainEqual({ x: 1, y: 0 });
        expect(w).toContainEqual({ x: 1, y: 1 });
        expect(w).toContainEqual({ x: 1, y: 2 });
        expect(w).toContainEqual({ x: 2, y: 2 });
    });

    it('Y pentomino should form T with tail pattern', () => {
        // Y shape:
        // ■
        // ■ ■
        // ■
        // ■
        const y = normalizeShape(SHAPES.Y);
        expect(y).toContainEqual({ x: 0, y: 0 });
        expect(y).toContainEqual({ x: 0, y: 1 });
        expect(y).toContainEqual({ x: 1, y: 1 });
        expect(y).toContainEqual({ x: 0, y: 2 });
        expect(y).toContainEqual({ x: 0, y: 3 });
    });
});

describe('getShapeDimensions', () => {
    it('should return correct dimensions for a shape', () => {
        const lShape = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 1, y: 2 }
        ];
        const dims = getShapeDimensions(lShape);
        expect(dims.width).toBe(2);
        expect(dims.height).toBe(3);
    });

    it('should return 0 dimensions for empty shape', () => {
        const dims = getShapeDimensions([]);
        expect(dims.width).toBe(0);
        expect(dims.height).toBe(0);
    });

    it('should return 0 dimensions for null/undefined', () => {
        expect(getShapeDimensions(null)).toEqual({ width: 0, height: 0 });
        expect(getShapeDimensions(undefined)).toEqual({ width: 0, height: 0 });
    });

    it('should handle single block shape', () => {
        const dims = getShapeDimensions([{ x: 0, y: 0 }]);
        expect(dims.width).toBe(1);
        expect(dims.height).toBe(1);
    });

    it('should handle line shapes correctly', () => {
        // Vertical line
        const vertical = getShapeDimensions(SHAPES.Line4);
        expect(vertical.width).toBe(1);
        expect(vertical.height).toBe(4);

        // Horizontal line (after rotation)
        const horizontal = getShapeDimensions(normalizeShape(rotateShape(SHAPES.Line4)));
        expect(horizontal.width).toBe(4);
        expect(horizontal.height).toBe(1);
    });
});
