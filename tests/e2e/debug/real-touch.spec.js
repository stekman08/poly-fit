import { test, expect } from '@playwright/test';

/**
 * These tests use CDP (Chrome DevTools Protocol) for more realistic touch simulation
 * that goes through the browser's actual hit-testing, not synthetic dispatchEvent.
 */

async function startGame(page) {
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
}

async function getPieceScreenPosition(page, pieceIndex = 0) {
    return await page.evaluate((idx) => {
        const game = window.game;
        if (!game) return null;
        const piece = game.pieces[idx];
        if (!piece) return null;

        const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
        if (!pieceEl) return null;

        const box = pieceEl.getBoundingClientRect();

        // Return the CENTER of the visible (scaled) piece
        // Pieces in dock have transform: scale(0.5) with transform-origin: top left
        // So the visible center is at box.left + box.width/2, box.top + box.height/2
        return {
            pieceId: piece.id,
            // Bounding box (already accounts for transforms)
            boxLeft: box.left,
            boxTop: box.top,
            boxWidth: box.width,
            boxHeight: box.height,
            // Center of visible area
            centerX: box.left + box.width / 2,
            centerY: box.top + box.height / 2,
            // Game state
            gridX: piece.x,
            gridY: piece.y
        };
    }, pieceIndex);
}

async function getPieceGridPosition(page, pieceId) {
    return await page.evaluate((id) => {
        const piece = window.game.pieces.find(p => p.id === id);
        return piece ? { x: piece.x, y: piece.y } : null;
    }, pieceId);
}

async function getInputHandlerState(page) {
    return await page.evaluate(() => {
        const ih = window.inputHandler;
        return {
            hasDraggingPiece: !!ih?.draggingPiece,
            draggingPieceId: ih?.draggingPiece?.id ?? null,
            hasInteraction: ih?.hasInteraction ?? false
        };
    });
}

async function elementAtPoint(page, x, y) {
    return await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { found: false };

        const pieceEl = el.closest('.piece');
        return {
            found: true,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            isPiece: !!pieceEl,
            pieceId: pieceEl?.dataset.pieceId ?? null
        };
    }, { x, y });
}

// Use CDP for low-level touch events
async function cdpTouchStart(page, x, y) {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{
            x: Math.round(x),
            y: Math.round(y),
            id: 1
        }]
    });
    return client;
}

async function cdpTouchMove(client, x, y) {
    await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
            x: Math.round(x),
            y: Math.round(y),
            id: 1
        }]
    });
}

async function cdpTouchEnd(client, x, y) {
    await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [{
            x: Math.round(x),
            y: Math.round(y),
            id: 1
        }]
    });
}

test.describe('Real Touch via CDP', () => {

    test('elementFromPoint finds piece at its bounding box center', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceScreenPosition(page, 0);
        expect(pieceInfo).not.toBeNull();

        console.log('Piece info:', pieceInfo);

        // Check what element is at the piece center
        const atCenter = await elementAtPoint(page, pieceInfo.centerX, pieceInfo.centerY);
        console.log('Element at piece center:', atCenter);

        expect(atCenter.found).toBe(true);
        expect(atCenter.isPiece).toBe(true);
        expect(atCenter.pieceId).toBe(String(pieceInfo.pieceId));
    });

    test('CDP touchStart at piece center picks up piece', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceScreenPosition(page, 0);
        expect(pieceInfo).not.toBeNull();

        // Verify no piece is being dragged initially
        let state = await getInputHandlerState(page);
        expect(state.hasDraggingPiece).toBe(false);

        // Use CDP to send touchStart
        const client = await cdpTouchStart(page, pieceInfo.centerX, pieceInfo.centerY);

        // Small delay for event processing
        await page.waitForTimeout(50);

        // Check if piece was picked up
        state = await getInputHandlerState(page);
        console.log('State after touchStart:', state);

        // End the touch
        await cdpTouchEnd(client, pieceInfo.centerX, pieceInfo.centerY);

        expect(state.hasDraggingPiece).toBe(true);
        expect(state.draggingPieceId).toBe(pieceInfo.pieceId);
    });

    test('CDP touch drag moves piece position', async ({ page }) => {
        await startGame(page);

        // Inject diagnostics for touchmove
        await page.evaluate(() => {
            window.__touchmoveLog = [];
            window.addEventListener('touchmove', (e) => {
                const ih = window.inputHandler;
                window.__touchmoveLog.push({
                    timestamp: Date.now(),
                    touchCount: e.touches.length,
                    touchIds: Array.from(e.touches).map(t => t.identifier),
                    activeTouchId: ih?.activeTouchId,
                    hasDraggingPiece: !!ih?.draggingPiece,
                    firstTouchX: e.touches[0]?.clientX,
                    firstTouchY: e.touches[0]?.clientY
                });
            }, { capture: true });
        });

        const pieceInfo = await getPieceScreenPosition(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        const startX = pieceInfo.centerX;
        const startY = pieceInfo.centerY;
        const endY = boardBox.y + boardBox.height * 0.5;

        const posBefore = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position before drag:', posBefore);

        // Start touch
        const client = await cdpTouchStart(page, startX, startY);
        await page.waitForTimeout(30);

        // Check state after touchstart
        const stateAfterStart = await page.evaluate(() => ({
            activeTouchId: window.inputHandler?.activeTouchId,
            hasDraggingPiece: !!window.inputHandler?.draggingPiece
        }));
        console.log('State after touchStart:', stateAfterStart);

        // Move in steps
        const steps = 5;
        const positionsDuring = [];
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentY = startY + (endY - startY) * progress;

            await cdpTouchMove(client, startX, currentY);
            await page.waitForTimeout(50);

            const pos = await getPieceGridPosition(page, pieceInfo.pieceId);
            positionsDuring.push({ step: i, ...pos });
        }

        console.log('Positions during drag:', positionsDuring);

        // Check touchmove log
        const touchmoveLog = await page.evaluate(() => window.__touchmoveLog);
        console.log('Touchmove events received:', touchmoveLog.slice(0, 3)); // First 3

        // End touch
        await cdpTouchEnd(client, startX, endY);
        await page.waitForTimeout(50);

        const posAfter = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Position after drag:', posAfter);

        // Verify position changed during drag
        expect(positionsDuring.length).toBeGreaterThan(0);

        // Y should decrease as we drag up
        const firstPos = positionsDuring[0];
        const lastPos = positionsDuring[positionsDuring.length - 1];
        expect(lastPos.y).toBeLessThan(firstPos.y);
    });

    test('diagnose: what element receives touch at piece location', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceScreenPosition(page, 0);
        expect(pieceInfo).not.toBeNull();

        // Check multiple points around the piece
        const testPoints = [
            { name: 'center', x: pieceInfo.centerX, y: pieceInfo.centerY },
            { name: 'topLeft', x: pieceInfo.boxLeft + 5, y: pieceInfo.boxTop + 5 },
            { name: 'topRight', x: pieceInfo.boxLeft + pieceInfo.boxWidth - 5, y: pieceInfo.boxTop + 5 },
            { name: 'bottomLeft', x: pieceInfo.boxLeft + 5, y: pieceInfo.boxTop + pieceInfo.boxHeight - 5 },
            { name: 'bottomRight', x: pieceInfo.boxLeft + pieceInfo.boxWidth - 5, y: pieceInfo.boxTop + pieceInfo.boxHeight - 5 },
        ];

        console.log('Piece bounding box:', {
            left: pieceInfo.boxLeft,
            top: pieceInfo.boxTop,
            width: pieceInfo.boxWidth,
            height: pieceInfo.boxHeight
        });

        for (const point of testPoints) {
            const element = await elementAtPoint(page, point.x, point.y);
            console.log(`Element at ${point.name} (${point.x.toFixed(0)}, ${point.y.toFixed(0)}):`, element);
        }

        // All points should find the piece
        for (const point of testPoints) {
            const element = await elementAtPoint(page, point.x, point.y);
            expect(element.isPiece).toBe(true);
        }
    });

    test('diagnose: touch event reaches our handler', async ({ page }) => {
        await startGame(page);

        // Inject a spy on the touchstart handler
        await page.evaluate(() => {
            window.__touchstartLog = [];
            const container = document.getElementById('game-container');
            container.addEventListener('touchstart', (e) => {
                window.__touchstartLog.push({
                    timestamp: Date.now(),
                    targetTag: e.target.tagName,
                    targetClass: e.target.className,
                    targetId: e.target.id,
                    clientX: e.touches[0]?.clientX,
                    clientY: e.touches[0]?.clientY,
                    isPiece: !!e.target.closest('.piece'),
                    pieceId: e.target.closest('.piece')?.dataset.pieceId
                });
            }, { capture: true }); // Use capture to see event before our handler
        });

        const pieceInfo = await getPieceScreenPosition(page, 0);

        // Send touch via CDP
        const client = await cdpTouchStart(page, pieceInfo.centerX, pieceInfo.centerY);
        await page.waitForTimeout(50);
        await cdpTouchEnd(client, pieceInfo.centerX, pieceInfo.centerY);

        // Check what was logged
        const log = await page.evaluate(() => window.__touchstartLog);
        console.log('Touchstart events received:', log);

        expect(log.length).toBeGreaterThan(0);
        expect(log[0].isPiece).toBe(true);
    });
});
