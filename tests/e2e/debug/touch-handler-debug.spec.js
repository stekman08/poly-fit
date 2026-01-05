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

test.describe('Touch Handler Debug', () => {

    test('defer updatePieces to next frame', async ({ page }) => {
        await startGame(page);

        // Temporarily patch the renderer to defer DOM updates
        await page.evaluate(() => {
            const renderer = window.game.renderer;
            const originalUpdatePieces = renderer.updatePieces.bind(renderer);

            renderer.updatePieces = function(pieces) {
                // Defer DOM updates to next frame
                requestAnimationFrame(() => {
                    originalUpdatePieces(pieces);
                });
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
        await page.waitForTimeout(100); // Wait for RAF

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
        console.log('Events with deferred updates:', events);

        expect(events).toContain('touchstart');
    });

    test('disable inputHandler completely', async ({ page }) => {
        await startGame(page);

        // Disable the input handler
        await page.evaluate(() => {
            // Remove all event listeners by cloning the container
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

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
        console.log('Events with input handler disabled:', events);

        expect(events).toContain('touchstart');
        expect(events).toContain('touchmove');
    });

    test('touch on piece with only passive listeners', async ({ page }) => {
        await startGame(page);

        // Remove the game's input handler listeners and add only passive ones
        await page.evaluate(() => {
            // We can't easily remove the existing listeners, but we can check
            // what happens when we touch a new element that has no listeners

            // Create a test piece-like element
            const testPiece = document.createElement('div');
            testPiece.id = 'test-piece';
            testPiece.style.cssText = `
                position: fixed;
                left: 50%;
                top: 50%;
                width: 80px;
                height: 80px;
                background: purple;
                touch-action: none;
                z-index: 9999;
            `;
            document.body.appendChild(testPiece);

            window.__testPieceEvents = [];
            testPiece.addEventListener('touchstart', () => window.__testPieceEvents.push('touchstart'), { passive: true });
            testPiece.addEventListener('touchmove', () => window.__testPieceEvents.push('touchmove'), { passive: true });
            testPiece.addEventListener('touchend', () => window.__testPieceEvents.push('touchend'), { passive: true });

            window.addEventListener('touchmove', () => window.__testPieceEvents.push('window:touchmove'), { capture: true, passive: true });
        });

        const testPiece = await page.locator('#test-piece').boundingBox();
        const centerX = testPiece.x + testPiece.width / 2;
        const centerY = testPiece.y + testPiece.height / 2;

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: centerX, y: centerY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: centerX + 30, y: centerY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__testPieceEvents);
        console.log('Test piece events:', events);

        expect(events).toContain('touchstart');
        expect(events).toContain('touchmove');
    });
});
