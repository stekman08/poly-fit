import { test, expect } from '@playwright/test';

test.describe('Listener Count Investigation', () => {

    test('count all touch listeners before game starts', async ({ page }) => {
        await page.goto('/');

        // Intercept addEventListener BEFORE any code runs
        await page.evaluate(() => {
            window.__allListeners = [];
            const originalAdd = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type.includes('touch') || type.includes('mouse')) {
                    const target = this === window ? 'window' :
                                   this === document ? 'document' :
                                   this.id || this.className || this.tagName;
                    window.__allListeners.push({
                        target,
                        type,
                        passive: typeof options === 'object' ? options.passive : undefined,
                        capture: typeof options === 'object' ? options.capture : undefined,
                        stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
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

        const listeners = await page.evaluate(() => window.__allListeners);

        console.log('=== ALL REGISTERED TOUCH/MOUSE LISTENERS ===');
        listeners.forEach((l, i) => {
            console.log(`${i + 1}. ${l.type} on ${l.target} (passive: ${l.passive}, capture: ${l.capture})`);
            if (l.stack) {
                console.log(`   Stack:\n${l.stack.split('\n').map(s => '   ' + s).join('\n')}`);
            }
        });
        console.log(`Total: ${listeners.length} listeners`);
    });

    test('compare listener behavior: cloned vs original', async ({ page }) => {
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

        // Get piece position BEFORE any modifications
        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                id: piece.id,
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        // Test 1: Original listener
        console.log('=== Test 1: Original listeners ===');
        await page.evaluate(() => {
            window.__test1Events = [];
            window.addEventListener('touchstart', (e) => window.__test1Events.push('touchstart'), { capture: true, passive: true });
            window.addEventListener('touchmove', (e) => window.__test1Events.push('touchmove'), { capture: true, passive: true });
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.x + 30, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const test1 = await page.evaluate(() => ({
            events: window.__test1Events,
            draggingPiece: window.inputHandler?.draggingPiece?.id,
            hasInteraction: window.inputHandler?.hasInteraction
        }));
        console.log('Test 1 result:', test1);

        // Reset state
        await page.evaluate(() => {
            window.inputHandler.draggingPiece = null;
            window.inputHandler.hasInteraction = false;
        });

        // Test 2: Clone container and add new listener
        console.log('=== Test 2: Cloned container ===');
        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            // Update inputHandler reference
            window.inputHandler.container = newContainer;

            // Add new touchstart listener that calls handleStart
            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                window.inputHandler.handleStart(e, true, touch.identifier);
            }, { passive: true });

            window.__test2Events = [];
            window.addEventListener('touchstart', (e) => window.__test2Events.push('touchstart'), { capture: true, passive: true });
            window.addEventListener('touchmove', (e) => window.__test2Events.push('touchmove'), { capture: true, passive: true });
        });

        // Get new piece position after cloning
        const pieceInfo2 = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                id: piece.id,
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo2.x, y: pieceInfo2.y, id: 2 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo2.x + 30, y: pieceInfo2.y, id: 2 }]
        });
        await page.waitForTimeout(50);

        const test2 = await page.evaluate(() => ({
            events: window.__test2Events,
            draggingPiece: window.inputHandler?.draggingPiece?.id,
            hasInteraction: window.inputHandler?.hasInteraction
        }));
        console.log('Test 2 result:', test2);
    });

    test('check if piece is picked up on original', async ({ page }) => {
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

        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                id: piece.id,
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        await page.evaluate(() => {
            window.__debugEvents = [];

            // Patch handleStart to log when it's called
            const origHandleStart = window.inputHandler.handleStart.bind(window.inputHandler);
            window.inputHandler.handleStart = function(...args) {
                window.__debugEvents.push('handleStart called');
                return origHandleStart(...args);
            };

            // Patch handleMove to log
            const origHandleMove = window.inputHandler.handleMove.bind(window.inputHandler);
            window.inputHandler.handleMove = function(...args) {
                window.__debugEvents.push('handleMove called');
                return origHandleMove(...args);
            };

            window.addEventListener('touchstart', (e) => window.__debugEvents.push('window:touchstart'), { capture: true, passive: true });
            window.addEventListener('touchmove', (e) => window.__debugEvents.push('window:touchmove'), { capture: true, passive: true });
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const afterStart = await page.evaluate(() => ({
            events: window.__debugEvents,
            draggingPiece: window.inputHandler?.draggingPiece?.id,
            activeTouchId: window.inputHandler?.activeTouchId,
            hasInteraction: window.inputHandler?.hasInteraction
        }));
        console.log('After touchStart:', afterStart);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.x + 50, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const afterMove = await page.evaluate(() => ({
            events: window.__debugEvents,
            pieceX: window.inputHandler?.draggingPiece?.x
        }));
        console.log('After touchMove:', afterMove);
    });
});
