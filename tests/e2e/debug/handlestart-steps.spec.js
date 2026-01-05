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

test.describe('HandleStart Step by Step', () => {

    test('step 1: set hasInteraction flag', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                // Step 1: Just set hasInteraction
                window.inputHandler.hasInteraction = true;
            }, { passive: true });

            window.__step1Events = [];
            window.addEventListener('touchmove', () => window.__step1Events.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__step1Events);
        console.log('Step 1 (set hasInteraction):', events);
        expect(events).toContain('touchmove');
    });

    test('step 2: set draggingPiece', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const ih = window.inputHandler;
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl && pieceEl.dataset.pieceId) {
                        ih.hasInteraction = true;
                        ih.draggingPiece = window.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                    }
                }
            }, { passive: true });

            window.__step2Events = [];
            window.addEventListener('touchmove', () => window.__step2Events.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__step2Events);
        console.log('Step 2 (set draggingPiece):', events);
        expect(events).toContain('touchmove');
    });

    test('step 3: set renderer.draggingPieceId', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const ih = window.inputHandler;
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl && pieceEl.dataset.pieceId) {
                        ih.hasInteraction = true;
                        ih.draggingPiece = window.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                        // Step 3: Also set renderer.draggingPieceId
                        ih.renderer.draggingPieceId = ih.draggingPiece?.id;
                    }
                }
            }, { passive: true });

            window.__step3Events = [];
            window.addEventListener('touchmove', () => window.__step3Events.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__step3Events);
        console.log('Step 3 (set renderer.draggingPieceId):', events);
        expect(events).toContain('touchmove');
    });

    test('step 4: call handleMove', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const ih = window.inputHandler;
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl && pieceEl.dataset.pieceId) {
                        ih.hasInteraction = true;
                        ih.draggingPiece = window.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                        ih.renderer.draggingPieceId = ih.draggingPiece?.id;
                        ih.dragOffset = { x: 0, y: 0 };
                        ih.visualDragOffset = 0;
                        // Step 4: Call handleMove
                        ih.handleMove(e, true);
                    }
                }
            }, { passive: true });

            window.__step4Events = [];
            window.addEventListener('touchmove', () => window.__step4Events.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__step4Events);
        console.log('Step 4 (call handleMove):', events);
        expect(events).toContain('touchmove');
    });

    test('step 5: call onInteraction (triggers draw)', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const ih = window.inputHandler;
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl && pieceEl.dataset.pieceId) {
                        ih.hasInteraction = true;
                        ih.draggingPiece = window.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
                        ih.renderer.draggingPieceId = ih.draggingPiece?.id;
                        ih.dragOffset = { x: 0, y: 0 };
                        ih.visualDragOffset = 0;
                        ih.handleMove(e, true);
                        // Step 5: Call onInteraction
                        ih.onInteraction();
                    }
                }
            }, { passive: true });

            window.__step5Events = [];
            window.addEventListener('touchmove', () => window.__step5Events.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__step5Events);
        console.log('Step 5 (call onInteraction):', events);
        expect(events).toContain('touchmove');
    });

    test('full handleStart call', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const oldContainer = document.getElementById('game-container');
            const newContainer = oldContainer.cloneNode(true);
            oldContainer.parentNode.replaceChild(newContainer, oldContainer);

            newContainer.addEventListener('touchstart', (e) => {
                const ih = window.inputHandler;
                const touch = e.changedTouches[0];
                // Call the actual handleStart
                ih.handleStart(e, true, touch.identifier);
            }, { passive: true });

            window.__fullHandleStartEvents = [];
            window.addEventListener('touchmove', () => window.__fullHandleStartEvents.push('touchmove'), { capture: true, passive: true });
        });

        await page.waitForSelector('.piece');
        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__fullHandleStartEvents);
        console.log('Full handleStart call:', events);
        expect(events).toContain('touchmove');
    });

    test('original touchstart without cloning (control)', async ({ page }) => {
        await startGame(page);

        // DON'T clone - keep original listeners
        await page.evaluate(() => {
            window.__originalControlEvents = [];
            window.addEventListener('touchmove', () => window.__originalControlEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('.piece').first().boundingBox();
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: el.x + el.width / 2, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: el.x + el.width / 2 + 30, y: el.y + el.height / 2, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__originalControlEvents);
        console.log('ORIGINAL (no clone) - control:', events);
        // This should fail to identify the issue is with original listener, not cloned
    });
});
