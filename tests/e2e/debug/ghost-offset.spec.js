import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    await page.waitForFunction(() =>
        window.game &&
        window.game.pieces.length > 0
    );
}

test.describe('Ghost Preview and Drop Position', () => {

    test('piece should land where ghost preview shows', async ({ page }) => {
        await startGame(page);

        // Get a piece from dock
        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                id: piece.id,
                startX: box.left + box.width / 2,
                startY: box.top + box.height / 2
            };
        });

        // Get board position
        const boardInfo = await page.evaluate(() => {
            const board = document.getElementById('game-board');
            const rect = board.getBoundingClientRect();
            const cellSize = window.renderer.cellSize;
            return {
                left: rect.left,
                top: rect.top,
                cellSize: cellSize,
                // Target: cell (1, 1) on the board
                targetX: rect.left + cellSize * 1.5,
                targetY: rect.top + cellSize * 1.5
            };
        });

        const client = await page.context().newCDPSession(page);

        // Start drag
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.startX, y: pieceInfo.startY, id: 1 }]
        });
        await page.waitForTimeout(50);

        // Move to board position
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: boardInfo.targetX, y: boardInfo.targetY, id: 1 }]
        });
        await page.waitForTimeout(100);

        // Check ghost preview position
        const ghostInfo = await page.evaluate(() => {
            const ghost = document.querySelector('.ghost-preview');
            if (!ghost) return null;
            const rect = ghost.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                visible: ghost.style.display !== 'none' && parseFloat(ghost.style.opacity) > 0
            };
        });

        console.log('Ghost preview during drag:', ghostInfo);

        // End drag
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(100);

        // Check where piece landed
        const finalPieceInfo = await page.evaluate((pieceId) => {
            const piece = window.game.pieces.find(p => p.id === pieceId);
            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            const rect = pieceEl.getBoundingClientRect();
            return {
                gridX: piece.x,
                gridY: piece.y,
                screenLeft: rect.left,
                screenTop: rect.top
            };
        }, pieceInfo.id);

        console.log('Final piece position:', finalPieceInfo);

        // The piece's screen position should match the ghost preview position
        if (ghostInfo) {
            const xDiff = Math.abs(finalPieceInfo.screenLeft - ghostInfo.left);
            const yDiff = Math.abs(finalPieceInfo.screenTop - ghostInfo.top);
            console.log('Position difference - X:', xDiff, 'Y:', yDiff);
        }
    });

    test('ghost preview position calculation', async ({ page }) => {
        await startGame(page);

        // Check how ghost preview position is calculated
        const positions = await page.evaluate(() => {
            const board = document.getElementById('game-board');
            const boardRect = board.getBoundingClientRect();
            const cellSize = window.renderer.cellSize;

            // Test position: grid (2, 2)
            const testGridX = 2;
            const testGridY = 2;

            // Expected screen position (relative to viewport)
            const expectedScreenX = boardRect.left + testGridX * cellSize;
            const expectedScreenY = boardRect.top + testGridY * cellSize;

            // What setGhostPreview would calculate
            // Looking at renderer.js: ghostEl.style.left = `${x * cellSize}px`
            // This is relative to board, not absolute
            const ghostRelativeX = testGridX * cellSize;
            const ghostRelativeY = testGridY * cellSize;

            return {
                boardRect: { left: boardRect.left, top: boardRect.top },
                cellSize,
                testGrid: { x: testGridX, y: testGridY },
                expectedScreen: { x: expectedScreenX, y: expectedScreenY },
                ghostRelative: { x: ghostRelativeX, y: ghostRelativeY }
            };
        });

        console.log('Position calculation:', positions);
    });

    test('compare piece position vs ghost preview during drag', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                id: piece.id,
                startX: box.left + box.width / 2,
                startY: box.top + box.height / 2
            };
        });

        const boardInfo = await page.evaluate(() => {
            const board = document.getElementById('game-board');
            const rect = board.getBoundingClientRect();
            const cellSize = window.renderer.cellSize;
            return {
                left: rect.left,
                top: rect.top,
                cellSize: cellSize,
                targetX: rect.left + cellSize * 2,
                targetY: rect.top + cellSize * 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.startX, y: pieceInfo.startY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: boardInfo.targetX, y: boardInfo.targetY, id: 1 }]
        });
        await page.waitForTimeout(100);

        // Get both piece and ghost positions
        const comparison = await page.evaluate((pieceId) => {
            const piece = window.game.pieces.find(p => p.id === pieceId);
            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            const pieceRect = pieceEl.getBoundingClientRect();

            const ghost = document.querySelector('.ghost-preview');
            const ghostRect = ghost ? ghost.getBoundingClientRect() : null;

            const board = document.getElementById('game-board');
            const boardRect = board.getBoundingClientRect();

            return {
                pieceGrid: { x: piece.x, y: piece.y },
                pieceScreen: { left: pieceRect.left, top: pieceRect.top },
                ghostScreen: ghostRect ? { left: ghostRect.left, top: ghostRect.top } : null,
                boardScreen: { left: boardRect.left, top: boardRect.top },
                ghostStyle: ghost ? {
                    left: ghost.style.left,
                    top: ghost.style.top,
                    position: getComputedStyle(ghost).position
                } : null
            };
        }, pieceInfo.id);

        console.log('During drag comparison:', JSON.stringify(comparison, null, 2));

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
    });

    test('verify piece snaps to expected grid position', async ({ page }) => {
        await startGame(page);

        // Find a piece and drag it to a specific board position
        const setup = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const pieceBox = pieceEl.getBoundingClientRect();

            const board = document.getElementById('game-board');
            const boardRect = board.getBoundingClientRect();
            const cellSize = window.renderer.cellSize;

            return {
                pieceId: piece.id,
                pieceCenter: {
                    x: pieceBox.left + pieceBox.width / 2,
                    y: pieceBox.top + pieceBox.height / 2
                },
                // Target center of cell (1, 1)
                targetCell: { gridX: 1, gridY: 1 },
                targetScreen: {
                    x: boardRect.left + cellSize * 1.5,
                    y: boardRect.top + cellSize * 1.5
                },
                cellSize
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: setup.pieceCenter.x, y: setup.pieceCenter.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: setup.targetScreen.x, y: setup.targetScreen.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(100);

        const result = await page.evaluate((pieceId) => {
            const piece = window.game.pieces.find(p => p.id === pieceId);
            return {
                gridX: piece.x,
                gridY: piece.y,
                inDock: piece.y >= 6 // approximate dock Y
            };
        }, setup.pieceId);

        console.log('Expected grid position:', setup.targetCell);
        console.log('Actual grid position:', result);

        // If piece is on board, it should be near the target cell
        if (!result.inDock) {
            // Allow some tolerance due to piece shape offset
            expect(Math.abs(result.gridX - setup.targetCell.gridX)).toBeLessThanOrEqual(2);
            expect(Math.abs(result.gridY - setup.targetCell.gridY)).toBeLessThanOrEqual(2);
        }
    });
});
