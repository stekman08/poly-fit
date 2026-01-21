import { test, expect } from './fixtures/coverage.js';

test('secret hint trigger works with tap sequence', async ({ page }) => {
    test.setTimeout(120000); // Allow extra time for CPU starvation scenarios
    // Go to game
    await page.goto('/');

    // Start game
    // Start game
    // Inject mock worker logic to prevent CPU starvation timeouts
    // Wait for worker to be available to avoid race condition
    await page.waitForFunction(() => window.__generationWorker);

    await page.evaluate(() => {
        const mockPuzzle = {
            level: 1,
            boardRows: 5,
            boardCols: 5,
            targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
            pieces: [{
                id: 1,
                shape: [[1]],
                originalShape: [[1]],
                color: '#ff0000',
                solutionX: 0,
                solutionY: 0,
                solutionRotation: 0,
                solutionFlipped: false
            }]
        };

        // Hijack the onmessage handler
        const realWorker = window.__generationWorker;
        const originalPost = realWorker.postMessage.bind(realWorker);

        realWorker.postMessage = function (data) {
            if (data.type === 'GENERATE') {
                console.log('[Test] Mocking puzzle generation');
                // Instant success response
                setTimeout(() => {
                    realWorker.onmessage({
                        data: {
                            type: 'PUZZLE_GENERATED',
                            puzzle: mockPuzzle,
                            reqId: data.reqId
                        }
                    });
                }, 10);
            } else {
                originalPost(data);
            }
        };
    });

    // Start game - this triggers the tutorial
    await page.click('#btn-new-game');

    // Dismiss tutorial - mandatory wait and click because new-game ALWAYS shows it
    await page.click('#btn-got-it');

    // Wait for generation to complete (should be instant now)
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 10000 });

    // Wait for game to be ready
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0);

    // Verify hint hidden initially
    const pieces = await page.evaluate(() => window.game.pieces);
    const hintBefore = await page.evaluate(() => window.game.hintPiece);
    expect(hintBefore).toBeNull();

    // Perform Secret Sequence: 5x TITLE tap
    const title = page.locator('#title-display');

    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();

    // Verify hint is NOT null now (it should be triggered immediately)
    // Wait a bit for the next frame loop to pick it up
    await page.waitForTimeout(200);

    const hintAfter = await page.evaluate(() => window.game.hintPiece);
    expect(hintAfter).not.toBeNull();
});

test('cheat code works after wrong first tap (LEVEL)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');

    await page.waitForFunction(() => window.__generationWorker);

    await page.evaluate(() => {
        const mockPuzzle = {
            level: 1,
            boardRows: 5,
            boardCols: 5,
            targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
            pieces: [{
                id: 1,
                shape: [[1]],
                originalShape: [[1]],
                color: '#ff0000',
                solutionX: 0,
                solutionY: 0,
                solutionRotation: 0,
                solutionFlipped: false
            }]
        };

        const realWorker = window.__generationWorker;
        realWorker.postMessage = function (data) {
            if (data.type === 'GENERATE') {
                setTimeout(() => {
                    realWorker.onmessage({
                        data: { type: 'PUZZLE_GENERATED', puzzle: mockPuzzle, reqId: data.reqId }
                    });
                }, 10);
            }
        };
    });

    await page.click('#btn-new-game');
    await page.click('#btn-got-it');
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 10000 });
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0);

    const title = page.locator('#title-display');
    const level = page.locator('#level-display');

    // Wrong first tap (LEVEL) - should reset
    await level.click();
    await page.waitForTimeout(100);

    // Now do correct sequence: 5x TITLE
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();

    await page.waitForTimeout(200);
    const hintAfter = await page.evaluate(() => window.game.hintPiece);
    expect(hintAfter).not.toBeNull();
});

test('cheat code works after LEVEL reset mid-sequence', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');

    await page.waitForFunction(() => window.__generationWorker);

    await page.evaluate(() => {
        const mockPuzzle = {
            level: 1,
            boardRows: 5,
            boardCols: 5,
            targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
            pieces: [{
                id: 1,
                shape: [[1]],
                originalShape: [[1]],
                color: '#ff0000',
                solutionX: 0,
                solutionY: 0,
                solutionRotation: 0,
                solutionFlipped: false
            }]
        };

        const realWorker = window.__generationWorker;
        realWorker.postMessage = function (data) {
            if (data.type === 'GENERATE') {
                setTimeout(() => {
                    realWorker.onmessage({
                        data: { type: 'PUZZLE_GENERATED', puzzle: mockPuzzle, reqId: data.reqId }
                    });
                }, 10);
            }
        };
    });

    await page.click('#btn-new-game');
    await page.click('#btn-got-it');
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 10000 });
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0);

    const title = page.locator('#title-display');
    const level = page.locator('#level-display');

    // Start sequence correctly
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);

    // Tap LEVEL mid-sequence - this should reset
    await level.click();
    await page.waitForTimeout(100);

    // Restart from beginning: 5x TITLE
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();

    await page.waitForTimeout(200);
    const hintAfter = await page.evaluate(() => window.game.hintPiece);
    expect(hintAfter).not.toBeNull();
});

test('header menu button returns to start screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new-game');

    // Dismiss tutorial
    await page.click('#btn-got-it');

    // Wait for generation to complete
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 15000 });

    // Safety delay for any fade-out animations (e.g. tutorial or loading)
    await page.waitForTimeout(500);

    await expect(page.locator('#start-screen')).toHaveClass(/hidden/);

    // Click menu - standard click to verify element is reachable and actionable
    await page.click('#btn-menu');

    // Should see start screen
    await expect(page.locator('#start-screen')).not.toHaveClass(/hidden/);
});

test('cheat code can be triggered multiple times in same session', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');

    await page.waitForFunction(() => window.__generationWorker);

    await page.evaluate(() => {
        const mockPuzzle = {
            level: 1,
            boardRows: 5,
            boardCols: 5,
            targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
            pieces: [{
                id: 1,
                shape: [[1]],
                originalShape: [[1]],
                color: '#ff0000',
                solutionX: 0,
                solutionY: 0,
                solutionRotation: 0,
                solutionFlipped: false
            }]
        };

        const realWorker = window.__generationWorker;
        realWorker.postMessage = function (data) {
            if (data.type === 'GENERATE') {
                setTimeout(() => {
                    realWorker.onmessage({
                        data: { type: 'PUZZLE_GENERATED', puzzle: mockPuzzle, reqId: data.reqId }
                    });
                }, 10);
            }
        };
    });

    await page.click('#btn-new-game');
    await page.click('#btn-got-it');
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 10000 });
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0);

    const title = page.locator('#title-display');

    // Track hint triggers
    let hintTriggerCount = 0;
    page.evaluate(() => {
        window.__hintTriggerCount = 0;
        const originalShowHint = window.renderer.showHint.bind(window.renderer);
        window.renderer.showHint = function (...args) {
            window.__hintTriggerCount++;
            return originalShowHint(...args);
        };
    });

    // First trigger: 5x TITLE
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(200);

    hintTriggerCount = await page.evaluate(() => window.__hintTriggerCount);
    expect(hintTriggerCount).toBe(1);

    // Hide hint by moving piece to reset hintShown state
    await page.click('.piece');
    await page.waitForTimeout(100);

    // Second trigger: 5x TITLE
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(200);

    hintTriggerCount = await page.evaluate(() => window.__hintTriggerCount);
    expect(hintTriggerCount).toBe(2);
});

test('cheat code prevents duplicate listeners via data-cheat-listener attribute', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');

    await page.waitForFunction(() => window.__generationWorker);

    await page.evaluate(() => {
        const mockPuzzle = {
            level: 1,
            boardRows: 5,
            boardCols: 5,
            targetGrid: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
            pieces: [{
                id: 1,
                shape: [[1]],
                originalShape: [[1]],
                color: '#ff0000',
                solutionX: 0,
                solutionY: 0,
                solutionRotation: 0,
                solutionFlipped: false
            }]
        };

        const realWorker = window.__generationWorker;
        realWorker.postMessage = function (data) {
            if (data.type === 'GENERATE') {
                setTimeout(() => {
                    realWorker.onmessage({
                        data: { type: 'PUZZLE_GENERATED', puzzle: mockPuzzle, reqId: data.reqId }
                    });
                }, 10);
            }
        };
    });

    await page.click('#btn-new-game');
    await page.click('#btn-got-it');
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 10000 });
    await page.waitForFunction(() => window.game && window.game.pieces.length > 0);

    // Verify data-cheat-listener attribute exists (prevents duplicate listeners)
    const hasAttribute = await page.locator('#title-display').evaluate(el => el.hasAttribute('data-cheat-listener'));
    expect(hasAttribute).toBe(true);

    // Verify cheat code still works (single listener behavior)
    const title = page.locator('#title-display');

    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(100);
    await title.click();
    await page.waitForTimeout(200);

    const hintAfter = await page.evaluate(() => window.game.hintPiece);
    expect(hintAfter).not.toBeNull();
});
