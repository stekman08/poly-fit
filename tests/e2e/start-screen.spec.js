import { test, expect } from './fixtures/coverage.js';

test.describe('Start Screen', () => {
    test('shows start screen on load', async ({ page }) => {
        await page.goto('/');
        const startScreen = page.locator('#start-screen');
        await expect(startScreen).toBeVisible();
    });

    test('New Game button starts at level 1', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        // New Game always shows tutorial - dismiss it
        await page.click('#btn-got-it');
        await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        const levelText = await page.locator('#level-display').textContent();
        expect(levelText).toContain('LEVEL 1');
    });

    test('Continue button hidden when no saved progress', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#start-screen');

        const continueBtn = page.locator('#btn-continue');
        await expect(continueBtn).toHaveClass(/hidden/);
    });

    test('Continue button shows saved level', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '5');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        const continueBtn = page.locator('#btn-continue');
        await expect(continueBtn).not.toHaveClass(/hidden/);
        await expect(continueBtn).toContainText('Level 5');
    });

    test('Continue button starts at saved level', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '3');
            localStorage.setItem('polyfit-tutorial-shown', '3'); // Skip tutorial
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        const levelText = await page.locator('#level-display').textContent();
        expect(levelText).toContain('LEVEL 3');
    });

    test('New Game does not reset max level', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        // New Game shows tutorial - dismiss it
        await page.click('#btn-got-it');
        await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));

        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        const maxLevel = await page.evaluate(() => {
            return localStorage.getItem('polyfit-max-level');
        });
        expect(maxLevel).toBe('10');
    });

    test('URL parameter ?level=XXX sets progress', async ({ page }) => {
        // Clear any existing progress
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());

        // Navigate with level parameter
        await page.goto('/?level=42');
        await page.waitForSelector('#start-screen');

        // Should have saved maxLevel to localStorage
        const maxLevel = await page.evaluate(() => localStorage.getItem('polyfit-max-level'));
        expect(maxLevel).toBe('42');

        // Continue button should show level 42
        const continueBtn = page.locator('#btn-continue');
        await expect(continueBtn).toContainText('Level 42');

        // URL should be cleaned (no ?level=42)
        expect(page.url()).not.toContain('level=');
    });
});
