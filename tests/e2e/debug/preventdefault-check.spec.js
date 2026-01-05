import { test, expect } from '@playwright/test';

test.describe('preventDefault Investigation', () => {

    test('check if preventDefault is called on touchstart', async ({ page }) => {
        await page.goto('/');

        // Intercept preventDefault before any listeners are added
        await page.evaluate(() => {
            window.__preventDefaultCalls = [];
            const origPreventDefault = Event.prototype.preventDefault;
            Event.prototype.preventDefault = function() {
                const stack = new Error().stack?.split('\n').slice(1, 5).join('\n');
                window.__preventDefaultCalls.push({
                    type: this.type,
                    target: this.target?.id || this.target?.className || this.target?.tagName,
                    cancelable: this.cancelable,
                    stack
                });
                return origPreventDefault.call(this);
            };
        });

        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        await page.click('#btn-got-it');
        await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0
        );

        // Clear any preventDefault calls from setup
        await page.evaluate(() => {
            window.__preventDefaultCalls = [];
        });

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

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const afterStart = await page.evaluate(() => window.__preventDefaultCalls);
        console.log('preventDefault calls after touchStart:', afterStart);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.x + 50, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const afterMove = await page.evaluate(() => window.__preventDefaultCalls);
        console.log('preventDefault calls after touchMove:', afterMove);
    });

    test('check defaultPrevented on touchstart event', async ({ page }) => {
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

        await page.evaluate(() => {
            window.__eventDetails = [];
            // Add listener at capture phase FIRST to see event before Playwright's interceptor
            window.addEventListener('touchstart', (e) => {
                window.__eventDetails.push({
                    phase: 'capture-window',
                    defaultPrevented: e.defaultPrevented,
                    cancelable: e.cancelable
                });
            }, { capture: true, passive: true });

            // Also at bubble phase
            window.addEventListener('touchstart', (e) => {
                window.__eventDetails.push({
                    phase: 'bubble-window',
                    defaultPrevented: e.defaultPrevented,
                    cancelable: e.cancelable
                });
            }, { capture: false, passive: true });

            window.addEventListener('touchmove', (e) => {
                window.__eventDetails.push({
                    phase: 'touchmove',
                    defaultPrevented: e.defaultPrevented,
                    cancelable: e.cancelable
                });
            }, { capture: true, passive: true });
        });

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

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.x + 50, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const details = await page.evaluate(() => window.__eventDetails);
        console.log('Event details:', details);
    });

    test('check if Playwright hit target interceptor blocks touchmove', async ({ page }) => {
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

        // Check what Playwright's InjectedScript does
        await page.evaluate(() => {
            window.__touchLog = [];

            // Override at document level to see events
            document.addEventListener('touchstart', (e) => {
                window.__touchLog.push({
                    type: 'touchstart',
                    target: e.target?.id || e.target?.className,
                    defaultPrevented: e.defaultPrevented
                });
            }, { capture: true, passive: true });

            document.addEventListener('touchmove', (e) => {
                window.__touchLog.push({
                    type: 'touchmove',
                    target: e.target?.id || e.target?.className,
                    defaultPrevented: e.defaultPrevented
                });
            }, { capture: true, passive: true });
        });

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

        console.log('Sending touchStart to piece at', pieceInfo.x, pieceInfo.y);
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        console.log('Sending touchMove');
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.x + 50, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const log = await page.evaluate(() => window.__touchLog);
        console.log('Touch log:', log);

        // The issue: if touchmove doesn't appear in log, it's not being dispatched at all
    });

    test('touch on simple div NOT in game-container', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#start-screen');
        await page.click('#btn-new-game');
        await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
        await page.click('#btn-got-it');
        await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));

        await page.evaluate(() => {
            const div = document.createElement('div');
            div.id = 'simple-test-div';
            div.style.cssText = `
                position: fixed;
                left: 50px;
                top: 50px;
                width: 100px;
                height: 100px;
                background: red;
                z-index: 99999;
            `;
            document.body.appendChild(div);

            window.__simpleDivLog = [];
            document.addEventListener('touchstart', (e) => {
                window.__simpleDivLog.push({ type: 'touchstart', target: e.target?.id });
            }, { capture: true, passive: true });
            document.addEventListener('touchmove', (e) => {
                window.__simpleDivLog.push({ type: 'touchmove', target: e.target?.id });
            }, { capture: true, passive: true });
        });

        const client = await page.context().newCDPSession(page);

        console.log('Sending touchStart to simple div at 100, 100');
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: 100, y: 100, id: 1 }]
        });
        await page.waitForTimeout(50);

        console.log('Sending touchMove');
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: 150, y: 100, id: 1 }]
        });
        await page.waitForTimeout(50);

        const log = await page.evaluate(() => window.__simpleDivLog);
        console.log('Simple div touch log:', log);

        expect(log.filter(e => e.type === 'touchmove').length).toBeGreaterThan(0);
    });
});
