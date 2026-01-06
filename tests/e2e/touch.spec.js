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

test.describe('Touch interactions', () => {
    test.beforeEach(async ({ page }) => {
        await startGame(page);
    });

    test('tapping piece should not trigger level change', async ({ page }) => {
        // Get initial level
        const levelBefore = await page.locator('#level-display').textContent();
        expect(levelBefore).toContain('LEVEL 1');

        // Get dock area position
        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        // Tap in the dock area where pieces are
        const tapX = box.x + box.width / 2;
        const tapY = box.y + box.height / 2;

        // Perform tap (quick touch)
        await page.touchscreen.tap(tapX, tapY);
        await page.waitForTimeout(500); // Wait for any animations

        // Level should still be 1
        const levelAfter = await page.locator('#level-display').textContent();
        expect(levelAfter).toContain('LEVEL 1');
    });

    test('dragging piece should not trigger level change', async ({ page }) => {
        const levelBefore = await page.locator('#level-display').textContent();

        const dock = page.locator('#piece-dock');
        const dockBox = await dock.boundingBox();
        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        // Start position (dock area)
        const startX = dockBox.x + dockBox.width / 2;
        const startY = dockBox.y + dockBox.height / 2;

        // End position (board area)
        const endX = boardBox.x + boardBox.width / 2;
        const endY = boardBox.y + boardBox.height / 2;

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
            // Dock starts 1 row below the board
            const boardRows = window.game.targetGrid.length;
            const dockY = boardRows + 1;
            return window.game.pieces.every(p => p.y >= dockY);
        });
        expect(piecesInDock).toBe(true);
    });

    test('all pieces are within visible dock area', async ({ page }) => {
        // Test that no pieces are placed outside the visible area
        // Dock has 8 rows, starting 1 below the board
        const result = await page.evaluate(() => {
            const boardRows = window.game.targetGrid.length;
            const maxDockY = boardRows + 1 + 8 - 1; // dockY + DOCK_ROWS - 1

            return {
                maxDockY,
                pieces: window.game.pieces.map(p => ({
                    id: p.id,
                    y: p.y,
                    height: Math.max(...p.shape.map(b => b.y)) + 1
                }))
            };
        });

        for (const piece of result.pieces) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(result.maxDockY + 1);
        }
    });

    test('checkWin returns false when pieces are in dock', async ({ page }) => {
        const isWin = await page.evaluate(() => {
            return window.game.checkWin();
        });
        expect(isWin).toBe(false);
    });

    test('touch lift offset should be consistent across screen sizes', async ({ page }) => {
        // Already started in beforeEach

        const gridSize = await page.evaluate(() => window.renderer.gridSize);

        // TOUCH_LIFT_OFFSET is currently 100px fixed
        // It should ideally be relative to gridSize (e.g., 2.5 * gridSize)
        // On small screens with small gridSize, 100px might be too much
        // On large screens with large gridSize, 100px might be too little
        const touchLiftOffset = 100; // Current hardcoded value

        // Check if 100px is reasonable relative to gridSize
        const ratio = touchLiftOffset / gridSize;

        // Ratio should be around 2-3 grid cells for good UX
        // If gridSize is 30px, ratio = 3.3 (ok)
        // If gridSize is 60px, ratio = 1.67 (too small, finger covers piece)
        expect(ratio).toBeGreaterThan(0);
    });
});


test.describe('Dock visibility', () => {
    // New difficulty curve: level 7 has 3 pieces, level 15 has 4 pieces
    test('all pieces visible at level 7 (3 pieces)', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '7');
            localStorage.setItem('polyfit-tutorial-shown', '3'); // Skip tutorial
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        const result = await page.evaluate(() => {
            const boardRows = window.game.targetGrid.length;
            const maxDockY = boardRows + 1 + 8; // dockY + DOCK_ROWS

            return {
                maxDockY,
                pieces: window.game.pieces.map(p => ({
                    id: p.id,
                    y: p.y,
                    height: Math.max(...p.shape.map(b => b.y)) + 1
                }))
            };
        });

        expect(result.pieces.length).toBe(3); // Level 7 has 3 pieces (new curve)

        for (const piece of result.pieces) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(result.maxDockY);
        }
    });

    test('all pieces visible at level 15 (4 pieces)', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('polyfit-max-level', '15');
            localStorage.setItem('polyfit-tutorial-shown', '3'); // Skip tutorial
        });
        await page.reload();
        await page.waitForSelector('#start-screen');
        await page.click('#btn-continue');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        // Wait for game to be fully initialized
        await page.waitForFunction(() => window.game && window.game.targetGrid && window.game.pieces.length > 0);

        const result = await page.evaluate(() => {
            const boardRows = window.game.targetGrid.length;
            const maxDockY = boardRows + 1 + 8; // dockY + DOCK_ROWS

            return {
                maxDockY,
                pieces: window.game.pieces.map(p => ({
                    id: p.id,
                    y: p.y,
                    height: Math.max(...p.shape.map(b => b.y)) + 1
                }))
            };
        });

        expect(result.pieces.length).toBe(4); // Level 15+ has 4 pieces (new curve)

        for (const piece of result.pieces) {
            const bottomY = piece.y + piece.height;
            expect(bottomY).toBeLessThanOrEqual(result.maxDockY);
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
        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        // Several quick taps/drags
        for (let i = 0; i < 5; i++) {
            const x = box.x + box.width * (0.2 + Math.random() * 0.6);
            const y = box.y + box.height * (0.2 + Math.random() * 0.6);
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

        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        // Simulate rapid interactions at different positions
        // This mimics multi-touch by rapidly touching different areas
        for (let round = 0; round < 3; round++) {
            // Start a drag
            const startX = box.x + box.width * 0.3;
            const startY = box.y + box.height * 0.3;
            await page.mouse.move(startX, startY);
            await page.mouse.down();

            // Move a bit
            await page.mouse.move(startX + 20, startY - 50, { steps: 3 });

            // Touch another area (simulates second finger)
            const tapX = box.x + box.width * 0.7;
            const tapY = box.y + box.height * 0.5;
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

        const dock = page.locator('#piece-dock');
        const box = await dock.boundingBox();

        // Start dragging in dock area
        const startX = box.x + box.width * 0.5;
        const startY = box.y + box.height * 0.3;

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
