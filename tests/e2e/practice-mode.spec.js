import { test, expect } from './fixtures/coverage.js';

test.describe('Level Select Gameplay', () => {
    test('selecting level from level-select starts that level', async ({ page }) => {
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

    test('winning from level select advances to next level', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Enter via level select at level 3
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

        // Wait for win sequence and advancement to level 4
        await page.waitForFunction(() => {
            const levelDisplay = document.querySelector('#level-display');
            return levelDisplay && levelDisplay.textContent.includes('LEVEL 4');
        }, { timeout: 6000 });

        // Verify we're on level 4 (not back at start screen)
        const levelText = await page.locator('#level-display').textContent();
        expect(levelText).toContain('LEVEL 4');

        const startScreen = page.locator('#start-screen');
        await expect(startScreen).toHaveClass(/hidden/);
    });

    test('winning below maxLevel does not change maxLevel', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Enter at level 3 (below maxLevel of 10)
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

        // Wait for level to advance
        await page.waitForFunction(() => {
            const levelDisplay = document.querySelector('#level-display');
            return levelDisplay && levelDisplay.textContent.includes('LEVEL 4');
        }, { timeout: 6000 });

        // maxLevel should still be 10 (not changed since we were below it)
        const maxLevel = await page.evaluate(() =>
            localStorage.getItem('polyfit-max-level')
        );
        expect(maxLevel).toBe('10');
    });

    test('winning at maxLevel advances maxLevel', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '5');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        // Enter at level 5 (equals maxLevel)
        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        const levelBtns = page.locator('.level-btn');
        await levelBtns.nth(4).click(); // Level 5

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

        // Wait for level to advance to 6
        await page.waitForFunction(() => {
            const levelDisplay = document.querySelector('#level-display');
            return levelDisplay && levelDisplay.textContent.includes('LEVEL 6');
        }, { timeout: 6000 });

        // maxLevel should now be 6 (advanced because we beat the current max)
        const maxLevel = await page.evaluate(() =>
            localStorage.getItem('polyfit-max-level')
        );
        expect(maxLevel).toBe('6');
    });
});
