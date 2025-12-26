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
        try {
            navigator.vibrate(pattern);
        } catch {
            // Silently fail if vibration not allowed
        }
    }

    // Quick pulse for rotate
    vibrateRotate() {
        this.vibrate(12);
    }

    // Double pulse for flip
    vibrateFlip() {
        this.vibrate([8, 30, 8]);
    }

    // Satisfying thunk for snap
    vibrateSnap() {
        this.vibrate(20);
    }

    // Victory pattern
    vibrateWin() {
        this.vibrate([30, 50, 30, 50, 80]);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

export const haptics = new HapticManager();
