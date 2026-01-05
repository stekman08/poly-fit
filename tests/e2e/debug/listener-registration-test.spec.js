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

test.describe('Listener Registration Tests', () => {

    test('original container without cloning - just add our test listener', async ({ page }) => {
        await startGame(page);

        // Don't clone - just add a listener to the original container
        await page.evaluate(() => {
            const container = document.getElementById('game-container');

            // Add ANOTHER listener (original one still exists)
            container.addEventListener('touchstart', (e) => {
                window.__additionalListenerCalled = true;
            }, { passive: true });

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

        const called = await page.evaluate(() => window.__additionalListenerCalled);
        console.log('Additional listener called:', called);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events with original listener still present:', events);

        // This is expected to fail - the original listener is still there
    });

    test('check if original touchstart listener has passive:false in bindEvents', async ({ page }) => {
        // Navigate before game starts
        await page.goto('/');

        // Patch InputHandler before it runs
        await page.evaluate(() => {
            // Intercept addEventListener to log what's registered
            window.__registeredListeners = [];
            const originalAdd = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type.startsWith('touch')) {
                    window.__registeredListeners.push({
                        target: this === window ? 'window' : this.id || this.tagName,
                        type,
                        passive: typeof options === 'object' ? options.passive : undefined,
                        capture: typeof options === 'object' ? options.capture : undefined
                    });
                }
                return originalAdd.call(this, type, listener, options);
            };
        });

        // Now start the game
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        await page.click('#btn-got-it');
        await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0
        );

        const listeners = await page.evaluate(() => window.__registeredListeners);
        console.log('Registered touch listeners:', JSON.stringify(listeners, null, 2));

        // Check if there are any non-passive touch listeners
        const nonPassive = listeners.filter(l => l.passive === false);
        console.log('Non-passive listeners:', nonPassive);
    });

    test('replace inputHandler touchstart handler dynamically', async ({ page }) => {
        await startGame(page);

        // Try to replace the touchstart handler without cloning
        await page.evaluate(() => {
            const container = document.getElementById('game-container');
            const ih = window.inputHandler;

            // We can't easily remove the old listener, but we can make handleStart do nothing
            ih.originalHandleStart = ih.handleStart.bind(ih);
            ih.handleStart = function() {
                // Do nothing - skip all the original logic
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
        console.log('Events with replaced handleStart:', events);

        // If this works, the issue is in handleStart
        // If this fails, the issue is in the listener registration itself
    });

    test('touch on board area (no piece) with original listeners', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            window.__touchEvents = [];
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
        });

        // Get a position on the board that has no piece
        const boardPos = await page.evaluate(() => {
            const board = document.getElementById('game-board');
            const box = board.getBoundingClientRect();
            // Pick a corner likely to be empty
            return {
                x: box.left + 10,
                y: box.top + 10
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: boardPos.x, y: boardPos.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: boardPos.x + 30, y: boardPos.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events on empty board area:', events);

        // Should work because handleStart early-returns when no piece is hit
        expect(events).toContain('touchmove');
    });
});
