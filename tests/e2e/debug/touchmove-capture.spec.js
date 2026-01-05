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
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

test.describe('Touch Event Capture Analysis', () => {

    test('check where touch events are captured in DOM', async ({ page }) => {
        await startGame(page);

        // Add listeners at EVERY level to trace event propagation
        await page.evaluate(() => {
            window.__eventTrace = [];

            const elements = [
                { name: 'window', el: window },
                { name: 'document', el: document },
                { name: 'body', el: document.body },
                { name: 'game-container', el: document.getElementById('game-container') },
                { name: 'game-board', el: document.getElementById('game-board') },
                { name: 'piece-dock', el: document.getElementById('piece-dock') }
            ];

            // Add a piece element
            const firstPiece = document.querySelector('.piece');
            if (firstPiece) {
                elements.push({ name: 'piece', el: firstPiece });
            }

            for (const { name, el } of elements) {
                if (!el) continue;

                // Capture phase
                ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                    el.addEventListener(type, (e) => {
                        window.__eventTrace.push({
                            phase: 'capture',
                            target: name,
                            type,
                            defaultPrevented: e.defaultPrevented,
                            cancelable: e.cancelable,
                            timestamp: Date.now()
                        });
                    }, { capture: true, passive: true });
                });

                // Bubble phase
                ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                    el.addEventListener(type, (e) => {
                        window.__eventTrace.push({
                            phase: 'bubble',
                            target: name,
                            type,
                            defaultPrevented: e.defaultPrevented,
                            cancelable: e.cancelable,
                            timestamp: Date.now()
                        });
                    }, { passive: true });
                });
            }
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

        // Send touch events via CDP
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY), id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY - 100), id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY - 100), id: 1 }]
        });
        await page.waitForTimeout(50);

        const trace = await page.evaluate(() => window.__eventTrace);
        console.log('Event trace:', JSON.stringify(trace, null, 2));

        // Check what we got
        const touchstarts = trace.filter(t => t.type === 'touchstart');
        const touchmoves = trace.filter(t => t.type === 'touchmove');
        const touchends = trace.filter(t => t.type === 'touchend');

        console.log(`touchstart events: ${touchstarts.length}`);
        console.log(`touchmove events: ${touchmoves.length}`);
        console.log(`touchend events: ${touchends.length}`);

        // We expect touchstart to be captured
        expect(touchstarts.length).toBeGreaterThan(0);
    });

    test('check if synthetic vs CDP touch events behave differently', async ({ page }) => {
        await startGame(page);

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

        // Test 1: Synthetic events
        const syntheticResult = await page.evaluate(({ centerX, centerY, pieceId }) => {
            let touchmoveCount = 0;
            const handler = () => { touchmoveCount++; };
            window.addEventListener('touchmove', handler, { passive: true });

            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            function createTouch(x, y) {
                return new Touch({
                    identifier: 1,
                    target: pieceEl,
                    clientX: x,
                    clientY: y
                });
            }

            function createTouchEvent(type, touch) {
                return new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [touch],
                    targetTouches: type === 'touchend' ? [] : [touch],
                    changedTouches: [touch]
                });
            }

            pieceEl.dispatchEvent(createTouchEvent('touchstart', createTouch(centerX, centerY)));
            window.dispatchEvent(createTouchEvent('touchmove', createTouch(centerX, centerY - 50)));
            window.dispatchEvent(createTouchEvent('touchmove', createTouch(centerX, centerY - 100)));
            window.dispatchEvent(createTouchEvent('touchend', createTouch(centerX, centerY - 100)));

            window.removeEventListener('touchmove', handler);

            return { touchmoveCount };
        }, pieceInfo);

        console.log('Synthetic result:', syntheticResult);
        expect(syntheticResult.touchmoveCount).toBe(2);

        // Test 2: CDP events
        await page.evaluate(() => {
            window.__cdpTouchmoveCount = 0;
            window.__cdpTouchmoveHandler = () => { window.__cdpTouchmoveCount++; };
            window.addEventListener('touchmove', window.__cdpTouchmoveHandler, { passive: true });
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY), id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY - 50), id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: Math.round(pieceInfo.centerX), y: Math.round(pieceInfo.centerY - 100), id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(30);

        const cdpResult = await page.evaluate(() => {
            window.removeEventListener('touchmove', window.__cdpTouchmoveHandler);
            return { touchmoveCount: window.__cdpTouchmoveCount };
        });

        console.log('CDP result:', cdpResult);

        // This might be 0 if CDP doesn't generate DOM events for touchmove
        // That would explain the real mobile issue
        expect(cdpResult.touchmoveCount).toBeGreaterThan(0);
    });

    test('check if touchAction CSS affects touch events', async ({ page }) => {
        await startGame(page);

        // Check touch-action CSS on various elements
        const touchActions = await page.evaluate(() => {
            const elements = [
                { name: 'html', el: document.documentElement },
                { name: 'body', el: document.body },
                { name: 'game-container', el: document.getElementById('game-container') },
                { name: 'game-board', el: document.getElementById('game-board') },
                { name: 'piece-dock', el: document.getElementById('piece-dock') },
                { name: 'piece', el: document.querySelector('.piece') }
            ];

            return elements.map(({ name, el }) => {
                if (!el) return { name, touchAction: 'NOT FOUND' };
                const style = window.getComputedStyle(el);
                return {
                    name,
                    touchAction: style.touchAction,
                    pointerEvents: style.pointerEvents,
                    overflow: style.overflow
                };
            });
        });

        console.log('Touch-related CSS properties:', JSON.stringify(touchActions, null, 2));

        // touch-action: none can prevent default touch behaviors but shouldn't block our listeners
        // But it's good to document what's set
    });
});
