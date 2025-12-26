import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    // Skip tutorial in tests
    await page.evaluate(() => localStorage.setItem('polyfit-tutorial-shown', '3'));
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
}

test('snap logic validation', async ({ page }) => {
    await startGame(page);
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Get canvas geometry
    const box = await canvas.boundingBox();
    if (!box) throw new Error("No canvas");

    // Get piece info directly
    const initialPieceY = await page.evaluate(() => {
        return window.game.pieces[0].y;
    });

    const width = box.width;
    const height = box.height;

    // Drag Piece 0
    const startX = box.x + (width * 0.2);
    const startY = box.y + (height * 0.9);

    const targetX = box.x + (width * 0.5);
    const targetY = box.y + (height * 0.1);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Check new position
    const finalPieceY = await page.evaluate(() => {
        return window.game.pieces[0].y;
    });

    expect(finalPieceY).toBe(initialPieceY);
});
