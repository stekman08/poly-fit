import { describe, it, expect, vi, afterEach } from 'vitest';
import { sounds } from '../../js/sounds.js';

describe('SoundManager', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        sounds.audioContext = null;
        sounds.enabled = true;
    });

    it('does not throw when AudioContext is unavailable', () => {
        // Arrange
        vi.stubGlobal('AudioContext', undefined);
        vi.stubGlobal('webkitAudioContext', undefined);

        // Act
        const act = () => sounds.playRotate();

        // Assert
        expect(act).not.toThrow();
    });
});
