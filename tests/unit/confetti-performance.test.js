import { describe, it, expect } from 'vitest';
import { ConfettiSystem } from '../../js/effects/Confetti.js';

describe('Confetti Performance', () => {
    it('should NOT use shadowBlur (expensive on mobile)', () => {
        const confetti = new ConfettiSystem();
        confetti.burst(100, 100, 10);

        // Mock canvas context to check what operations are called
        const operations = [];
        const mockCtx = {
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            fillRect: () => {},
            fillStyle: '',
            globalAlpha: 1,
            // Track if shadowBlur is set
            set shadowBlur(val) { operations.push({ op: 'shadowBlur', val }); },
            set shadowColor(val) { operations.push({ op: 'shadowColor', val }); },
        };

        confetti.draw(mockCtx);

        // Verify NO shadowBlur operations
        const shadowOps = operations.filter(o => o.op === 'shadowBlur');
        expect(shadowOps.length).toBe(0);
    });

    it('should complete 100 particle updates in under 5ms', () => {
        const confetti = new ConfettiSystem();
        confetti.burst(100, 100, 100);

        const start = performance.now();
        for (let i = 0; i < 60; i++) { // Simulate 1 second at 60fps
            confetti.update();
        }
        const elapsed = performance.now() - start;

        // 60 frames of updates should take < 5ms total (plenty of headroom)
        expect(elapsed).toBeLessThan(5);
    });
});
