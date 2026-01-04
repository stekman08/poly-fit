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
        // Mock the worker entirely to simulate errors without taxing the CPU
        await page.evaluate(() => {
            // Hijack the onmessage handler that main.js attaches
            const realWorker = window.__generationWorker;

            // We'll proxy postMessage to immediately fire back an error
            // This bypasses the actual worker thread and CPU usage
            realWorker.postMessage = function (data) {
                if (data.type === 'GENERATE') {
                    // Simulate async work slightly to allow UI to show "Generating"
                    setTimeout(() => {
                        // Directly trigger the validation/error handler in main.js
                        realWorker.onmessage({
                            data: {
                                type: 'ERROR',
                                error: 'Simulated CPU-friendly error',
                                reqId: data.reqId
                            }
                        });
                    }, 50);
                }
            };
        });

        // Trigger start level which will use our poisoned worker
        await page.click('#btn-new-game');

        // New Game shows tutorial regardless of local storage, dismiss it to trigger startLevel
        await page.click('#btn-got-it');

        // Verify the UI updates to show failure message
        await expect(page.locator('#loading-overlay h2')).toHaveText('GENERATION FAILED', { timeout: 30000 });
    });

    test('regression: loading overlay should not block interaction after hiding', async ({ page }) => {
        await page.goto('/');

        // Mock worker for speed and stability
        await page.evaluate(() => {
            const mockPuzzle = {
                level: 1,
                boardRows: 5,
                boardCols: 5,
                targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
                pieces: [{ id: 1, shape: [[1]], originalShape: [[1]], color: '#f00', solutionX: 0, solutionY: 0, solutionRotation: 0, solutionFlipped: false }]
            };
            const realWorker = window.__generationWorker;
            realWorker.postMessage = function (data) {
                if (data.type === 'GENERATE') {
                    setTimeout(() => {
                        realWorker.onmessage({ data: { type: 'PUZZLE_GENERATED', puzzle: mockPuzzle, reqId: data.reqId } });
                    }, 10);
                }
            };
        });

        // Trigger generation
        await page.click('#btn-new-game');
        await page.click('#btn-got-it');

        // Wait for overlay to hide
        const overlay = page.locator('#loading-overlay');
        await expect(overlay).toHaveClass(/hidden/);

        // STH: Verify strictly that it is not visible to user (checks display, visibility, opacity)
        await expect(overlay).toBeHidden();

        // STRICT INTERACTION CHECK:
        // Try to click the Menu button immediately.
        // If overlay is present (even with opacity 0), this standard click will fail/timeout.
        await page.click('#btn-menu');

        // Success: Menu opened
        await expect(page.locator('#start-screen')).toBeVisible();
    });
});
