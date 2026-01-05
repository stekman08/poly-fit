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

test.describe('Container Position Tests', () => {

    test('CDP touchmove on element inside game-container', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const container = document.getElementById('game-container');

            // Create test element INSIDE game-container
            const testEl = document.createElement('div');
            testEl.id = 'test-inside';
            testEl.style.cssText = `
                position: fixed;
                left: 50%;
                top: 30%;
                width: 100px;
                height: 100px;
                background: blue;
                touch-action: none;
                z-index: 9999;
            `;
            container.appendChild(testEl);

            window.__insideEvents = [];
            window.addEventListener('touchmove', () => window.__insideEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('#test-inside').boundingBox();
        const x = el.x + el.width / 2;
        const y = el.y + el.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 30, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__insideEvents);
        console.log('Events on element INSIDE game-container:', events);

        expect(events).toContain('touchmove');
    });

    test('CDP touchmove on element outside game-container (body)', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Create test element OUTSIDE game-container (on body)
            const testEl = document.createElement('div');
            testEl.id = 'test-outside';
            testEl.style.cssText = `
                position: fixed;
                left: 50%;
                top: 30%;
                width: 100px;
                height: 100px;
                background: green;
                touch-action: none;
                z-index: 9999;
            `;
            document.body.appendChild(testEl);

            window.__outsideEvents = [];
            window.addEventListener('touchmove', () => window.__outsideEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('#test-outside').boundingBox();
        const x = el.x + el.width / 2;
        const y = el.y + el.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 30, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__outsideEvents);
        console.log('Events on element OUTSIDE game-container:', events);

        expect(events).toContain('touchmove');
    });

    test('CDP touchmove on piece moved to body before touch', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Move a piece from dock to body BEFORE any touch
            const piece = document.querySelector('.piece');
            const rect = piece.getBoundingClientRect();

            // Move to body
            document.body.appendChild(piece);

            // Keep position
            piece.style.position = 'fixed';
            piece.style.left = rect.left + 'px';
            piece.style.top = rect.top + 'px';
            piece.style.transform = 'none';  // Remove dock scale
            piece.style.zIndex = '9999';

            window.__movedPieceEvents = [];
            window.addEventListener('touchmove', () => window.__movedPieceEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('.piece').first().boundingBox();
        const x = el.x + el.width / 2;
        const y = el.y + el.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 30, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__movedPieceEvents);
        console.log('Events on piece moved to body:', events);

        expect(events).toContain('touchmove');
    });

    test('CDP touchmove on piece in piece-dock with no listeners', async ({ page }) => {
        await startGame(page);

        // Remove ALL listeners by cloning container
        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            window.__dockPieceEvents = [];
            window.addEventListener('touchmove', () => window.__dockPieceEvents.push('touchmove'), { capture: true, passive: true });
        });

        // Wait for piece to be available after cloning
        await page.waitForSelector('.piece');

        const el = await page.locator('.piece').first().boundingBox();
        const x = el.x + el.width / 2;
        const y = el.y + el.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 30, y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__dockPieceEvents);
        console.log('Events on piece in dock (no listeners):', events);

        // This might fail - isolating if issue is listeners or container
    });

    test('check game-container CSS properties', async ({ page }) => {
        await startGame(page);

        const containerCSS = await page.evaluate(() => {
            const container = document.getElementById('game-container');
            const style = window.getComputedStyle(container);
            return {
                overflow: style.overflow,
                touchAction: style.touchAction,
                pointerEvents: style.pointerEvents,
                contain: style.contain,
                isolation: style.isolation,
                willChange: style.willChange,
                position: style.position
            };
        });

        console.log('game-container CSS:', containerCSS);

        const dockCSS = await page.evaluate(() => {
            const dock = document.getElementById('piece-dock');
            const style = window.getComputedStyle(dock);
            return {
                overflow: style.overflow,
                touchAction: style.touchAction,
                pointerEvents: style.pointerEvents,
                contain: style.contain,
                isolation: style.isolation,
                willChange: style.willChange,
                position: style.position
            };
        });

        console.log('piece-dock CSS:', dockCSS);
    });
});
