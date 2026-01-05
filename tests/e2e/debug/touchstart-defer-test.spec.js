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

test.describe('Touchstart Deferral Tests', () => {

    test('CDP touchmove works when touchstart handler is minimized', async ({ page }) => {
        await startGame(page);

        // Patch the touchstart handler to do nothing
        await page.evaluate(() => {
            const container = document.getElementById('game-container');

            // Remove the existing touchstart listener by cloning container
            // but keep the window listeners for touchmove/touchend
            const inputHandler = window.inputHandler;

            // Create a minimal touchstart handler
            const minimalHandler = (e) => {
                // Only set the bare minimum state - no DOM updates
                const touch = e.changedTouches[0];
                inputHandler.activeTouchId = touch.identifier;

                // Find piece but don't do anything else
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        const pieceId = pieceEl.dataset.pieceId;
                        inputHandler.draggingPiece = window.game.pieces.find(p => String(p.id) === pieceId);
                    }
                }

                // Don't call handleMove or onInteraction
            };

            // Remove old listener by replacing container's content
            const oldListeners = container._listeners || [];

            // We can't easily remove the listener, so let's override the handleStart method
            inputHandler.handleStart = function(e, isTouch, touchId) {
                if (isTouch) {
                    this.activeTouchId = touchId;
                    const pos = this.getClientCoords(e);
                    const el = document.elementFromPoint(pos.x, pos.y);
                    if (el) {
                        const pieceEl = el.closest('.piece');
                        if (pieceEl) {
                            const pieceId = pieceEl.dataset.pieceId;
                            this.draggingPiece = this.game.pieces.find(p => String(p.id) === pieceId);
                            this.renderer.draggingPieceId = this.draggingPiece?.id;
                        }
                    }
                }
                // Don't call handleMove or onInteraction - defer everything
            };

            window.__touchEvents = [];
            window.addEventListener('touchstart', () => window.__touchEvents.push('touchstart'), { capture: true, passive: true });
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
            window.addEventListener('touchend', () => window.__touchEvents.push('touchend'), { capture: true, passive: true });
        });

        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                pieceId: piece.id,
                centerX: box.left + box.width / 2,
                centerY: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY, id: 1 }]
        });
        await page.waitForTimeout(50);

        const afterStart = await page.evaluate(() => ({
            activeTouchId: window.inputHandler.activeTouchId,
            hasDraggingPiece: !!window.inputHandler.draggingPiece
        }));
        console.log('After touchStart:', afterStart);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY - 50, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events with minimal touchstart:', events);

        expect(events).toContain('touchstart');
        expect(events).toContain('touchmove');
    });

    test('check if setting draggingPiece breaks touchmove', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const inputHandler = window.inputHandler;
            const origHandleStart = inputHandler.handleStart.bind(inputHandler);

            // Test: only set draggingPiece, nothing else
            inputHandler.handleStart = function(e, isTouch, touchId) {
                if (!isTouch) {
                    return origHandleStart(e, isTouch, touchId);
                }

                this.activeTouchId = touchId;
                const pos = this.getClientCoords(e);
                const el = document.elementFromPoint(pos.x, pos.y);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        this.draggingPiece = this.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                        this.renderer.draggingPieceId = this.draggingPiece?.id;
                    }
                }
                // NOT calling handleMove or onInteraction
            };

            window.__touchEvents = [];
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
        });

        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return { centerX: box.left + box.width / 2, centerY: box.top + box.height / 2 };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY - 50, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events after setting draggingPiece only:', events);

        expect(events).toContain('touchmove');
    });

    test('check if calling onInteraction breaks touchmove', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const inputHandler = window.inputHandler;

            inputHandler.handleStart = function(e, isTouch, touchId) {
                if (!isTouch) return;

                this.activeTouchId = touchId;
                const pos = this.getClientCoords(e);
                const el = document.elementFromPoint(pos.x, pos.y);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        this.draggingPiece = this.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                        this.renderer.draggingPieceId = this.draggingPiece?.id;
                    }
                }
                // Call onInteraction which triggers draw()
                this.onInteraction();
            };

            window.__touchEvents = [];
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
        });

        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return { centerX: box.left + box.width / 2, centerY: box.top + box.height / 2 };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY - 50, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events after calling onInteraction:', events);

        // This might fail if onInteraction (which triggers draw) breaks touch tracking
        expect(events).toContain('touchmove');
    });
});
