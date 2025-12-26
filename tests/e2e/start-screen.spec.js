import { test, expect } from '@playwright/test';

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
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

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

        const maxLevel = await page.evaluate(() => {
            return localStorage.getItem('polyfit-max-level');
        });
        expect(maxLevel).toBe('10');
    });
});
