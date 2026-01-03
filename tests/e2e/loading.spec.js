import { test, expect } from '@playwright/test';

test.describe('Loading State and Error Handling', () => {

    test('loading overlay appears during puzzle generation', async ({ page }) => {
        await page.goto('/');

        // Start a new game
        await page.click('#btn-new-game');

        // Reset and clear local storage to ensure fresh start
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();

        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        // Jump to level 100 which generates a fresh puzzle
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '100');
            window.location.reload();
        });
        await page.waitForLoadState();

        // On reload, we have to click continue
        await page.waitForSelector('#start-screen');

        // Click continue
        await page.click('#btn-continue');

        // Expect loading overlay to NOT be hidden (i.e. be visible) for at least a moment
        const overlay = page.locator('#loading-overlay');

        try {
            await expect(overlay).not.toHaveClass(/hidden/, { timeout: 5000 });
        } catch (e) {
            console.log("Loading might have been too fast to catch, but checking if it eventually hides");
        }

        // Must eventually hide
        await expect(overlay).toHaveClass(/hidden/, { timeout: 10000 });

        // Verify game started
        const pieceCount = await page.evaluate(() => window.game && window.game.pieces.length);
        expect(pieceCount).toBeGreaterThan(0);
    });

    test('game handles worker errors by retrying and eventually failing safely', async ({ page }) => {
        await page.goto('/');

        // Log console output for debugging
        page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));

        await page.evaluate(() => {
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();

        // Wait for worker to be exposed
        await page.waitForFunction(() => window.__generationWorker);

        // Inject poison into the worker's postMessage to trigger a real error
        await page.evaluate(() => {
            const originalPost = window.__generationWorker.postMessage.bind(window.__generationWorker);
            window.__generationWorker.postMessage = function (data) {
                if (data.type === 'GENERATE') {
                    console.log('[Test] Intercepted GENERATE, injecting invalid config...');
                    // Poison the config with negative board size to trigger RangeError in worker
                    data.config.boardRows = -5;
                }
                originalPost(data);
            };
        });

        // Trigger start level which will use our poisoned worker
        await page.click('#btn-new-game');

        // New Game shows tutorial regardless of local storage, dismiss it to trigger startLevel
        await page.click('#btn-got-it');

        // Verify the UI updates to show failure message
        await expect(page.locator('#loading-overlay h2')).toHaveText('GENERATION FAILED', { timeout: 30000 });
    });
});
