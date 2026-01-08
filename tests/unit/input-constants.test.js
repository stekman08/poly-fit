import { describe, it, expect } from 'vitest';
import {
    TAP_MAX_DISTANCE,
    TAP_MAX_DURATION,
    SWIPE_MIN_DISTANCE,
    SWIPE_MAX_DURATION,
    FAT_FINGER_RADIUS,
    TOUCH_MOUSE_DEBOUNCE
} from '../../js/config/constants.js';

describe('Input Constants', () => {
    describe('Tap gesture thresholds', () => {
        it('should have reasonable TAP_MAX_DISTANCE', () => {
            expect(TAP_MAX_DISTANCE).toBeGreaterThan(0);
            expect(TAP_MAX_DISTANCE).toBeLessThanOrEqual(20);
        });

        it('should have reasonable TAP_MAX_DURATION', () => {
            expect(TAP_MAX_DURATION).toBeGreaterThan(100);
            expect(TAP_MAX_DURATION).toBeLessThanOrEqual(500);
        });
    });

    describe('Swipe gesture thresholds', () => {
        it('should have SWIPE_MIN_DISTANCE > TAP_MAX_DISTANCE', () => {
            expect(SWIPE_MIN_DISTANCE).toBeGreaterThan(TAP_MAX_DISTANCE);
        });

        it('should have reasonable SWIPE_MAX_DURATION', () => {
            expect(SWIPE_MAX_DURATION).toBeGreaterThan(100);
            expect(SWIPE_MAX_DURATION).toBeLessThanOrEqual(500);
        });
    });

    describe('Touch handling', () => {
        it('should have FAT_FINGER_RADIUS for touch tolerance', () => {
            expect(FAT_FINGER_RADIUS).toBeGreaterThan(20);
            expect(FAT_FINGER_RADIUS).toBeLessThanOrEqual(100);
        });

        it('should have TOUCH_MOUSE_DEBOUNCE to prevent double events', () => {
            expect(TOUCH_MOUSE_DEBOUNCE).toBeGreaterThan(100);
            expect(TOUCH_MOUSE_DEBOUNCE).toBeLessThanOrEqual(1000);
        });
    });

    describe('Gesture hierarchy', () => {
        it('should distinguish tap from swipe by distance', () => {
            expect(SWIPE_MIN_DISTANCE).toBeGreaterThan(TAP_MAX_DISTANCE * 2);
        });
    });
});
