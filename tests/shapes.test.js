
import { describe, it, expect } from 'vitest';
import { rotateShape, flipShape, normalizeShape } from '../js/shapes.js';

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
