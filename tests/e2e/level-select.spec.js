import { test, expect } from '@playwright/test';

test.describe('Level Select', () => {
    test('level select button hidden when no progress', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#start-screen');

        const levelSelectBtn = page.locator('#btn-level-select');
        await expect(levelSelectBtn).toHaveClass(/hidden/);
    });

    test('level select button visible when maxLevel > 1', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '5'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        const levelSelectBtn = page.locator('#btn-level-select');
        await expect(levelSelectBtn).not.toHaveClass(/hidden/);
    });

    test('level select shows grid of levels', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '10'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        // Should have level buttons
        const levelBtns = page.locator('.level-btn');
        const count = await levelBtns.count();
        expect(count).toBeGreaterThanOrEqual(10);

        // First 10 should be unlocked, rest locked
        for (let i = 0; i < 10; i++) {
            await expect(levelBtns.nth(i)).not.toHaveClass(/locked/);
        }
        await expect(levelBtns.nth(10)).toHaveClass(/locked/);
    });

    test('back button returns to start screen', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '5'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        await page.click('#btn-back');

        const startScreen = page.locator('#start-screen');
        await expect(startScreen).not.toHaveClass(/hidden/);
    });

    test('selecting level starts that level in practice mode', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '10');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-level-select');
        await page.waitForSelector('#level-select-screen:not(.hidden)');

        // Click level 7 (7th button, 0-indexed = 6)
        const levelBtns = page.locator('.level-btn');
        await levelBtns.nth(6).click();

        // Level select should be hidden, game should be running
        await page.waitForFunction(() =>
            document.querySelector('#level-select-screen').classList.contains('hidden')
        );
        const levelText = await page.locator('#level-display').textContent();
        expect(levelText).toContain('LEVEL 7');
    });
});
