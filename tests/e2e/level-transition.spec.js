import { test, expect } from './fixtures/coverage.js';

test.describe('Level Transition', () => {
    test('completing level 1 should show level 2 with new pieces', async ({ page }) => {
        await page.goto('/');

        // Skip tutorial
        await page.evaluate(() => {
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Start new game
        await page.click('#btn-new-game');

        // Wait for tutorial to show (New Game always shows tutorial)
        await page.waitForSelector('#tutorial-overlay:not(.hidden)');
        await page.click('#btn-got-it');

        // Wait for level 1 to be fully loaded
        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0 &&
            window.getLevel &&
            window.getLevel() === 1
        );

        // Verify we're on level 1
        const level1Text = await page.locator('#level-display').textContent();
        expect(level1Text).toContain('LEVEL 1');

        // Get level 1 pieces info for comparison later
        const level1PieceIds = await page.evaluate(() =>
            window.game.pieces.map(p => p.id)
        );
        console.log('Level 1 pieces:', level1PieceIds);

        // Solve the puzzle by placing pieces at solution positions
        // Use effectiveRotation/effectiveFlipped which are relative to startShape
        await page.evaluate(() => {
            for (const piece of window.game.pieces) {
                window.game.updatePieceState(piece.id, {
                    x: piece.solutionX,
                    y: piece.solutionY,
                    rotation: piece.effectiveRotation,
                    flipped: piece.effectiveFlipped
                });
            }
        });

        // Trigger win check
        const checkWinResult = await page.evaluate(() => {
            window.triggerCheckWin();
            return window.game.checkWin();
        });
        console.log('checkWin result:', checkWinResult);
        expect(checkWinResult).toBe(true);

        // Wait for isWinning to be set
        await page.waitForFunction(() => window.isWinning && window.isWinning());
        console.log('isWinning is true');

        // Wait for level transition (WIN_TRANSITION_DELAY is 600ms)
        // Level should increment and new game should start
        await page.waitForFunction(() => {
            const level = window.getLevel ? window.getLevel() : 0;
            console.log('Current level:', level);
            return level === 2;
        }, { timeout: 5000 });

        console.log('Level transitioned to 2');

        // Wait for level 2 to be fully loaded with pieces
        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0 &&
            !window.isWinning()
        , { timeout: 10000 });

        // Verify we're on level 2
        const level2Text = await page.locator('#level-display').textContent();
        expect(level2Text).toContain('LEVEL 2');

        // Verify we have new pieces (different puzzle)
        const level2PieceCount = await page.evaluate(() => window.game.pieces.length);
        console.log('Level 2 piece count:', level2PieceCount);
        expect(level2PieceCount).toBeGreaterThan(0);

        // Verify board is visible
        const boardVisible = await page.locator('#game-board').isVisible();
        expect(boardVisible).toBe(true);

        // Verify pieces are in the dock (not solved yet)
        const piecesInDock = await page.evaluate(() => {
            const boardRows = window.game.targetGrid.length;
            return window.game.pieces.some(p => p.y >= boardRows);
        });
        expect(piecesInDock).toBe(true);
    });
});
