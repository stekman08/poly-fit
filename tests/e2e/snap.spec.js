import { test, expect } from './fixtures/coverage.js';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    // New Game always shows tutorial - dismiss it
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    // Wait for game to be fully initialized
    await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);
}

test('snap logic validation', async ({ page }) => {
    await startGame(page);
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // Get dock and board geometry
    const dock = page.locator('#piece-dock');
    const dockBox = await dock.boundingBox();
    const board = page.locator('#game-board');
    const boardBox = await board.boundingBox();
    if (!dockBox || !boardBox) throw new Error("No dock or board");

    // Get piece info directly
    const initialPieceY = await page.evaluate(() => {
        return window.game.pieces[0].y;
    });

    // Drag from dock toward top of board (likely invalid placement)
    const startX = dockBox.x + (dockBox.width * 0.5);
    const startY = dockBox.y + (dockBox.height * 0.5);

    const targetX = boardBox.x + (boardBox.width * 0.5);
    const targetY = boardBox.y + 10; // Near top edge

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Check new position - piece should snap back to dock if invalid
    const finalPieceY = await page.evaluate(() => {
        return window.game.pieces[0].y;
    });

    expect(finalPieceY).toBe(initialPieceY);
});
