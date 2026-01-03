import { test, expect } from '@playwright/test';

test.describe('Practice Mode', () => {
    test('selecting level from level-select enters practice mode', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Go to level select and pick level 5
        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        const levelBtns = page.locator('.level-btn');
        await levelBtns.nth(4).click(); // Level 5

        await page.waitForFunction(() =>
            document.querySelector('#level-select-screen').classList.contains('hidden')
        );
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        // Verify we're on level 5
        const levelText = await page.locator('#level-display').textContent();
        expect(levelText).toContain('LEVEL 5');
    });

    test('winning in practice mode returns to start screen', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Enter practice mode via level select
        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        const levelBtns = page.locator('.level-btn');
        await levelBtns.nth(2).click(); // Level 3

        await page.waitForFunction(() =>
            document.querySelector('#level-select-screen').classList.contains('hidden')
        );
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        // Solve puzzle by placing each piece at its solution position
        await page.evaluate(() => {
            const game = window.game;
            game.pieces.forEach(piece => {
                game.updatePieceState(piece.id, {
                    x: piece.solutionX,
                    y: piece.solutionY,
                    rotation: piece.effectiveRotation,
                    flipped: piece.effectiveFlipped
                });
            });
        });

        // Trigger win check
        await page.evaluate(() => window.triggerCheckWin());

        // Wait for win sequence and return to start screen (takes ~2-3 seconds)
        await page.waitForSelector('#start-screen:not(.hidden)', { timeout: 6000 });

        // Verify we're back at start screen
        const startScreen = page.locator('#start-screen');
        await expect(startScreen).not.toHaveClass(/hidden/);
    });

    test('practice mode does not advance maxLevel', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '5');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Enter practice mode at level 3
        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        const levelBtns = page.locator('.level-btn');
        await levelBtns.nth(2).click(); // Level 3

        await page.waitForFunction(() =>
            document.querySelector('#level-select-screen').classList.contains('hidden')
        );
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        // Solve puzzle
        await page.evaluate(() => {
            const game = window.game;
            game.pieces.forEach(piece => {
                game.updatePieceState(piece.id, {
                    x: piece.solutionX,
                    y: piece.solutionY,
                    rotation: piece.effectiveRotation,
                    flipped: piece.effectiveFlipped
                });
            });
        });

        // Trigger win
        await page.evaluate(() => window.triggerCheckWin());

        // Wait for return to start screen
        await page.waitForSelector('#start-screen:not(.hidden)', { timeout: 6000 });

        // maxLevel should still be 5 (not advanced)
        const maxLevel = await page.evaluate(() =>
            localStorage.getItem('polyfit-max-level')
        );
        expect(maxLevel).toBe('5');
    });
});
