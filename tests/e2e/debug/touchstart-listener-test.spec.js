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

test.describe('Touchstart Listener Effect', () => {

    test('remove only container touchstart listener', async ({ page }) => {
        await startGame(page);

        // Clone only game-container to remove its touchstart listener
        // but keep the window touchmove/touchend listeners
        await page.evaluate(() => {
            // Get reference to input handler before cloning
            const ih = window.inputHandler;

            // Clone the container
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            // Update inputHandler's container reference
            ih.container = newContainer;

            // Re-add a simple touchstart listener to new container
            // but make it do NOTHING
            newContainer.addEventListener('touchstart', (e) => {
                // Do nothing at all
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

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events with empty touchstart:', events);

        // If this works, then having ANY touchstart listener (even empty) doesn't break touchmove
        expect(events).toContain('touchmove');
    });

    test('touch on piece-dock area (not piece)', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            window.__touchEvents = [];
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
        });

        // Get piece-dock coordinates but avoid pieces
        const dockInfo = await page.evaluate(() => {
            const dock = document.getElementById('piece-dock');
            const box = dock.getBoundingClientRect();
            // Touch the bottom-right corner which is likely empty
            return {
                x: box.right - 5,
                y: box.bottom - 5
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: dockInfo.x, y: dockInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: dockInfo.x + 30, y: dockInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events on dock (not piece):', events);

        expect(events).toContain('touchmove');
    });

    test('touch on game-board area', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            window.__touchEvents = [];
            window.addEventListener('touchmove', () => window.__touchEvents.push('touchmove'), { capture: true, passive: true });
        });

        const boardInfo = await page.evaluate(() => {
            const board = document.getElementById('game-board');
            const box = board.getBoundingClientRect();
            return {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: boardInfo.x, y: boardInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: boardInfo.x + 30, y: boardInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events on board:', events);

        expect(events).toContain('touchmove');
    });

    test('touch on piece element specifically', async ({ page }) => {
        await startGame(page);

        // Keep the original listeners but add our diagnostic
        await page.evaluate(() => {
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
        console.log('Events on piece:', events);

        // This is expected to fail - proving the issue is specific to pieces
    });

    test('remove touch-action from pieces and retry', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Remove touch-action: none from all pieces
            document.querySelectorAll('.piece').forEach(el => {
                el.style.touchAction = 'auto';
            });

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
        console.log('Events on piece with touch-action: auto:', events);

        expect(events).toContain('touchmove');
    });
});
