import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    // Skip tutorial in tests
    await page.evaluate(() => localStorage.setItem('polyfit-tutorial-shown', '3'));
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
}

async function solvePuzzle(page) {
    await page.evaluate(() => {
        const game = window.game;
        for (const piece of game.pieces) {
            game.updatePieceState(piece.id, {
                x: piece.solutionX,
                y: piece.solutionY,
                rotation: piece.solutionRotation,
                flipped: piece.solutionFlipped
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
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();

    const piecePos = await page.evaluate(() => {
        const piece = window.game.pieces[0];
        return { x: piece.x, y: piece.y };
    });

    const cellWidth = box.width / 5;
    const cellHeight = box.height / 12;
    const clickX = box.x + (piecePos.x + 0.5) * cellWidth;
    const clickY = box.y + (piecePos.y + 0.5) * cellHeight;

    await page.mouse.click(clickX, clickY);
}

// Trigger checkWin directly via exposed test helper
async function triggerWinCheck(page) {
    await page.evaluate(() => window.triggerCheckWin());
}

test.describe('Level Progression - Race Condition Prevention', () => {
    test('level should not change during normal piece interactions', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        for (let i = 0; i < 10; i++) {
            const tapX = box.x + box.width * (0.2 + Math.random() * 0.6);
            const tapY = box.y + box.height * 0.85;
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

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        for (let i = 0; i < 5; i++) {
            const startX = box.x + box.width * 0.3;
            const startY = box.y + box.height * 0.85;
            const endX = box.x + box.width * 0.5;
            const endY = box.y + box.height * 0.3;

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

        const piecePos = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            return { x: piece.x, y: piece.y };
        });

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        const cellWidth = box.width / 5;
        const cellHeight = box.height / 12;
        const tapX = box.x + (piecePos.x + 0.5) * cellWidth;
        const tapY = box.y + (piecePos.y + 0.5) * cellHeight;

        for (let i = 0; i < 20; i++) {
            await page.mouse.click(tapX, tapY);
            await page.waitForTimeout(20);
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
                rotation: piece.solutionRotation,
                flipped: piece.solutionFlipped
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
                    rotation: piece.solutionRotation,
                    flipped: piece.solutionFlipped
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

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        for (let i = 0; i < 10; i++) {
            await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.85);
            await page.waitForTimeout(50);
        }

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel);
    });

    test('mixed mouse and touch events should not cause issues', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.85);
        await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.85);
        await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.85);
        await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.85);

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

    test('win overlay visibility does not affect level counting', async ({ page }) => {
        await startGame(page);
        const initialLevel = await getLevel(page);

        await solvePuzzle(page);

        await triggerWinCheck(page);

        await page.waitForFunction(() => !document.querySelector('#win-overlay').classList.contains('hidden'));

        // Keep interacting after overlay shows
        for (let i = 0; i < 10; i++) {
            await triggerWinCheck(page);
        }

        await page.waitForTimeout(2000);

        const finalLevel = await getLevel(page);
        expect(finalLevel).toBe(initialLevel + 1);
    });
});
