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

test.describe('Rotation Tap Detection', () => {

    test('quick tap on piece should rotate it', async ({ page }) => {
        // Capture console logs
        const consoleLogs = [];
        page.on('console', msg => {
            if (msg.text().includes('[InputHandler]')) {
                consoleLogs.push(msg.text());
            }
        });

        await startGame(page);

        // Get initial rotation
        const initialState = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            return {
                id: piece.id,
                rotation: piece.rotation,
                x: piece.x,
                y: piece.y
            };
        });

        const pieceBox = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        // Quick tap: touchStart followed immediately by touchEnd at same position
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceBox.x, y: pieceBox.y, id: 1 }]
        });

        // Wait just a tiny bit (less than TAP_MAX_DURATION of 300ms)
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });

        await page.waitForTimeout(100);

        // IMPORTANT: Find by id since pieces array may be reordered during interaction
        const afterState = await page.evaluate((pieceId) => {
            const piece = window.game.pieces.find(p => p.id === pieceId);
            return {
                rotation: piece.rotation,
                x: piece.x,
                y: piece.y
            };
        }, initialState.id);

        console.log('Initial state:', initialState);
        console.log('After tap state:', afterState);
        console.log('Console logs:', consoleLogs);

        // Rotation should have changed by 1
        expect(afterState.rotation).toBe((initialState.rotation + 1) % 4);
    });

    test('tap detection: distance and duration logged', async ({ page }) => {
        await startGame(page);

        // Patch handleEnd to log tap detection values
        await page.evaluate(() => {
            const ih = window.inputHandler;
            const origHandleEnd = ih.handleEnd.bind(ih);
            ih.handleEnd = function(e) {
                if (this.draggingPiece && this.dragStartPos) {
                    let pos;
                    if (e.changedTouches && e.changedTouches.length > 0) {
                        pos = this.getClientCoords(e.changedTouches[0]);
                    } else if (e.clientX !== undefined) {
                        pos = this.getClientCoords(e);
                    } else {
                        pos = this.dragStartPos;
                    }
                    const dist = Math.hypot(pos.x - this.dragStartPos.x, pos.y - this.dragStartPos.y);
                    const duration = Date.now() - this.dragStartTime;
                    window.__tapDetection = {
                        distance: dist,
                        duration: duration,
                        startPos: { ...this.dragStartPos },
                        endPos: pos,
                        TAP_MAX_DISTANCE: 10,
                        TAP_MAX_DURATION: 300,
                        wouldBeTap: dist < 10 && duration < 300
                    };
                }
                return origHandleEnd(e);
            };
        });

        const pieceBox = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceBox.x, y: pieceBox.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(100);

        const tapDetection = await page.evaluate(() => window.__tapDetection);
        console.log('Tap detection values:', tapDetection);

        // Check that this should be detected as a tap
        expect(tapDetection.wouldBeTap).toBe(true);
    });

    test('piece should NOT visually jump on touchstart for tap', async ({ page }) => {
        await startGame(page);

        const initialPiecePos = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return { top: box.top, left: box.left };
        });

        const pieceBox = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceBox.x, y: pieceBox.y, id: 1 }]
        });

        // Check piece position IMMEDIATELY after touchstart
        const afterStartPos = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return { top: box.top, left: box.left };
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });

        console.log('Initial position:', initialPiecePos);
        console.log('After touchstart position:', afterStartPos);

        const verticalJump = Math.abs(afterStartPos.top - initialPiecePos.top);
        console.log('Vertical jump on touchstart:', verticalJump, 'pixels');

        // For a tap gesture, the piece should not jump significantly
        // Currently it jumps by visualDragOffset which is ~2.5 grid cells
        // This is the bug - piece shouldn't move until actual drag detected
    });

    test('visualDragOffset should only apply during actual drag', async ({ page }) => {
        await startGame(page);

        // Check what visualDragOffset is set to
        const config = await page.evaluate(() => {
            const ih = window.inputHandler;
            return {
                TOUCH_LIFT_GRID_CELLS: 2.5, // from constants
                gridSize: ih.renderer.cellSize,
                expectedOffset: ih.renderer.cellSize * 2.5
            };
        });

        console.log('Visual offset config:', config);

        // The expected behavior should be:
        // - On touchstart: NO visual movement (piece stays in place)
        // - Only when touchmove is detected AND distance > TAP_MAX_DISTANCE: apply offset
        // - On touchend without significant movement: rotate (no position change)
    });
});
