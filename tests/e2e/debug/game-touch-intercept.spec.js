import { test, expect } from '@playwright/test';

/**
 * Test to find what's intercepting touch events on the game page
 */

test.describe('Game Touch Interception', () => {

    test('check touchmove reception at page load before game starts', async ({ page }) => {
        // Navigate but DON'T start the game
        await page.goto('/');

        // Immediately add listeners BEFORE any game code can interfere
        await page.evaluate(() => {
            window.__earlyTouchEvents = [];

            ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                window.addEventListener(type, (e) => {
                    window.__earlyTouchEvents.push({
                        type,
                        target: e.target?.tagName,
                        targetId: e.target?.id,
                        defaultPrevented: e.defaultPrevented
                    });
                }, { capture: true, passive: true });
            });
        });

        await page.waitForSelector('#start-screen');

        // Touch on the start screen (not starting the game)
        const startBtn = await page.locator('#btn-new-game').boundingBox();
        const centerX = startBtn.x + startBtn.width / 2;
        const centerY = startBtn.y + startBtn.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: centerX, y: centerY, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: centerX + 20, y: centerY, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(30);

        const events = await page.evaluate(() => window.__earlyTouchEvents);
        console.log('Events at page load:', events);

        expect(events.some(e => e.type === 'touchstart')).toBe(true);
    });

    test('check touchmove on game-container specifically', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#start-screen');

        // Add listener specifically to game-container
        await page.evaluate(() => {
            window.__containerEvents = [];
            const container = document.getElementById('game-container');

            ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                container.addEventListener(type, (e) => {
                    window.__containerEvents.push({
                        type,
                        target: e.target?.tagName,
                        targetId: e.target?.id,
                        defaultPrevented: e.defaultPrevented,
                        cancelable: e.cancelable
                    });
                }, { capture: true, passive: true });
            });
        });

        // Touch on the game container area
        const container = await page.locator('#game-container').boundingBox();
        const x = container.x + 50;
        const y = container.y + 50;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 30, y: y + 30, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(30);

        const events = await page.evaluate(() => window.__containerEvents);
        console.log('Container events:', events);

        const touchstarts = events.filter(e => e.type === 'touchstart');
        const touchmoves = events.filter(e => e.type === 'touchmove');

        console.log('touchstart count:', touchstarts.length);
        console.log('touchmove count:', touchmoves.length);

        expect(touchstarts.length).toBeGreaterThan(0);
    });

    test('check if effects-canvas or overlays intercept touches', async ({ page }) => {
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

        // Check what elements are at the piece location
        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            const centerX = box.left + box.width / 2;
            const centerY = box.top + box.height / 2;

            // Get all elements at this point
            const elementsAtPoint = document.elementsFromPoint(centerX, centerY);

            return {
                centerX,
                centerY,
                elements: elementsAtPoint.map(el => ({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    pointerEvents: window.getComputedStyle(el).pointerEvents,
                    zIndex: window.getComputedStyle(el).zIndex
                }))
            };
        });

        console.log('Elements at piece center:', JSON.stringify(pieceInfo.elements, null, 2));

        // Check if any element has pointer-events: none that could affect hit testing
        // or if there's an invisible overlay
    });

    test('compare CDP touchmove on game vs on empty div', async ({ page }) => {
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

        // Add a test div outside game-container
        await page.evaluate(() => {
            const testDiv = document.createElement('div');
            testDiv.id = 'test-touch-div';
            testDiv.style.cssText = 'position:fixed;top:10px;right:10px;width:100px;height:100px;background:red;z-index:9999;touch-action:none;';
            document.body.appendChild(testDiv);

            window.__testDivEvents = [];
            window.__gameEvents = [];

            testDiv.addEventListener('touchstart', () => window.__testDivEvents.push('touchstart'), { passive: true });
            testDiv.addEventListener('touchmove', () => window.__testDivEvents.push('touchmove'), { passive: true });
            testDiv.addEventListener('touchend', () => window.__testDivEvents.push('touchend'), { passive: true });

            window.addEventListener('touchmove', () => window.__gameEvents.push('window:touchmove'), { capture: true, passive: true });
        });

        const client = await page.context().newCDPSession(page);

        // Test on the red test div
        const testDiv = await page.locator('#test-touch-div').boundingBox();
        const testX = testDiv.x + testDiv.width / 2;
        const testY = testDiv.y + testDiv.height / 2;

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: testX, y: testY, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: testX + 20, y: testY, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const results = await page.evaluate(() => ({
            testDivEvents: window.__testDivEvents,
            gameEvents: window.__gameEvents
        }));

        console.log('Test div events:', results.testDivEvents);
        console.log('Window events during test div touch:', results.gameEvents);

        // Reset
        await page.evaluate(() => {
            window.__testDivEvents = [];
            window.__gameEvents = [];
        });

        // Now test on the piece
        const pieceInfo = await page.evaluate(() => {
            const piece = window.game.pieces[0];
            const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
            const box = pieceEl.getBoundingClientRect();
            return {
                centerX: box.left + box.width / 2,
                centerY: box.top + box.height / 2
            };
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY, id: 2 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: pieceInfo.centerX, y: pieceInfo.centerY - 50, id: 2 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const pieceResults = await page.evaluate(() => ({
            gameEvents: window.__gameEvents
        }));

        console.log('Window events during piece touch:', pieceResults.gameEvents);

        expect(results.testDivEvents).toContain('touchmove');
    });
});
