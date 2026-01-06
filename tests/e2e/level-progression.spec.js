import { test, expect } from './fixtures/coverage.js';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    // New Game always shows tutorial - dismiss it
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    // Wait for game to be fully initialized
    await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);
}

async function solvePuzzle(page) {
    await page.evaluate(() => {
        const game = window.game;
        for (const piece of game.pieces) {
            game.updatePieceState(piece.id, {
                x: piece.solutionX,
                y: piece.solutionY,
                rotation: piece.effectiveRotation,
                flipped: piece.effectiveFlipped
            });
        }
    });
}

async function getLevel(page) {
    return await page.evaluate(() => window.getLevel());
}

async function isWinning(page) {
    return await page.evaluate(() => window.isWinning());
}

async function clickOnPiece(page) {
    // Get first piece's DOM element
    const pieceId = await page.evaluate(() => window.game.pieces[0].id);
    const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
    const box = await pieceEl.boundingBox();

    if (box) {
        const clickX = box.x + box.width / 2;
        const clickY = box.y + box.height / 2;
        await page.mouse.click(clickX, clickY);
    }
}

// Trigger checkWin directly via exposed test helper
async function triggerWinCheck(page) {
    await page.evaluate(() => window.triggerCheckWin());
}

test.describe('Level Progression - Race Condition Prevention', () => {
    test('level should not change during normal piece interactions', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        for (let i = 0; i < 10; i++) {
            const tapX = box.x + box.width * (0.2 + Math.random() * 0.6);
            const tapY = box.y + box.height * 0.5;
            await page.mouse.click(tapX, tapY);
            await page.waitForTimeout(50);
        }

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });

    test('rapid taps after solving should not advance level multiple times', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);
        await triggerWinCheck(page);

        // Rapid interactions after win triggered
        for (let i = 0; i < 20; i++) {
            await triggerWinCheck(page);
            await page.waitForTimeout(10);
        }

        await page.waitForTimeout(3000);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });

    test('isWinning flag should block multiple win triggers', async ({ page }) => {
        await startGame(page);

        await solvePuzzle(page);

        await triggerWinCheck(page);

        await page.waitForTimeout(100);
        const winning = await isWinning(page);
        expect(winning).toBe(true);

        const checkWinResult = await page.evaluate(() => window.game.checkWin());
        expect(checkWinResult).toBe(true);
    });

    test('multiple drag-and-drops should not trigger false win', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const dock = page.locator('#piece-dock');
        const dockBox = await dock.boundingBox();
        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        for (let i = 0; i < 5; i++) {
            const startX = dockBox.x + dockBox.width * 0.3;
            const startY = dockBox.y + dockBox.height * 0.5;
            const endX = boardBox.x + boardBox.width * 0.5;
            const endY = boardBox.y + boardBox.height * 0.5;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(endX, endY, { steps: 5 });
            await page.mouse.up();
            await page.waitForTimeout(100);
        }

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });

    test('rapid rotation taps should not trigger level change', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        // Get first piece's DOM element
        const pieceId = await page.evaluate(() => window.game.pieces[0].id);
        const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
        const box = await pieceEl.boundingBox();

        if (!box) {
            // Fallback to dock area if piece not visible
            const dock = page.locator('#piece-dock');
            const dockBox = await dock.boundingBox();
            for (let i = 0; i < 20; i++) {
                await page.mouse.click(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
                await page.waitForTimeout(20);
            }
        } else {
            const tapX = box.x + box.width / 2;
            const tapY = box.y + box.height / 2;

            for (let i = 0; i < 20; i++) {
                await page.mouse.click(tapX, tapY);
                await page.waitForTimeout(20);
            }
        }

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });

    test('solving and immediately interacting should advance exactly one level', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);

        await triggerWinCheck(page);

        await page.waitForTimeout(100);

        for (let i = 0; i < 10; i++) {
            await triggerWinCheck(page);
            await page.waitForTimeout(50);
        }

        await page.waitForTimeout(3000);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });
});

test.describe('Level Progression - State Consistency', () => {
    test('level display matches internal level', async ({ page }) => {
        await startGame(page);

        for (let i = 0; i < 3; i++) {
            const internalLevel = await getLevel(page);
            const displayText = await page.locator('#level-display').textContent();
            expect(displayText).toContain(`LEVEL ${internalLevel}`);

            await solvePuzzle(page);

            await triggerWinCheck(page);

            await page.waitForTimeout(3000);
        }
    });

    test('checkWin returns false when pieces in dock', async ({ page }) => {
        await startGame(page);

        const result = await page.evaluate(() => window.game.checkWin());
        expect(result).toBe(false);

        const level = await getLevel(page);
        expect(level).toBe(1);
    });

    test('checkWin returns false with partial solution', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const game = window.game;
            const piece = game.pieces[0];
            game.updatePieceState(piece.id, {
                x: piece.solutionX,
                y: piece.solutionY,
                rotation: piece.effectiveRotation,
                flipped: piece.effectiveFlipped
            });
        });

        const result = await page.evaluate(() => window.game.checkWin());
        expect(result).toBe(false);

        const level = await getLevel(page);
        expect(level).toBe(1);
    });

    test('pieces must be snapped to correct position for win', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const game = window.game;
            for (const piece of game.pieces) {
                game.updatePieceState(piece.id, {
                    x: piece.solutionX + 0.1,
                    y: piece.solutionY,
                    rotation: piece.effectiveRotation,
                    flipped: piece.effectiveFlipped
                });
            }
        });

        const result = await page.evaluate(() => window.game.checkWin());
        expect(result).toBe(false);
    });
});

test.describe('Level Progression - Touch Event Simulation', () => {
    test('touchstart and touchend should not cause double trigger', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        for (let i = 0; i < 10; i++) {
            await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
            await page.waitForTimeout(50);
        }

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });

    test('mixed mouse and touch events should not cause issues', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
        await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.5);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });
});

test.describe('Level Progression - Edge Cases', () => {
    test('very fast solve and click should still only advance once', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);

        // Trigger many win checks in rapid succession
        for (let i = 0; i < 50; i++) {
            await triggerWinCheck(page);
        }

        await page.waitForTimeout(4000);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });

    test('solving during win animation should not double advance', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);

        await triggerWinCheck(page);

        await page.waitForTimeout(500);

        // Try to trigger another win during animation
        await solvePuzzle(page);
        await triggerWinCheck(page);

        await page.waitForTimeout(3000);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });

    test('instant flow advances level without blocking', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);

        await triggerWinCheck(page);

        // Wait for potential transition/animation time
        await page.waitForTimeout(1000);

        // Verify level advanced (no blocking overlay stopped it)
        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });
});
