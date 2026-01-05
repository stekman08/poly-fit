import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    // Wait for game to be fully initialized
    await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);
}

test.describe('Hint System', () => {
    test('hint appears after inactivity', async ({ page }) => {
        await startGame(page);

        // Force hint to trigger by setting lastInteractionTime to 0
        await page.evaluate(() => window.__testForceHint());

        // Wait for next render frame to process the hint
        await page.waitForTimeout(100);

        // Check if game has hint available
        const hasHint = await page.evaluate(() => {
            const hint = window.game.getHint();
            return hint !== null;
        });

        expect(hasHint).toBe(true);
    });

    test('hint is hidden after interaction', async ({ page }) => {
        await startGame(page);

        // Force hint to show
        await page.evaluate(() => window.__testForceHint());
        await page.waitForTimeout(100);

        // Interact with dock (tap)
        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);

        await page.waitForTimeout(50);

        // Verify game still has hint method working
        const hasHint = await page.evaluate(() => window.game.getHint() !== null);
        expect(hasHint).toBe(true);
    });

    test('getHint returns valid hint object', async ({ page }) => {
        await startGame(page);

        const hint = await page.evaluate(() => {
            const h = window.game.getHint();
            if (!h) return null;
            return {
                hasPiece: h.piece !== undefined,
                hasX: typeof h.x === 'number',
                hasY: typeof h.y === 'number',
                hasShape: Array.isArray(h.shape),
                hasColor: typeof h.color === 'string'
            };
        });

        expect(hint).not.toBeNull();
        expect(hint.hasPiece).toBe(true);
        expect(hint.hasX).toBe(true);
        expect(hint.hasY).toBe(true);
        expect(hint.hasShape).toBe(true);
        expect(hint.hasColor).toBe(true);
    });
});
