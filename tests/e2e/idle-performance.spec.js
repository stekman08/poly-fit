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

test.describe('Idle Performance', () => {
    test('game loop should stop when idle', async ({ page }) => {
        await startGame(page);

        // Mark hint as shown to skip the 5-minute hint wait period
        // (the loop stays running while waiting for hint timer)
        await page.evaluate(() => {
            window.__hintShown = true;
        });

        // Wait for any initial rendering to complete and loop to stop
        await page.waitForTimeout(500);

        // Check if loop stopped after idle
        const loopStatus = await page.evaluate(() => {
            return new Promise(resolve => {
                // Wait 100ms and check if animationId is null
                setTimeout(() => {
                    resolve({
                        animationId: window.__animationId,
                        isNull: window.__animationId === null
                    });
                }, 100);
            });
        });

        expect(loopStatus.isNull).toBe(true);
    });

    test('game loop should resume on mouse interaction', async ({ page }) => {
        await startGame(page);

        await page.waitForTimeout(200); // Let loop stop

        // Get piece position and start dragging
        const pieceBox = await page.locator('.piece').first().boundingBox();
        await page.mouse.move(pieceBox.x + 20, pieceBox.y + 20);
        await page.mouse.down();

        const loopRunning = await page.evaluate(() => window.__animationId !== null);
        expect(loopRunning).toBe(true);

        await page.mouse.up();
    });
});
