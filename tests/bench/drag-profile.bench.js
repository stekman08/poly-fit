import { bench, describe } from 'vitest';
import { getShapeDimensions } from '../../js/shapes.js';
import { isValidPlacement, buildOccupancyCache, clearOccupancyCache } from '../../js/validation.js';

describe('Level 360 Drag Profiling - 7 pieces, last piece being dragged', () => {
    // Setup: 7x6 board, 7 pieces (6 placed + 1 being dragged)
    const grid = Array.from({ length: 6 }, () => Array(7).fill(1));
    const pieces = Array.from({ length: 7 }, (_, i) => ({
        id: i,
        x: i % 3,
        y: Math.floor(i / 3),
        rotation: i % 4,
        flipped: i % 2 === 0,
        color: ['#00E5FF', '#F92672', '#A6E22E'][i % 3],
        currentShape: [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
            { x: 0, y: 1 }, { x: 1, y: 1 }
        ] // 5-block pentomino
    }));

    bench('getShapeDimensions x7 pieces x60 frames (1 sec @ 60fps)', () => {
        for (let frame = 0; frame < 60; frame++) {
            for (const p of pieces) {
                getShapeDimensions(p.currentShape);
            }
        }
    });

    bench('shapeSignature calculation x7 x60 (current renderer cost)', () => {
        for (let frame = 0; frame < 60; frame++) {
            for (const p of pieces) {
                const shape = p.currentShape;
                const dims = getShapeDimensions(shape);
                // This is exactly what renderer.js:272 does
                const sig = `${dims.width}x${dims.height}:${shape.map(b => `${b.x},${b.y}`).sort().join(';')}:${p.color}`;
            }
        }
    });

    bench('BASELINE: simple cache key x7 x60 (proposed fix)', () => {
        for (let frame = 0; frame < 60; frame++) {
            for (const p of pieces) {
                // Simple key based on piece state - no map/sort/join
                const key = `${p.id}:${p.rotation}:${p.flipped}:${p.color}`;
            }
        }
    });

    bench('isValidPlacement with cache x60 frames', () => {
        const otherPieces = pieces.slice(0, 6);
        const draggedShape = pieces[6].currentShape;
        buildOccupancyCache(otherPieces, grid);
        for (let frame = 0; frame < 60; frame++) {
            isValidPlacement(draggedShape, 3, 2, grid, otherPieces);
        }
        clearOccupancyCache();
    });
});

describe('Renderer updatePieceShape comparison', () => {
    const piece = {
        id: 0,
        rotation: 2,
        flipped: true,
        color: '#F92672',
        currentShape: [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
            { x: 0, y: 1 }, { x: 1, y: 1 }
        ]
    };

    bench('current: expensive signature + style writes (per piece)', () => {
        const mockEl = { style: {}, dataset: {} };
        const shape = piece.currentShape;
        const dims = getShapeDimensions(shape);
        const shapeSignature = `${dims.width}x${dims.height}:${shape.map(b => `${b.x},${b.y}`).sort().join(';')}:${piece.color}`;

        // Style writes that happen BEFORE cache check
        mockEl.style.display = 'grid';
        mockEl.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        mockEl.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        mockEl.style.width = `calc(var(--cell-size) * ${dims.width})`;
        mockEl.style.height = `calc(var(--cell-size) * ${dims.height})`;
        mockEl.style.color = piece.color;

        // Then cache check (too late!)
        if (mockEl.dataset.shapeSignature === shapeSignature) {
            return;
        }
    });

    bench('proposed: fast cache key check first (per piece)', () => {
        const mockEl = { style: {}, dataset: { cacheKey: '0:2:true:#F92672' } };

        // Fast check FIRST
        const cacheKey = `${piece.id}:${piece.rotation}:${piece.flipped}:${piece.color}`;
        if (mockEl.dataset.cacheKey === cacheKey) {
            return; // Early exit - skip everything
        }
    });
});
