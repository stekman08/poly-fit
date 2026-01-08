import { describe, it, expect } from 'vitest';
import { countSolutions } from '../../js/solver.js';
import { SHAPES } from '../../js/shapes.js';

describe('Solver - countSolutions', () => {
    it('should find solutions for a domino puzzle', () => {
        const grid = [
            [1, 1],
            [0, 0]
        ];

        const pieces = [{
            originalShape: SHAPES.Domino,
            shapeName: 'Domino'
        }];

        const count = countSolutions(grid, pieces, 10);
        expect(count).toBeGreaterThan(0);
    });

    it('should find multiple solutions for symmetric puzzle', () => {
        const grid = [
            [1, 1],
            [1, 1]
        ];

        const pieces = [
            { originalShape: SHAPES.Domino, shapeName: 'Domino' },
            { originalShape: SHAPES.Domino, shapeName: 'Domino' }
        ];

        const count = countSolutions(grid, pieces, 20);
        expect(count).toBeGreaterThan(1);
    });

    it('should return 0 for unsolvable puzzle', () => {
        const grid = [
            [1, 1, 1],
            [0, 0, 0]
        ];

        const pieces = [{
            originalShape: SHAPES.Square,
            shapeName: 'Square'
        }];

        const count = countSolutions(grid, pieces, 10);
        expect(count).toBe(0);
    });

    it('should respect the limit parameter', () => {
        const grid = [
            [1, 1, 1],
            [1, 1, 1]
        ];

        const pieces = [
            { originalShape: SHAPES.Line3, shapeName: 'Line3' },
            { originalShape: SHAPES.Line3, shapeName: 'Line3' }
        ];

        const count = countSolutions(grid, pieces, 1);
        expect(count).toBeLessThanOrEqual(1);
    });

    it('should handle L-shaped pieces correctly', () => {
        const grid = [
            [1, 1],
            [1, 0],
            [1, 0]
        ];

        const pieces = [{
            originalShape: SHAPES.L,
            shapeName: 'L'
        }];

        const count = countSolutions(grid, pieces, 10);
        expect(count).toBeGreaterThan(0);
    });
});
