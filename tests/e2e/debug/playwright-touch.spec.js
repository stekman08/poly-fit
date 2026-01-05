import { test, expect } from '@playwright/test';

/**
 * These tests use Playwright's built-in touch APIs to verify touch handling
 */

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    await page.waitForFunction(() =>
        window.game &&
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

async function getPieceInfo(page, pieceIndex = 0) {
    return await page.evaluate((idx) => {
        const game = window.game;
        if (!game) return null;
        const piece = game.pieces[idx];
        if (!piece) return null;

        const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
        if (!pieceEl) return null;

        const box = pieceEl.getBoundingClientRect();
        return {
            pieceId: piece.id,
            centerX: box.left + box.width / 2,
            centerY: box.top + box.height / 2,
            gridX: piece.x,
            gridY: piece.y
        };
    }, pieceIndex);
}

async function getPieceGridPosition(page, pieceId) {
    return await page.evaluate((id) => {
        const piece = window.game.pieces.find(p => p.id === id);
        return piece ? { x: piece.x, y: piece.y } : null;
    }, pieceId);
}

test.describe('Playwright Touch APIs', () => {

    test('locator.dragTo moves piece to board', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        const posBefore = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position before:', posBefore);

        // Use Playwright's dragTo API
        const pieceEl = page.locator(`.piece[data-piece-id="${pieceInfo.pieceId}"]`);

        // Create a target position on the board
        const targetX = boardBox.x + boardBox.width / 2;
        const targetY = boardBox.y + boardBox.height / 2;

        await pieceEl.dragTo(board, {
            sourcePosition: { x: 10, y: 10 },
            targetPosition: { x: boardBox.width / 2, y: boardBox.height / 2 }
        });

        await page.waitForTimeout(100);

        const posAfter = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position after dragTo:', posAfter);

        // Should have moved from dock (y >= 6) to board (y < 5)
        expect(posAfter.y).toBeLessThan(posBefore.y);
    });

    test('manual mouse drag (fallback)', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        const posBefore = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position before mouse drag:', posBefore);

        // Calculate target position
        const targetX = boardBox.x + boardBox.width / 2;
        const targetY = boardBox.y + boardBox.height / 2;

        // Use mouse.move + mouse.down/up for a manual drag
        await page.mouse.move(pieceInfo.centerX, pieceInfo.centerY);
        await page.mouse.down();

        // Move in steps
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentX = pieceInfo.centerX + (targetX - pieceInfo.centerX) * progress;
            const currentY = pieceInfo.centerY + (targetY - pieceInfo.centerY) * progress;
            await page.mouse.move(currentX, currentY);
            await page.waitForTimeout(30);
        }

        await page.mouse.up();
        await page.waitForTimeout(100);

        const posAfter = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position after mouse drag:', posAfter);

        // Should have moved
        expect(posAfter.y).toBeLessThan(posBefore.y);
    });

    test('diagnose: touchmove listener registration', async ({ page }) => {
        await startGame(page);

        // Check how many touchmove listeners are registered on window
        const listenerInfo = await page.evaluate(() => {
            const results = {
                inputHandlerExists: !!window.inputHandler,
                hasBindEvents: typeof window.inputHandler?.bindEvents === 'function',
                containerExists: !!document.getElementById('game-container')
            };

            // Try to get listener info using getEventListeners (Chrome DevTools only)
            // This won't work in normal contexts but we can try other approaches

            // Check if our input handler is set up
            if (window.inputHandler) {
                results.draggingPiece = window.inputHandler.draggingPiece;
                results.activeTouchId = window.inputHandler.activeTouchId;
            }

            return results;
        });

        console.log('Listener info:', listenerInfo);
        expect(listenerInfo.inputHandlerExists).toBe(true);
        expect(listenerInfo.containerExists).toBe(true);
    });

    test('touchscreen tap picks up piece', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        // Inject diagnostic
        await page.evaluate(() => {
            window.__touchEvents = [];
            ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                window.addEventListener(type, (e) => {
                    window.__touchEvents.push({
                        type,
                        timestamp: Date.now(),
                        touches: e.touches?.length || 0,
                        clientX: e.touches?.[0]?.clientX || e.changedTouches?.[0]?.clientX
                    });
                }, { capture: true });
            });
        });

        // Use Playwright's touchscreen.tap
        await page.touchscreen.tap(pieceInfo.centerX, pieceInfo.centerY);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Touch events from tap:', events);

        // tap should generate touchstart and touchend
        expect(events.some(e => e.type === 'touchstart')).toBe(true);
        expect(events.some(e => e.type === 'touchend')).toBe(true);
    });

    test('page.dispatchEvent for touchmove', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        // Inject diagnostic
        await page.evaluate(() => {
            window.__touchMoveCount = 0;
            window.addEventListener('touchmove', () => {
                window.__touchMoveCount++;
            }, { capture: true });
        });

        const posBefore = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position before:', posBefore);

        // Use evaluate to dispatch touch events directly
        const result = await page.evaluate(async ({ startX, startY, endY, pieceId }) => {
            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            if (!pieceEl) return { error: 'No piece' };

            function createTouch(x, y, target) {
                return new Touch({
                    identifier: 42,
                    target: target,
                    clientX: x,
                    clientY: y,
                    pageX: x,
                    pageY: y
                });
            }

            function createTouchEvent(type, touch) {
                return new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    touches: type === 'touchend' ? [] : [touch],
                    targetTouches: type === 'touchend' ? [] : [touch],
                    changedTouches: [touch]
                });
            }

            // touchstart on piece
            const startTouch = createTouch(startX, startY, pieceEl);
            pieceEl.dispatchEvent(createTouchEvent('touchstart', startTouch));

            await new Promise(r => setTimeout(r, 20));

            const afterStart = {
                dragging: !!window.inputHandler?.draggingPiece,
                activeTouchId: window.inputHandler?.activeTouchId
            };

            // touchmove on window
            const steps = 5;
            for (let i = 1; i <= steps; i++) {
                const progress = i / steps;
                const currentY = startY + (endY - startY) * progress;
                const moveTouch = createTouch(startX, currentY, pieceEl);
                window.dispatchEvent(createTouchEvent('touchmove', moveTouch));
                await new Promise(r => setTimeout(r, 30));
            }

            // touchend
            const endTouch = createTouch(startX, endY, pieceEl);
            window.dispatchEvent(createTouchEvent('touchend', endTouch));

            return {
                afterStart,
                touchMoveCount: window.__touchMoveCount
            };
        }, {
            startX: pieceInfo.centerX,
            startY: pieceInfo.centerY,
            endY: boardBox.y + boardBox.height / 2,
            pieceId: pieceInfo.pieceId
        });

        console.log('Dispatch result:', result);

        const posAfter = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position after:', posAfter);

        expect(result.touchMoveCount).toBeGreaterThan(0);
        expect(result.afterStart.dragging).toBe(true);
        expect(posAfter.y).toBeLessThan(posBefore.y);
    });
});
