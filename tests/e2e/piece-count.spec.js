import { test, expect } from '@playwright/test';

test.describe('Piece Count by Level', () => {
    test('level 1-3 has 3 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '3');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(3);
    });

    test('level 4-14 has 4 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '7');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(4);
    });

    test('level 15-49 has 5 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '25');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(5);
    });

    test('level 50+ has 6 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '50');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(6);
    });

    test('level 100 still has 6 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '100');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(6);
    });
});
