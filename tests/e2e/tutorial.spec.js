import { test, expect } from '@playwright/test';

test.describe('Tutorial', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Clear tutorial shown counter
        await page.evaluate(() => localStorage.removeItem('polyfit-tutorial-shown'));
        await page.reload();
    });

    test('shows tutorial on first game start', async ({ page }) => {
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');

        // Tutorial should be visible
        const tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);
    });

    test('tutorial displays all three mechanics', async ({ page }) => {
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');

        // Check all tutorial items are visible
        const tutorialItems = page.locator('.tutorial-item');
        await expect(tutorialItems).toHaveCount(3);

        // Check content
        await expect(page.locator('.tutorial-text strong').nth(0)).toContainText('DRAG');
        await expect(page.locator('.tutorial-text strong').nth(1)).toContainText('TAP');
        await expect(page.locator('.tutorial-text strong').nth(2)).toContainText('SWIPE');
    });

    test('clicking GOT IT dismisses tutorial and starts game', async ({ page }) => {
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');

        // Tutorial visible
        const tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);

        // Click GOT IT
        await page.click('#btn-got-it');

        // Tutorial hidden
        await expect(tutorial).toHaveClass(/hidden/);

        // Game should be running (game object exists)
        const gameExists = await page.evaluate(() => window.game !== null);
        expect(gameExists).toBe(true);
    });

    test('tutorial shows exactly 3 times', async ({ page }) => {
        // First time
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        let tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);
        await page.click('#btn-got-it');

        // Second time
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);
        await page.click('#btn-got-it');

        // Third time
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);
        await page.click('#btn-got-it');

        // Fourth time - should NOT show
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).toHaveClass(/hidden/);
    });

    test('tutorial counter persists in localStorage', async ({ page }) => {
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.click('#btn-got-it');

        const count = await page.evaluate(() =>
            parseInt(localStorage.getItem('polyfit-tutorial-shown') || '0', 10)
        );
        expect(count).toBe(1);
    });

    test('tutorial shows on Continue as well', async ({ page }) => {
        // Set up a saved level
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '5'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-continue');

        // Tutorial should be visible
        const tutorial = page.locator('#tutorial-overlay');
        await expect(tutorial).not.toHaveClass(/hidden/);
    });
});
