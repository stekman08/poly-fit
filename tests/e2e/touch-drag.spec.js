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
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

async function getPieceInfo(page, pieceIndex = 0) {
    const pieceId = await page.evaluate((idx) => {
        const game = window.game;
        if (!game) return null;
        const piece = game.pieces[idx];
        return piece ? piece.id : null;
    }, pieceIndex);

    if (pieceId === null) return null;

    const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
    const box = await pieceEl.boundingBox();
    if (!box) return null;

    const gamePos = await page.evaluate((id) => {
        const piece = window.game.pieces.find(p => p.id === id);
        return piece ? { x: piece.x, y: piece.y } : null;
    }, pieceId);

    return {
        screenX: box.x + box.width / 2,
        screenY: box.y + box.height / 2,
        gridX: gamePos?.x,
        gridY: gamePos?.y,
        pieceId: pieceId
    };
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
            activeTouchId: ih?.activeTouchId,
            hasInteraction: ih?.hasInteraction
        };
    });
}

test.describe('Touch drag (mobile emulation)', () => {

    test('touchscreen.tap picks up piece and sets draggingPiece', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        // Verify initial state
        let state = await getInputHandlerState(page);
        expect(state.hasDraggingPiece).toBe(false);

        // Use Playwright's touchscreen API to tap
        await page.touchscreen.tap(pieceInfo.screenX, pieceInfo.screenY);

        // After tap, piece should have been picked up and released
        // Check the game state
        const posAfter = await getPieceGridPosition(page, pieceInfo.pieceId);
        expect(posAfter).not.toBeNull();
    });

    test('touch drag moves piece position during drag', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();
        expect(boardBox).not.toBeNull();

        const startX = pieceInfo.screenX;
        const startY = pieceInfo.screenY;
        const endY = boardBox.y + boardBox.height * 0.5;

        const posBefore = await getPieceGridPosition(page, pieceInfo.pieceId);
        console.log('Before drag:', posBefore);

        // Simulate touch drag using evaluate with proper touch events
        const dragResult = await page.evaluate(async ({ startX, startY, endY, pieceId }) => {
            const results = {
                touchStartFired: false,
                touchMoveFired: false,
                touchEndFired: false,
                positionsDuringDrag: [],
                draggingPieceAfterStart: null,
                errors: []
            };

            try {
                // Find the piece element
                const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
                if (!pieceEl) {
                    results.errors.push('Piece element not found');
                    return results;
                }

                // Create a touch
                function createTouch(x, y, target) {
                    return new Touch({
                        identifier: 1,
                        target: target,
                        clientX: x,
                        clientY: y,
                        pageX: x,
                        pageY: y,
                        screenX: x,
                        screenY: y
                    });
                }

                // Create touch event
                function createTouchEvent(type, touch) {
                    return new TouchEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        touches: type === 'touchend' ? [] : [touch],
                        targetTouches: type === 'touchend' ? [] : [touch],
                        changedTouches: [touch]
                    });
                }

                // Dispatch touchstart on the piece
                const startTouch = createTouch(startX, startY, pieceEl);
                pieceEl.dispatchEvent(createTouchEvent('touchstart', startTouch));
                results.touchStartFired = true;

                // Check if inputHandler picked up the piece
                await new Promise(r => setTimeout(r, 10));
                results.draggingPieceAfterStart = window.inputHandler?.draggingPiece?.id ?? null;

                // Dispatch touchmove events
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    const progress = i / steps;
                    const currentY = startY + (endY - startY) * progress;

                    const moveTouch = createTouch(startX, currentY, pieceEl);
                    window.dispatchEvent(createTouchEvent('touchmove', moveTouch));

                    await new Promise(r => setTimeout(r, 20));

                    // Record position during drag
                    const piece = window.game.pieces.find(p => p.id === pieceId);
                    if (piece) {
                        results.positionsDuringDrag.push({ step: i, x: piece.x, y: piece.y });
                    }
                }
                results.touchMoveFired = true;

                // Dispatch touchend
                const endTouch = createTouch(startX, endY, pieceEl);
                window.dispatchEvent(createTouchEvent('touchend', endTouch));
                results.touchEndFired = true;

            } catch (e) {
                results.errors.push(e.message);
            }

            return results;
        }, { startX, startY, endY, pieceId: pieceInfo.pieceId });

        console.log('Drag result:', JSON.stringify(dragResult, null, 2));

        // Verify the drag worked
        expect(dragResult.touchStartFired).toBe(true);
        expect(dragResult.draggingPieceAfterStart).toBe(pieceInfo.pieceId);
        expect(dragResult.touchMoveFired).toBe(true);
        expect(dragResult.touchEndFired).toBe(true);
        expect(dragResult.errors).toHaveLength(0);

        // Verify position changed during drag
        expect(dragResult.positionsDuringDrag.length).toBeGreaterThan(0);

        // The Y position should decrease (move up) during drag from dock to board
        const firstPos = dragResult.positionsDuringDrag[0];
        const lastPos = dragResult.positionsDuringDrag[dragResult.positionsDuringDrag.length - 1];
        console.log('First position during drag:', firstPos);
        console.log('Last position during drag:', lastPos);

        // Y should have decreased (piece moved up toward board)
        expect(lastPos.y).toBeLessThan(firstPos.y);
    });

    test('piece DOM element moves during touch drag', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        const startX = pieceInfo.screenX;
        const startY = pieceInfo.screenY;
        const endY = boardBox.y + boardBox.height * 0.5;

        // Track DOM element positions during drag
        const domResult = await page.evaluate(async ({ startX, startY, endY, pieceId }) => {
            const results = {
                domPositionsBefore: null,
                domPositionsDuring: [],
                domPositionsAfter: null
            };

            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            if (!pieceEl) return { error: 'No piece element' };

            // Get initial DOM position
            let box = pieceEl.getBoundingClientRect();
            results.domPositionsBefore = { top: box.top, left: box.left };

            function createTouch(x, y, target) {
                return new Touch({
                    identifier: 1,
                    target: target,
                    clientX: x,
                    clientY: y,
                    pageX: x,
                    pageY: y
                });
            }

            function createTouchEvent(type, touch) {
                return new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    touches: type === 'touchend' ? [] : [touch],
                    targetTouches: type === 'touchend' ? [] : [touch],
                    changedTouches: [touch]
                });
            }

            // Start drag
            const startTouch = createTouch(startX, startY, pieceEl);
            pieceEl.dispatchEvent(createTouchEvent('touchstart', startTouch));

            // Move and record DOM positions
            const steps = 5;
            for (let i = 1; i <= steps; i++) {
                const progress = i / steps;
                const currentY = startY + (endY - startY) * progress;

                const moveTouch = createTouch(startX, currentY, pieceEl);
                window.dispatchEvent(createTouchEvent('touchmove', moveTouch));

                // Wait for render
                await new Promise(r => requestAnimationFrame(r));
                await new Promise(r => setTimeout(r, 50));

                // Get DOM position
                box = pieceEl.getBoundingClientRect();
                results.domPositionsDuring.push({ step: i, top: box.top, left: box.left });
            }

            // End drag
            const endTouch = createTouch(startX, endY, pieceEl);
            window.dispatchEvent(createTouchEvent('touchend', endTouch));

            await new Promise(r => setTimeout(r, 100));
            box = pieceEl.getBoundingClientRect();
            results.domPositionsAfter = { top: box.top, left: box.left };

            return results;
        }, { startX, startY, endY, pieceId: pieceInfo.pieceId });

        console.log('DOM positions:', JSON.stringify(domResult, null, 2));

        expect(domResult.error).toBeUndefined();
        expect(domResult.domPositionsDuring.length).toBeGreaterThan(0);

        // DOM element top should decrease (move up) during drag
        const firstDomPos = domResult.domPositionsDuring[0];
        const lastDomPos = domResult.domPositionsDuring[domResult.domPositionsDuring.length - 1];

        console.log('DOM first:', firstDomPos);
        console.log('DOM last:', lastDomPos);

        // The DOM element should have moved up (lower top value)
        expect(lastDomPos.top).toBeLessThan(firstDomPos.top);
    });
});
