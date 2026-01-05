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

test.describe('Touchstart Handler Isolation', () => {

    test('no touchstart listener at all', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Clone container to remove original listeners
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            // Don't add ANY touchstart listener

            window.__noListenerEvents = [];
            window.addEventListener('touchmove', () => window.__noListenerEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__noListenerEvents);
        console.log('NO touchstart listener:', events);

        expect(events).toContain('touchmove');
    });

    test('empty touchstart listener (passive)', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            // Add empty passive touchstart listener
            newContainer.addEventListener('touchstart', (e) => {
                // Do absolutely nothing
            }, { passive: true });

            window.__emptyEvents = [];
            window.addEventListener('touchmove', () => window.__emptyEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__emptyEvents);
        console.log('EMPTY passive touchstart listener:', events);

        expect(events).toContain('touchmove');
    });

    test('touchstart that only reads changedTouches', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                // Just access changedTouches
                const touch = e.changedTouches[0];
                window.__touchInfo = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
            }, { passive: true });

            window.__readOnlyEvents = [];
            window.addEventListener('touchmove', () => window.__readOnlyEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__readOnlyEvents);
        console.log('READ-ONLY touchstart (changedTouches):', events);

        expect(events).toContain('touchmove');
    });

    test('touchstart that uses elementFromPoint', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                // Call elementFromPoint - this might trigger reflow/repaint
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                window.__hitElement = el?.tagName;
            }, { passive: true });

            window.__elementFromPointEvents = [];
            window.addEventListener('touchmove', () => window.__elementFromPointEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__elementFromPointEvents);
        console.log('elementFromPoint in touchstart:', events);

        expect(events).toContain('touchmove');
    });

    test('touchstart that modifies piece style', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        // Modify the piece's style (like our handleStart does)
                        pieceEl.style.zIndex = '1000';
                        pieceEl.style.position = 'fixed';
                    }
                }
            }, { passive: true });

            window.__styleModifyEvents = [];
            window.addEventListener('touchmove', () => window.__styleModifyEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__styleModifyEvents);
        console.log('Style modification in touchstart:', events);

        // This might fail if style changes break touch tracking
    });

    test('touchstart that calls game.updatePieceState', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl && pieceEl.dataset.pieceId) {
                        const pieceId = pieceEl.dataset.pieceId;
                        const piece = window.game.pieces.find(p => String(p.id) === pieceId);
                        if (piece) {
                            // This calls renderer.draw() which updates all pieces
                            window.game.updatePieceState(piece.id, { x: piece.x, y: piece.y });
                        }
                    }
                }
            }, { passive: true });

            window.__updateStateEvents = [];
            window.addEventListener('touchmove', () => window.__updateStateEvents.push('touchmove'), { capture: true, passive: true });
        });

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

        const events = await page.evaluate(() => window.__updateStateEvents);
        console.log('updatePieceState in touchstart:', events);

        // This might fail if updatePieceState triggers something that breaks touch tracking
    });

    test('keep original touchstart listener, check what breaks touchmove', async ({ page }) => {
        await startGame(page);

        // Don't clone - keep original listener
        await page.evaluate(() => {
            window.__originalEvents = [];
            window.addEventListener('touchmove', () => window.__originalEvents.push('touchmove'), { capture: true, passive: true });
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

        const events = await page.evaluate(() => window.__originalEvents);
        console.log('ORIGINAL listeners (no clone):', events);

        // This is expected to fail - proving original listener is the issue
    });
});
