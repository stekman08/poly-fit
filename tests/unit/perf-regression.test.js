import { describe, it, expect } from 'vitest';
import { isValidPlacement, buildOccupancyCache, clearOccupancyCache } from '../../js/validation.js';

describe('Performance regression guard', () => {
    it('cached validation should be at least 5x faster than uncached', () => {
        // Simulate level 360: 7x6 board, 6 pieces already placed
        const grid = Array.from({ length: 6 }, () => Array(7).fill(1));
        const otherPieces = Array.from({ length: 6 }, (_, i) => ({
            x: i % 3,
            y: Math.floor(i / 3),
            currentShape: [
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
                { x: 0, y: 1 }, { x: 1, y: 1 }
            ] // 5-block pentomino
        }));
        const shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

        // Measure uncached (clear cache before each call)
        const uncachedStart = performance.now();
        for (let i = 0; i < 1000; i++) {
            clearOccupancyCache();
            isValidPlacement(shape, 3, 2, grid, otherPieces);
        }
        const uncachedTime = performance.now() - uncachedStart;

        // Measure cached (build once, reuse)
        buildOccupancyCache(otherPieces, grid);
        const cachedStart = performance.now();
        for (let i = 0; i < 1000; i++) {
            isValidPlacement(shape, 3, 2, grid, otherPieces);
        }
        const cachedTime = performance.now() - cachedStart;
        clearOccupancyCache();

        const speedup = uncachedTime / cachedTime;

        // Cache should provide at least 5x speedup
        // If this test fails, someone broke the caching mechanism!
        expect(speedup).toBeGreaterThan(5);
    });

    it('snap search with cache should be at least 8x faster', () => {
        // Simulate findNearestBoardPosition: test all 42 grid positions
        const grid = Array.from({ length: 6 }, () => Array(7).fill(1));
        const otherPieces = Array.from({ length: 6 }, (_, i) => ({
            x: i % 3,
            y: Math.floor(i / 3),
            currentShape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
        }));
        const shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

        // Uncached: rebuild Set for each position
        const uncachedStart = performance.now();
        for (let iter = 0; iter < 100; iter++) {
            clearOccupancyCache();
            for (let y = 0; y < 6; y++) {
                for (let x = 0; x < 7; x++) {
                    isValidPlacement(shape, x, y, grid, otherPieces);
                }
            }
        }
        const uncachedTime = performance.now() - uncachedStart;

        // Cached: build once, reuse for all positions
        const cachedStart = performance.now();
        for (let iter = 0; iter < 100; iter++) {
            buildOccupancyCache(otherPieces, grid);
            for (let y = 0; y < 6; y++) {
                for (let x = 0; x < 7; x++) {
                    isValidPlacement(shape, x, y, grid, otherPieces);
                }
            }
            clearOccupancyCache();
        }
        const cachedTime = performance.now() - cachedStart;

        const speedup = uncachedTime / cachedTime;

        // Snap search should be at least 8x faster with cache
        expect(speedup).toBeGreaterThan(8);
    });
});
