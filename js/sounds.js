
/**
 * Sound effects using Web Audio API
 * Generates synth sounds that fit the neon aesthetic
 */

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    // Lazy init audio context (must be after user interaction)
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended (mobile browsers)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Quick blip for rotate
    playRotate() {
        if (!this.enabled) return;
        this.init();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, this.audioContext.currentTime + 0.05);

        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.08);
    }

    // Lower blip for flip
    playFlip() {
        if (!this.enabled) return;
        this.init();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.12);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.12);
    }

    // Satisfying snap sound
    playSnap() {
        if (!this.enabled) return;
        this.init();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.06);

        gain.gain.setValueAtTime(0.12, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.08);
    }

    // Victory fanfare - ascending arpeggio
    playWin() {
        if (!this.enabled) return;
        this.init();

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const duration = 0.15;

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.type = 'sine';
            const startTime = this.audioContext.currentTime + i * duration;

            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration + 0.1);

            osc.start(startTime);
            osc.stop(startTime + duration + 0.15);
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Singleton
export const sounds = new SoundManager();
