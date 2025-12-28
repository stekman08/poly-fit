import { test, expect } from '@playwright/test';

/**
 * Tests for piece count at different levels based on difficulty curve:
 * - Level 1-14: 3 pieces
 * - Level 15-49: 4 pieces
 * - Level 50-124: 5 pieces
 * - Level 125-199: 6 pieces
 * - Level 200+: 7 pieces
 */
test.describe('Piece Count by Level', () => {
    test('level 1-14 has 3 pieces', async ({ page }) => {
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
        expect(pieceCount).toBe(3);
    });

    test('level 15-49 has 4 pieces', async ({ page }) => {
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
        expect(pieceCount).toBe(4);
    });

    test('level 50-124 has 5 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '75');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(5);
    });

    test('level 125-199 has 6 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '150');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(6);
    });

    test('level 200+ has 7 pieces', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '200');
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const pieceCount = await page.evaluate(() => window.game.pieces.length);
        expect(pieceCount).toBe(7);
    });
});
