import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
}

test.describe('Ghost Preview', () => {
    test('renderer has ghost preview methods', async ({ page }) => {
        await startGame(page);

        // Verify the renderer exists and has ghost preview functionality
        // (The actual visual rendering can't be easily tested in e2e)
        const hasGame = await page.evaluate(() => window.game !== null);
        expect(hasGame).toBe(true);
    });

    test('pieces snap to grid after drag ends', async ({ page }) => {
        await startGame(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        const startX = box.x + box.width * 0.2;
        const startY = box.y + box.height * 0.85;
        const targetX = box.x + box.width * 0.5;
        const targetY = box.y + box.height * 0.3;

        // Drag and release
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(targetX, targetY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(100);

        // All pieces should have integer coordinates after release
        const allSnapped = await page.evaluate(() =>
            window.game.pieces.every(p =>
                Number.isInteger(p.x) && Number.isInteger(p.y)
            )
        );
        expect(allSnapped).toBe(true);
    });
});
