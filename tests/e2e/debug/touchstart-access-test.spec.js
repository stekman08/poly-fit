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

test.describe('Touchstart Event Access Tests', () => {

    test('touchstart that only accesses changedTouches', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const container = document.getElementById('game-container');

            // Clone to remove original listener
            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);

            // Add listener that accesses changedTouches
            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                window.__touchstartAccessed = {
                    identifier: touch.identifier,
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
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

        const accessed = await page.evaluate(() => window.__touchstartAccessed);
        console.log('Accessed in touchstart:', accessed);

        const events = await page.evaluate(() => window.__touchEvents);
        console.log('Events after accessing changedTouches:', events);

        expect(events).toContain('touchmove');
    });

    test('touchstart that modifies DOM', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const container = document.getElementById('game-container');
            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);

            // Add listener that modifies DOM
            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                // Simulate what our handler does - modify piece position
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        // Modify the piece's style
                        pieceEl.style.zIndex = '1000';
                        pieceEl.style.position = 'fixed';
                        pieceEl.style.left = touch.clientX + 'px';
                        pieceEl.style.top = touch.clientY + 'px';
                    }
                }
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
        console.log('Events after DOM modification:', events);

        // This might fail - DOM modification during touchstart could break touch tracking
    });

    test('touchstart that uses elementFromPoint', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const container = document.getElementById('game-container');
            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);

            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                // Just use elementFromPoint - no DOM modification
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                window.__hitElement = el?.tagName;
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
        console.log('Events after elementFromPoint:', events);

        expect(events).toContain('touchmove');
    });

    test('touchstart that changes piece parent', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const container = document.getElementById('game-container');
            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);

            newContainer.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) {
                    const pieceEl = el.closest('.piece');
                    if (pieceEl) {
                        // Move piece to body - this is what our original code did
                        document.body.appendChild(pieceEl);
                    }
                }
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
        console.log('Events after reparenting piece:', events);

        // This is expected to fail - reparenting during touchstart breaks touch tracking
    });
});
