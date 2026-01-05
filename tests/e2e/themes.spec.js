import { test, expect } from '@playwright/test';

test.describe('Color Themes', () => {
    test('tapping title cycles theme color', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#start-screen');

        // Get initial color (cyan)
        const initialColor = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
        );
        expect(initialColor).toBe('#00E5FF');

        // Tap title
        const title = page.locator('.start-modal .neon-text');
        await title.click();

        // Color should change to magenta
        const newColor = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
        );
        expect(newColor).toBe('#F92672');
    });

    test('theme persists in localStorage', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#start-screen');

        // Tap title twice to get to green
        const title = page.locator('.start-modal .neon-text');
        await title.click();
        await title.click();

        const savedTheme = await page.evaluate(() =>
            localStorage.getItem('polyfit-theme')
        );
        expect(savedTheme).toBe('green');
    });

    test('theme loads from localStorage on reload', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-theme', 'orange'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        const color = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
        );
        expect(color).toBe('#FD971F');
    });

    test('theme cycles through all 4 colors', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('polyfit-theme'));
        await page.reload();
        await page.waitForSelector('#start-screen');

        const title = page.locator('.start-modal .neon-text');
        const expectedColors = ['#F92672', '#A6E22E', '#FD971F', '#00E5FF'];

        for (const expected of expectedColors) {
            await title.click();
            const color = await page.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
            );
            expect(color).toBe(expected);
        }
    });
});
