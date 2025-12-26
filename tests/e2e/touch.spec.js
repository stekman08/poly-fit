import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
}

test.describe('Touch interactions', () => {
    test.beforeEach(async ({ page }) => {
        await startGame(page);
    });

    test('tapping piece should not trigger level change', async ({ page }) => {
        // Get initial level
        const levelBefore = await page.locator('#level-display').textContent();
        expect(levelBefore).toContain('LEVEL 1');

        // Get canvas position
        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        // Tap in the dock area where pieces are (bottom of screen)
        // Pieces spawn at y=6 grid units, which is below the 5x5 board
        const tapX = box.x + box.width / 2;
        const tapY = box.y + box.height * 0.8; // 80% down = dock area

        // Perform tap (quick touch)
        await page.touchscreen.tap(tapX, tapY);
        await page.waitForTimeout(500); // Wait for any animations

        // Level should still be 1
        const levelAfter = await page.locator('#level-display').textContent();
        expect(levelAfter).toContain('LEVEL 1');

        // Win overlay should be hidden
        const winOverlay = page.locator('#win-overlay');
        await expect(winOverlay).toHaveClass(/hidden/);
    });

    test('dragging piece should not trigger level change', async ({ page }) => {
        const levelBefore = await page.locator('#level-display').textContent();

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        // Start position (dock area)
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height * 0.8;

        // End position (board area)
        const endX = box.x + box.width / 2;
        const endY = box.y + box.height * 0.4;

        // Perform touch drag
        await page.touchscreen.tap(startX, startY); // This actually does tap, we need drag

        // For drag, we need to use mouse with touch emulation or dispatchEvent
        // Playwright's touchscreen only has tap(), for drag we use mouse with hasTouch context
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Level should still be 1
        const levelAfter = await page.locator('#level-display').textContent();
        expect(levelAfter).toContain('LEVEL 1');
    });

    test('game state is accessible for testing', async ({ page }) => {
        // Verify game is exposed on window
        const hasGame = await page.evaluate(() => {
            return typeof window.game !== 'undefined' && window.game !== null;
        });
        expect(hasGame).toBe(true);

        // Verify game has pieces
        const pieceCount = await page.evaluate(() => {
            return window.game.pieces.length;
        });
        expect(pieceCount).toBeGreaterThan(0);
    });

    test('pieces start in dock area', async ({ page }) => {
        const piecesInDock = await page.evaluate(() => {
            // Dock Y is 6, board is 0-4
            return window.game.pieces.every(p => p.y >= 5);
        });
        expect(piecesInDock).toBe(true);
    });

    test('all pieces are within visible dock area', async ({ page }) => {
        // Test that no pieces are placed outside the visible area
        // The visible dock area is approximately Y=6 to Y=11
        const MAX_VISIBLE_Y = 11;

        const piecePositions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({
                id: p.id,
                y: p.y,
                height: Math.max(...p.shape.map(b => b.y)) + 1
            }));
        });

        for (const piece of piecePositions) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(MAX_VISIBLE_Y + 1);
        }
    });

    test('checkWin returns false when pieces are in dock', async ({ page }) => {
        const isWin = await page.evaluate(() => {
            return window.game.checkWin();
        });
        expect(isWin).toBe(false);
    });
});

test.describe('Dock visibility', () => {
    test('all pieces visible at level 7 (4 pieces)', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '7'));
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const MAX_VISIBLE_Y = 12;

        const piecePositions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({
                id: p.id,
                y: p.y,
                height: Math.max(...p.shape.map(b => b.y)) + 1
            }));
        });

        expect(piecePositions.length).toBe(4); // Level 7 has 4 pieces

        for (const piece of piecePositions) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(MAX_VISIBLE_Y);
        }
    });

    test('all pieces visible at level 15 (5 pieces)', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('polyfit-max-level', '15'));
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));

        const MAX_VISIBLE_Y = 12;

        const piecePositions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({
                id: p.id,
                y: p.y,
                height: Math.max(...p.shape.map(b => b.y)) + 1
            }));
        });

        expect(piecePositions.length).toBe(5); // Level 15+ has 5 pieces

        for (const piece of piecePositions) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(MAX_VISIBLE_Y);
        }
    });
});

test.describe('Puzzle solvability', () => {
    test('puzzle target area equals total piece blocks', async ({ page }) => {
        await startGame(page);

        const result = await page.evaluate(() => {
            const game = window.game;

            // Count target spots (1s in grid)
            let targetSpots = 0;
            for (const row of game.targetGrid) {
                for (const cell of row) {
                    if (cell === 1) targetSpots++;
                }
            }

            // Count total blocks in all pieces
            let totalBlocks = 0;
            for (const piece of game.pieces) {
                totalBlocks += piece.shape.length;
            }

            return { targetSpots, totalBlocks };
        });

        expect(result.targetSpots).toBe(result.totalBlocks);
    });

    test('multiple puzzles are solvable (smoke test)', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await startGame(page);
            const isValid = await page.evaluate(() => {
                const game = window.game;

                // Target spots count
                let targetSpots = 0;
                for (const row of game.targetGrid) {
                    for (const cell of row) {
                        if (cell === 1) targetSpots++;
                    }
                }

                // Piece blocks count
                let totalBlocks = 0;
                for (const piece of game.pieces) {
                    totalBlocks += piece.shape.length;
                }

                return targetSpots === totalBlocks && targetSpots > 0;
            });

            expect(isValid).toBe(true);
        }
    });
});

test.describe('Multi-touch safety', () => {
    test('all pieces should have integer coordinates after interactions', async ({ page }) => {
        await startGame(page);

        // Do various interactions
        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        // Several quick taps/drags
        for (let i = 0; i < 5; i++) {
            const x = box.x + box.width * (0.2 + Math.random() * 0.6);
            const y = box.y + box.height * (0.7 + Math.random() * 0.2);
            await page.mouse.click(x, y);
            await page.waitForTimeout(50);
        }

        // Verify all pieces have integer coordinates
        const piecePositions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y
            }));
        });

        for (const piece of piecePositions) {
            expect(Number.isInteger(piece.x)).toBe(true);
            expect(Number.isInteger(piece.y)).toBe(true);
        }
    });

    test('rapid multi-point touches should not leave pieces at fractional positions', async ({ page }) => {
        await startGame(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        // Simulate rapid interactions at different positions
        // This mimics multi-touch by rapidly touching different areas
        for (let round = 0; round < 3; round++) {
            // Start a drag
            const startX = box.x + box.width * 0.3;
            const startY = box.y + box.height * 0.8;
            await page.mouse.move(startX, startY);
            await page.mouse.down();

            // Move a bit
            await page.mouse.move(startX + 20, startY - 50, { steps: 3 });

            // Touch another area (simulates second finger)
            const tapX = box.x + box.width * 0.7;
            const tapY = box.y + box.height * 0.85;
            await page.touchscreen.tap(tapX, tapY);

            // Release first
            await page.mouse.up();

            await page.waitForTimeout(100);
        }

        // All pieces must have integer coordinates
        const piecePositions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y
            }));
        });

        for (const piece of piecePositions) {
            expect(Number.isInteger(piece.x)).toBe(true);
            expect(Number.isInteger(piece.y)).toBe(true);
        }
    });

    test('piece coordinates are always snapped after any touch end', async ({ page }) => {
        await startGame(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();

        // Start dragging in dock area
        const startX = box.x + box.width * 0.5;
        const startY = box.y + box.height * 0.8;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 15, startY - 30, { steps: 5 });
        await page.mouse.up();

        await page.waitForTimeout(100);

        // Check all pieces
        const positions = await page.evaluate(() => {
            return window.game.pieces.map(p => ({ x: p.x, y: p.y }));
        });

        for (const pos of positions) {
            expect(Number.isInteger(pos.x)).toBe(true);
            expect(Number.isInteger(pos.y)).toBe(true);
        }
    });
});
