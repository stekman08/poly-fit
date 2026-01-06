/**
 * Haptic feedback using Vibration API
 * Provides tactile feedback for piece interactions (Android only)
 */

class HapticManager {
    constructor() {
        this.enabled = true;
        this.supported = 'vibrate' in navigator;
    }

    vibrate(pattern) {
        if (!this.enabled || !this.supported) return;
        // navigator.vibrate() returns false on failure, doesn't throw
        navigator.vibrate(pattern);
    }

    vibrateRotate() {
        this.vibrate(12);
    }

    vibrateFlip() {
        this.vibrate([8, 30, 8]);
    }

    vibrateSnap() {
        this.vibrate(20);
    }

    vibrateWin() {
        this.vibrate([30, 50, 30, 50, 80]);
    }
}

export const haptics = new HapticManager();
