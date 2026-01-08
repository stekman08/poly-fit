import { describe, it, expect } from 'vitest';
import { findEnclosedCells } from '../../js/renderer.js';

describe('findEnclosedCells', () => {
    it('detects single enclosed cell surrounded by targets', () => {
        // 1 1 1
        // 1 0 1
        // 1 1 1
        const grid = [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('1,1')).toBe(true);
        expect(enclosed.size).toBe(1);
    });

    it('does NOT mark edge empty cells as enclosed', () => {
        // 0 1 1
        // 1 1 1
        // 1 1 1
        const grid = [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('0,0')).toBe(false);
        expect(enclosed.size).toBe(0);
    });

    it('does NOT mark empty cells connected to edge as enclosed', () => {
        // 0 0 1
        // 1 0 1
        // 1 1 1
        // The middle cell (1,1) connects to edge via (0,1) -> (0,0)
        const grid = [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('0,0')).toBe(false);
        expect(enclosed.has('0,1')).toBe(false);
        expect(enclosed.has('1,1')).toBe(false);
        expect(enclosed.size).toBe(0);
    });

    it('detects multiple connected enclosed cells', () => {
        // 1 1 1 1
        // 1 0 0 1
        // 1 1 1 1
        const grid = [
            [1, 1, 1, 1],
            [1, 0, 0, 1],
            [1, 1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('1,1')).toBe(true);
        expect(enclosed.has('1,2')).toBe(true);
        expect(enclosed.size).toBe(2);
    });

    it('detects L-shaped enclosed region', () => {
        // 1 1 1 1
        // 1 0 1 1
        // 1 0 0 1
        // 1 1 1 1
        const grid = [
            [1, 1, 1, 1],
            [1, 0, 1, 1],
            [1, 0, 0, 1],
            [1, 1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('1,1')).toBe(true);
        expect(enclosed.has('2,1')).toBe(true);
        expect(enclosed.has('2,2')).toBe(true);
        expect(enclosed.size).toBe(3);
    });

    it('does NOT mark L-shaped region with path to edge as enclosed', () => {
        // 0 1 1 1
        // 0 1 1 1
        // 0 0 0 1
        // 1 1 1 1
        // All zeros connect to edge
        const grid = [
            [0, 1, 1, 1],
            [0, 1, 1, 1],
            [0, 0, 0, 1],
            [1, 1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.size).toBe(0);
    });

    it('handles OUTSIDE cells (-2) as passable for reachability', () => {
        // -2  1  1
        //  0  1  1
        //  1  1  1
        // The empty cell (1,0) connects to OUTSIDE (-2) at (0,0) which is at edge
        const grid = [
            [-2, 1, 1],
            [0, 1, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('1,0')).toBe(false);
        expect(enclosed.size).toBe(0);
    });

    it('handles explicit holes (-1) separately from empty cells', () => {
        // 1  1  1
        // 1 -1  1
        // 1  1  1
        // -1 is a hole, not an empty cell - should not be in enclosed set
        const grid = [
            [1, 1, 1],
            [1, -1, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        // -1 cells are not empty (0), so they shouldn't be in enclosed set
        expect(enclosed.has('1,1')).toBe(false);
        expect(enclosed.size).toBe(0);
    });

    it('detects enclosed cell even when grid has OUTSIDE cutouts', () => {
        // -2 -2  1  1
        //  1  1  1  1
        //  1  1  0  1
        //  1  1  1  1
        const grid = [
            [-2, -2, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 0, 1],
            [1, 1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('2,2')).toBe(true);
        expect(enclosed.size).toBe(1);
    });

    it('empty cell next to OUTSIDE that reaches edge is NOT enclosed', () => {
        // -2  0  1
        //  1  1  1
        //  1  1  1
        // (0,1) is empty, (0,0) is OUTSIDE at edge - so (0,1) can reach edge via OUTSIDE
        const grid = [
            [-2, 0, 1],
            [1, 1, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        expect(enclosed.has('0,1')).toBe(false);
        expect(enclosed.size).toBe(0);
    });

    it('handles complex irregular board shape', () => {
        // -2 -2  1  1 -2
        // -2  1  1  1 -2
        //  1  1  0  1  1
        //  1  1  1  1  1
        // -2 -2  1 -2 -2
        const grid = [
            [-2, -2, 1, 1, -2],
            [-2, 1, 1, 1, -2],
            [1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1],
            [-2, -2, 1, -2, -2]
        ];

        const enclosed = findEnclosedCells(grid);

        // The empty cell at (2,2) is surrounded by targets - enclosed
        expect(enclosed.has('2,2')).toBe(true);
        expect(enclosed.size).toBe(1);
    });

    it('handles empty grid edge (all zeros on one side)', () => {
        // 0 0 0
        // 1 1 1
        // 1 1 1
        const grid = [
            [0, 0, 0],
            [1, 1, 1],
            [1, 1, 1]
        ];

        const enclosed = findEnclosedCells(grid);

        // All zeros are on edge - none enclosed
        expect(enclosed.size).toBe(0);
    });
});
