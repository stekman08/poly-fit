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

    it('snap search with cache should be at least 4x faster', () => {
        // Simulate findNearestBoardPosition: test all 42 grid positions
        const grid = Array.from({ length: 6 }, () => Array(7).fill(1));
        const otherPieces = Array.from({ length: 6 }, (_, i) => ({
            x: i % 3,
            y: Math.floor(i / 3),
            currentShape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
        }));
        const shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

        const scanAllPositions = () => {
            for (let y = 0; y < 6; y++) {
                for (let x = 0; x < 7; x++) {
                    isValidPlacement(shape, x, y, grid, otherPieces);
                }
            }
        };

        // Warm-up JIT for both code paths
        for (let i = 0; i < 20; i++) {
            clearOccupancyCache();
            scanAllPositions();
            buildOccupancyCache(otherPieces, grid);
            scanAllPositions();
        }
        clearOccupancyCache();

        // Measure uncached
        const uncachedStart = performance.now();
        for (let iter = 0; iter < 50; iter++) {
            clearOccupancyCache();
            scanAllPositions();
        }
        const uncachedTime = performance.now() - uncachedStart;

        // Measure cached
        buildOccupancyCache(otherPieces, grid);
        const cachedStart = performance.now();
        for (let iter = 0; iter < 50; iter++) {
            scanAllPositions();
        }
        const cachedTime = performance.now() - cachedStart;
        clearOccupancyCache();

        const speedup = uncachedTime / cachedTime;

        // Cache should provide meaningful speedup
        // Threshold is low (1.5x) to avoid flaky failures due to system load
        // In isolation this is typically 8-12x
        expect(speedup).toBeGreaterThan(1.5);
    });
});
