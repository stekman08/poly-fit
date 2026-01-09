import { test, expect } from './fixtures/coverage.js';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    await page.waitForFunction(() =>
        window.game &&
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

test('should use cached rects during drag (no layout thrashing)', async ({ page }) => {
    await startGame(page);

    // Instrument getBoundingClientRect to count calls on .piece elements
    const callCounts = await page.evaluate(() => {
        return new Promise(async resolve => {
            let callCount = 0;
            const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function() {
                if (this.classList?.contains('piece')) {
                    callCount++;
                }
                return originalGetBoundingClientRect.call(this);
            };

            const pieceEl = document.querySelector('.piece');
            const rect = pieceEl.getBoundingClientRect();
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height / 2;

            // Simulate mousedown to start drag
            const mouseDown = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: startX,
                clientY: startY
            });
            document.querySelector('#game-container').dispatchEvent(mouseDown);

            // Reset counter after initial pickup (which is allowed to call getBoundingClientRect)
            callCount = 0;

            // Simulate 30 move events (like a drag)
            for (let i = 0; i < 30; i++) {
                const mouseMove = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: startX,
                    clientY: startY - i * 5
                });
                window.dispatchEvent(mouseMove);
                await new Promise(r => setTimeout(r, 16)); // ~60fps
            }

            // End drag
            const mouseUp = new MouseEvent('mouseup', {
                bubbles: true,
                clientX: startX,
                clientY: startY - 150
            });
            window.dispatchEvent(mouseUp);

            // Restore original
            Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;

            resolve({ callsDuringDrag: callCount });
        });
    });

    // With caching, we should have minimal calls during drag
    // Without caching, it would be 30 moves × number of pieces = 150+ calls
    // Allow some calls for edge cases, but should be much less than non-cached
    expect(callCounts.callsDuringDrag).toBeLessThan(15);
});
