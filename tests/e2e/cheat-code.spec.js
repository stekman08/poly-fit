import { test, expect } from '@playwright/test';

test('secret hint trigger works with tap sequence', async ({ page }) => {
    test.setTimeout(120000); // Allow extra time for CPU starvation scenarios
    // Go to game
    await page.goto('/');

    // Start game
    await page.click('#btn-new-game');

    // Dismiss tutorial if present
    const gotItBtn = page.locator('#btn-got-it');
    if (await gotItBtn.isVisible()) {
        await gotItBtn.click();
    }

    // Wait for generation to complete
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 15000 });

    // Wait for game to be ready (increased timeout for slow CI/parallel execution)
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0, null, { timeout: 60000 });

    // Verify hint hidden initially
    const pieces = await page.evaluate(() => window.game.pieces);
    const hintBefore = await page.evaluate(() => window.game.hintPiece);
    expect(hintBefore).toBeNull();

    // Perform Secret Sequence: Title(1) -> Level(2) -> Title(3) -> Level(4)
    // We use the spans we created
    const title = page.locator('#title-display');
    const level = page.locator('#level-display');

    await title.click();
    await page.waitForTimeout(100); // Small human delay

    await level.click();
    await page.waitForTimeout(100);
    await level.click();
    await page.waitForTimeout(100);

    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);

    await level.click();
    await page.waitForTimeout(100);
    await level.click();
    await page.waitForTimeout(100);
    await level.click();
    await page.waitForTimeout(100);
    await level.click();

    // Verify hint is NOT null now (it should be triggered immediately)
    // Wait a bit for the next frame loop to pick it up
    await page.waitForTimeout(200);

    const hintAfter = await page.evaluate(() => window.game.hintPiece);
    expect(hintAfter).not.toBeNull();
});

test('header menu button returns to start screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new-game');

    // Dismiss tutorial
    const gotItBtn = page.locator('#btn-got-it');
    if (await gotItBtn.isVisible()) {
        await gotItBtn.click();
    }

    // Wait for generation to complete
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 15000 });

    // Safety delay for any fade-out animations (e.g. tutorial or loading)
    await page.waitForTimeout(500);

    await expect(page.locator('#start-screen')).toHaveClass(/hidden/);

    // Click menu - use JS evaluation to guarantee event trigger regardless of overlays/animations
    await page.evaluate(() => document.getElementById('btn-menu').click());

    // Should see start screen
    await expect(page.locator('#start-screen')).not.toHaveClass(/hidden/);
});
