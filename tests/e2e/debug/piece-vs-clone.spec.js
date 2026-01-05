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

test.describe('Piece vs Clone Investigation', () => {

    test('touch original piece vs its clone', async ({ page }) => {
        await startGame(page);

        // Setup: clone one piece and place both side by side
        const setup = await page.evaluate(() => {
            const originalPiece = document.querySelector('.piece');
            const originalRect = originalPiece.getBoundingClientRect();

            // Clone the piece
            const clonedPiece = originalPiece.cloneNode(true);
            clonedPiece.id = 'cloned-piece-test';
            clonedPiece.style.position = 'fixed';
            clonedPiece.style.left = (originalRect.left + 200) + 'px';
            clonedPiece.style.top = originalRect.top + 'px';
            clonedPiece.style.transform = 'none';
            clonedPiece.style.zIndex = '9999';
            document.body.appendChild(clonedPiece);

            window.__pieceTestLog = [];
            document.addEventListener('touchstart', (e) => {
                window.__pieceTestLog.push({
                    type: 'touchstart',
                    target: e.target?.id || e.target?.className,
                    isCloned: e.target?.closest('#cloned-piece-test') !== null
                });
            }, { capture: true, passive: true });
            document.addEventListener('touchmove', (e) => {
                window.__pieceTestLog.push({
                    type: 'touchmove',
                    target: e.target?.id || e.target?.className,
                    isCloned: e.target?.closest('#cloned-piece-test') !== null
                });
            }, { capture: true, passive: true });

            return {
                originalX: originalRect.left + originalRect.width / 2,
                originalY: originalRect.top + originalRect.height / 2,
                clonedX: originalRect.left + 200 + originalRect.width / 2,
                clonedY: originalRect.top + originalRect.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        // Test original piece
        console.log('=== Testing ORIGINAL piece ===');
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: setup.originalX, y: setup.originalY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: setup.originalX + 30, y: setup.originalY, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const afterOriginal = await page.evaluate(() => [...window.__pieceTestLog]);
        console.log('Events on original piece:', afterOriginal);

        // Clear log
        await page.evaluate(() => { window.__pieceTestLog = []; });

        // Test cloned piece
        console.log('=== Testing CLONED piece ===');
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: setup.clonedX, y: setup.clonedY, id: 2 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: setup.clonedX + 30, y: setup.clonedY, id: 2 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(50);

        const afterCloned = await page.evaluate(() => [...window.__pieceTestLog]);
        console.log('Events on cloned piece:', afterCloned);

        // Compare results
        const originalHasMove = afterOriginal.some(e => e.type === 'touchmove');
        const clonedHasMove = afterCloned.some(e => e.type === 'touchmove');
        console.log(`Original has touchmove: ${originalHasMove}`);
        console.log(`Cloned has touchmove: ${clonedHasMove}`);
    });

    test('same piece after moving to body', async ({ page }) => {
        await startGame(page);

        // Move original piece to body
        const setup = await page.evaluate(() => {
            const originalPiece = document.querySelector('.piece');
            const originalRect = originalPiece.getBoundingClientRect();

            // Move to body
            document.body.appendChild(originalPiece);
            originalPiece.style.position = 'fixed';
            originalPiece.style.left = originalRect.left + 'px';
            originalPiece.style.top = originalRect.top + 'px';
            originalPiece.style.transform = 'none';
            originalPiece.style.zIndex = '9999';

            window.__movedPieceLog = [];
            document.addEventListener('touchstart', (e) => {
                window.__movedPieceLog.push({ type: 'touchstart', target: e.target?.className });
            }, { capture: true, passive: true });
            document.addEventListener('touchmove', (e) => {
                window.__movedPieceLog.push({ type: 'touchmove', target: e.target?.className });
            }, { capture: true, passive: true });

            // Get new rect after moving
            const newRect = originalPiece.getBoundingClientRect();
            return {
                x: newRect.left + newRect.width / 2,
                y: newRect.top + newRect.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: setup.x, y: setup.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: setup.x + 30, y: setup.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const log = await page.evaluate(() => window.__movedPieceLog);
        console.log('Events on piece MOVED to body:', log);

        const hasMove = log.some(e => e.type === 'touchmove');
        console.log(`Has touchmove: ${hasMove}`);

        expect(hasMove).toBe(true);
    });

    test('piece still in dock-container', async ({ page }) => {
        await startGame(page);

        const setup = await page.evaluate(() => {
            const piece = document.querySelector('.piece');
            const rect = piece.getBoundingClientRect();

            window.__dockPieceLog = [];
            document.addEventListener('touchstart', (e) => {
                window.__dockPieceLog.push({ type: 'touchstart', target: e.target?.className });
            }, { capture: true, passive: true });
            document.addEventListener('touchmove', (e) => {
                window.__dockPieceLog.push({ type: 'touchmove', target: e.target?.className });
            }, { capture: true, passive: true });

            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: setup.x, y: setup.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: setup.x + 30, y: setup.y, id: 1 }]
        });
        await page.waitForTimeout(50);

        const log = await page.evaluate(() => window.__dockPieceLog);
        console.log('Events on piece IN DOCK:', log);

        const hasMove = log.some(e => e.type === 'touchmove');
        console.log(`Has touchmove: ${hasMove}`);
    });

    test('check if touchstart handler modifies DOM synchronously', async ({ page }) => {
        await startGame(page);

        // Add diagnostic to see what DOM changes happen during touchstart
        await page.evaluate(() => {
            window.__domChanges = [];
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    window.__domChanges.push({
                        type: m.type,
                        target: m.target?.id || m.target?.className,
                        attributeName: m.attributeName,
                        addedNodes: m.addedNodes.length,
                        removedNodes: m.removedNodes.length
                    });
                });
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        });

        const pieceInfo = await page.evaluate(() => {
            const piece = document.querySelector('.piece');
            const rect = piece.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        });

        const client = await page.context().newCDPSession(page);

        // Clear changes
        await page.evaluate(() => { window.__domChanges = []; });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: pieceInfo.x, y: pieceInfo.y, id: 1 }]
        });
        await page.waitForTimeout(100);

        const changes = await page.evaluate(() => window.__domChanges);
        console.log('DOM changes during touchstart:', JSON.stringify(changes, null, 2));
    });
});
