/**
 * Unit tests for input-utils.js
 * Pure function tests - no DOM mocking required
 */

import { describe, it, expect } from 'vitest';
import {
    findTouchById,
    detectGesture,
    calculateSnapPosition,
    findNearestPosition,
    pointToRectDistance,
    screenToGrid,
    calculateGridDelta
} from '../../js/input-utils.js';

describe('findTouchById', () => {
    it('returns null for null id', () => {
        const touchList = [{ identifier: 1 }, { identifier: 2 }];
        expect(findTouchById(touchList, null)).toBeNull();
    });

    it('finds touch by identifier', () => {
        const touch1 = { identifier: 1, clientX: 100 };
        const touch2 = { identifier: 2, clientX: 200 };
        const touchList = [touch1, touch2];
        touchList.length = 2; // Mimic TouchList

        expect(findTouchById(touchList, 1)).toBe(touch1);
        expect(findTouchById(touchList, 2)).toBe(touch2);
    });

    it('returns null if touch not found', () => {
        const touchList = [{ identifier: 1 }];
        touchList.length = 1;
        expect(findTouchById(touchList, 99)).toBeNull();
    });

    it('handles empty touch list', () => {
        const touchList = [];
        touchList.length = 0;
        expect(findTouchById(touchList, 1)).toBeNull();
    });
});

describe('detectGesture', () => {
    const config = {
        tapMaxDistance: 10,
        tapMaxDuration: 300,
        swipeMinDistance: 50,
        swipeMaxDuration: 200
    };

    it('detects tap: small distance, short duration', () => {
        expect(detectGesture(5, 100, config)).toBe('tap');
        expect(detectGesture(0, 50, config)).toBe('tap');
        expect(detectGesture(9, 299, config)).toBe('tap');
    });

    it('detects swipe: large distance, short duration', () => {
        expect(detectGesture(50, 100, config)).toBe('swipe');
        expect(detectGesture(100, 150, config)).toBe('swipe');
        expect(detectGesture(50, 199, config)).toBe('swipe');
    });

    it('detects drag: large distance, long duration', () => {
        expect(detectGesture(50, 300, config)).toBe('drag');
        expect(detectGesture(100, 500, config)).toBe('drag');
    });

    it('detects drag: medium distance beyond tap threshold', () => {
        expect(detectGesture(20, 400, config)).toBe('drag');
    });

    it('returns none for ambiguous cases', () => {
        // Small distance but too long for tap - no clear gesture
        expect(detectGesture(5, 500, config)).toBe('none');
    });

    it('swipe takes priority over drag', () => {
        // Fast movement = swipe even if distance is large
        expect(detectGesture(100, 50, config)).toBe('swipe');
    });
});

describe('calculateSnapPosition', () => {
    it('rounds to nearest grid position', () => {
        expect(calculateSnapPosition(1.4, 2.6, 1, 5)).toEqual({ x: 1, y: 3 });
        expect(calculateSnapPosition(0.5, 0.5, 1, 5)).toEqual({ x: 1, y: 1 });
        expect(calculateSnapPosition(0.4, 0.4, 1, 5)).toEqual({ x: 0, y: 0 });
    });

    it('clamps X to board boundaries', () => {
        // Piece of width 2 on 5-col board: max X = 3
        expect(calculateSnapPosition(10, 0, 2, 5)).toEqual({ x: 3, y: 0 });
        expect(calculateSnapPosition(-5, 0, 2, 5)).toEqual({ x: 0, y: 0 });
    });

    it('clamps Y to minimum 0', () => {
        expect(calculateSnapPosition(0, -5, 1, 5)).toEqual({ x: 0, y: 0 });
    });

    it('handles edge cases', () => {
        // Piece exactly at boundary
        expect(calculateSnapPosition(3, 0, 2, 5)).toEqual({ x: 3, y: 0 });
        // Single cell piece
        expect(calculateSnapPosition(4, 4, 1, 5)).toEqual({ x: 4, y: 4 });
    });
});

describe('findNearestPosition', () => {
    it('returns null for empty candidates', () => {
        expect(findNearestPosition([], 0, 0)).toBeNull();
        expect(findNearestPosition(null, 0, 0)).toBeNull();
    });

    it('finds nearest position', () => {
        const candidates = [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 2, y: 2 }
        ];
        const result = findNearestPosition(candidates, 1, 1);
        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
    });

    it('returns distance in result', () => {
        const candidates = [{ x: 3, y: 4 }];
        const result = findNearestPosition(candidates, 0, 0);
        expect(result.dist).toBeCloseTo(5); // 3-4-5 triangle
    });

    it('handles single candidate', () => {
        const candidates = [{ x: 10, y: 10 }];
        const result = findNearestPosition(candidates, 0, 0);
        expect(result.x).toBe(10);
        expect(result.y).toBe(10);
    });

    it('handles exact match', () => {
        const candidates = [{ x: 5, y: 5 }];
        const result = findNearestPosition(candidates, 5, 5);
        expect(result.dist).toBe(0);
    });
});

describe('pointToRectDistance', () => {
    const rect = { left: 10, right: 20, top: 10, bottom: 20 };

    it('returns 0 distance when point inside rect', () => {
        const result = pointToRectDistance(15, 15, rect);
        expect(result.distance).toBe(0);
        expect(result.inside).toBe(true);
    });

    it('calculates distance to left edge', () => {
        const result = pointToRectDistance(5, 15, rect);
        expect(result.distance).toBe(5);
        expect(result.inside).toBe(false);
    });

    it('calculates distance to corner', () => {
        // Point at (0, 0) to rect starting at (10, 10)
        const result = pointToRectDistance(0, 0, rect);
        expect(result.distance).toBeCloseTo(Math.sqrt(200)); // sqrt(10^2 + 10^2)
    });

    it('respects fat finger radius', () => {
        const result = pointToRectDistance(5, 15, rect, 10);
        expect(result.inside).toBe(true); // 5px away, 10px radius
    });

    it('point on edge is inside', () => {
        const result = pointToRectDistance(10, 15, rect);
        expect(result.distance).toBe(0);
        expect(result.inside).toBe(true);
    });
});

describe('screenToGrid', () => {
    it('converts screen position to grid', () => {
        const boardRect = { left: 100, top: 50 };
        const cellSize = 40;

        expect(screenToGrid(100, 50, boardRect, cellSize)).toEqual({ x: 0, y: 0 });
        expect(screenToGrid(140, 90, boardRect, cellSize)).toEqual({ x: 1, y: 1 });
        expect(screenToGrid(180, 130, boardRect, cellSize)).toEqual({ x: 2, y: 2 });
    });

    it('returns fractional positions during drag', () => {
        const boardRect = { left: 0, top: 0 };
        const cellSize = 100;

        const result = screenToGrid(150, 150, boardRect, cellSize);
        expect(result.x).toBe(1.5);
        expect(result.y).toBe(1.5);
    });

    it('handles negative positions (above/left of board)', () => {
        const boardRect = { left: 100, top: 100 };
        const cellSize = 50;

        const result = screenToGrid(50, 50, boardRect, cellSize);
        expect(result.x).toBe(-1);
        expect(result.y).toBe(-1);
    });
});

describe('calculateGridDelta', () => {
    it('calculates movement in grid units', () => {
        const cellSize = 40;
        const result = calculateGridDelta(100, 100, 180, 180, cellSize);
        expect(result.deltaX).toBe(2);
        expect(result.deltaY).toBe(2);
    });

    it('handles negative movement', () => {
        const cellSize = 50;
        const result = calculateGridDelta(200, 200, 100, 100, cellSize);
        expect(result.deltaX).toBe(-2);
        expect(result.deltaY).toBe(-2);
    });

    it('returns fractional delta during smooth drag', () => {
        const cellSize = 100;
        const result = calculateGridDelta(0, 0, 25, 75, cellSize);
        expect(result.deltaX).toBe(0.25);
        expect(result.deltaY).toBe(0.75);
    });

    it('returns zero for no movement', () => {
        const result = calculateGridDelta(100, 100, 100, 100, 50);
        expect(result.deltaX).toBe(0);
        expect(result.deltaY).toBe(0);
    });
});
