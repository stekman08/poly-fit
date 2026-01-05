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

test.describe('Piece Element Investigation', () => {

    test('create piece-like element and test CDP touch', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Create an element with same structure as piece
            const fakePiece = document.createElement('div');
            fakePiece.id = 'fake-piece';
            fakePiece.className = 'piece in-dock';  // Same classes as real piece
            fakePiece.style.cssText = `
                display: grid;
                grid-template-columns: repeat(2, 50px);
                grid-template-rows: repeat(2, 50px);
                gap: 1px;
                position: fixed;
                left: 50%;
                top: 30%;
                touch-action: none;
                user-select: none;
                cursor: grab;
                z-index: 9999;
                background: transparent;
            `;

            // Add child blocks
            for (let i = 0; i < 4; i++) {
                const block = document.createElement('div');
                block.className = 'piece-block';
                block.style.cssText = `
                    width: 50px;
                    height: 50px;
                    background: orange;
                    border: 2px solid white;
                `;
                fakePiece.appendChild(block);
            }

            document.body.appendChild(fakePiece);

            window.__fakePieceEvents = [];
            window.addEventListener('touchmove', () => window.__fakePieceEvents.push('touchmove'), { capture: true, passive: true });
        });

        const fakePiece = await page.locator('#fake-piece').boundingBox();
        const x = fakePiece.x + fakePiece.width / 2;
        const y = fakePiece.y + fakePiece.height / 2;

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

        const events = await page.evaluate(() => window.__fakePieceEvents);
        console.log('Events on fake piece:', events);

        expect(events).toContain('touchmove');
    });

    test('simple div with piece CSS but no children', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            const simpleEl = document.createElement('div');
            simpleEl.id = 'simple-piece';
            simpleEl.style.cssText = `
                position: fixed;
                left: 50%;
                top: 30%;
                width: 100px;
                height: 100px;
                background: green;
                touch-action: none;
                user-select: none;
                cursor: grab;
                z-index: 9999;
            `;
            document.body.appendChild(simpleEl);

            window.__simpleEvents = [];
            window.addEventListener('touchmove', () => window.__simpleEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('#simple-piece').boundingBox();
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

        const events = await page.evaluate(() => window.__simpleEvents);
        console.log('Events on simple element:', events);

        expect(events).toContain('touchmove');
    });

    test('check real piece element CSS that might cause issue', async ({ page }) => {
        await startGame(page);

        const pieceCSS = await page.evaluate(() => {
            const piece = document.querySelector('.piece');
            const style = window.getComputedStyle(piece);

            return {
                display: style.display,
                position: style.position,
                touchAction: style.touchAction,
                userSelect: style.userSelect,
                cursor: style.cursor,
                pointerEvents: style.pointerEvents,
                overflow: style.overflow,
                transform: style.transform,
                willChange: style.willChange,
                contain: style.contain,
                isolation: style.isolation
            };
        });

        console.log('Piece CSS:', pieceCSS);
    });

    test('clone real piece and test touch', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            // Clone a real piece and append to body
            const realPiece = document.querySelector('.piece');
            const clonedPiece = realPiece.cloneNode(true);
            clonedPiece.id = 'cloned-piece';
            clonedPiece.style.position = 'fixed';
            clonedPiece.style.left = '50%';
            clonedPiece.style.top = '30%';
            clonedPiece.style.zIndex = '9999';
            document.body.appendChild(clonedPiece);

            window.__clonedEvents = [];
            window.addEventListener('touchmove', () => window.__clonedEvents.push('touchmove'), { capture: true, passive: true });
        });

        const el = await page.locator('#cloned-piece').boundingBox();
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

        const events = await page.evaluate(() => window.__clonedEvents);
        console.log('Events on cloned piece:', events);

        // If this works, the original pieces have something specific
        expect(events).toContain('touchmove');
    });

    test('touch on piece-block child instead of piece', async ({ page }) => {
        await startGame(page);

        await page.evaluate(() => {
            window.__blockEvents = [];
            window.addEventListener('touchmove', () => window.__blockEvents.push('touchmove'), { capture: true, passive: true });
        });

        // Get position of a piece-block inside a piece
        const blockInfo = await page.evaluate(() => {
            const block = document.querySelector('.piece .piece-block');
            if (!block) return null;
            const box = block.getBoundingClientRect();
            return {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2
            };
        });

        expect(blockInfo).not.toBeNull();

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: blockInfo.x, y: blockInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: blockInfo.x + 30, y: blockInfo.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const events = await page.evaluate(() => window.__blockEvents);
        console.log('Events on piece-block:', events);
    });
});
