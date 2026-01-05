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
    return await page.evaluate((idx) => {
        const game = window.game;
        if (!game) return null;
        const piece = game.pieces[idx];
        if (!piece) return null;

        const pieceEl = document.querySelector(`.piece[data-piece-id="${piece.id}"]`);
        if (!pieceEl) return null;

        const box = pieceEl.getBoundingClientRect();
        return {
            pieceId: piece.id,
            centerX: box.left + box.width / 2,
            centerY: box.top + box.height / 2,
            gridX: piece.x,
            gridY: piece.y
        };
    }, pieceIndex);
}

test.describe('Touchmove Debug', () => {

    test('debug: findTouchById and handleMove execution', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPieceInfo(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        // Inject extensive debugging into the input handler
        await page.evaluate(() => {
            window.__debugLog = [];

            const ih = window.inputHandler;

            // Wrap findTouchById
            const origFind = ih.findTouchById.bind(ih);
            ih.findTouchById = function(touchList, id) {
                const result = origFind(touchList, id);
                window.__debugLog.push({
                    method: 'findTouchById',
                    touchListLength: touchList?.length,
                    searchingForId: id,
                    foundTouch: !!result,
                    touchIds: touchList ? Array.from(touchList).map(t => t.identifier) : []
                });
                return result;
            };

            // Wrap handleMove
            const origMove = ih.handleMove.bind(ih);
            ih.handleMove = function(input, isTouch) {
                window.__debugLog.push({
                    method: 'handleMove:enter',
                    hasDraggingPiece: !!ih.draggingPiece,
                    inputType: input?.constructor?.name,
                    hasClientX: 'clientX' in (input || {}),
                    clientX: input?.clientX,
                    clientY: input?.clientY,
                    isTouch
                });

                const result = origMove(input, isTouch);

                const piece = ih.draggingPiece || window.game.pieces[0];
                window.__debugLog.push({
                    method: 'handleMove:exit',
                    pieceX: piece?.x,
                    pieceY: piece?.y
                });

                return result;
            };

            // Also spy on the touchmove listener
            const origHandler = ih.touchmoveHandler;
        });

        const result = await page.evaluate(async ({ startX, startY, endY, pieceId }) => {
            const pieceEl = document.querySelector(`.piece[data-piece-id="${pieceId}"]`);
            if (!pieceEl) return { error: 'No piece' };

            function createTouch(x, y, target) {
                return new Touch({
                    identifier: 42,
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

            // touchstart on piece
            const startTouch = createTouch(startX, startY, pieceEl);
            pieceEl.dispatchEvent(createTouchEvent('touchstart', startTouch));

            await new Promise(r => setTimeout(r, 50));

            const afterStart = {
                dragging: !!window.inputHandler?.draggingPiece,
                draggingPieceId: window.inputHandler?.draggingPiece?.id,
                activeTouchId: window.inputHandler?.activeTouchId,
                piecePos: (() => {
                    const p = window.game.pieces.find(p => p.id === pieceId);
                    return { x: p?.x, y: p?.y };
                })()
            };

            // One touchmove
            const moveTouch = createTouch(startX, endY, pieceEl);
            const moveEvent = createTouchEvent('touchmove', moveTouch);

            // Log the event structure
            const eventInfo = {
                type: moveEvent.type,
                touchesLength: moveEvent.touches?.length,
                touch0Identifier: moveEvent.touches?.[0]?.identifier,
                touch0ClientX: moveEvent.touches?.[0]?.clientX,
                touch0ClientY: moveEvent.touches?.[0]?.clientY
            };

            window.dispatchEvent(moveEvent);

            await new Promise(r => setTimeout(r, 50));

            const afterMove = {
                piecePos: (() => {
                    const p = window.game.pieces.find(p => p.id === pieceId);
                    return { x: p?.x, y: p?.y };
                })(),
                debugLog: window.__debugLog
            };

            // touchend
            const endTouch = createTouch(startX, endY, pieceEl);
            window.dispatchEvent(createTouchEvent('touchend', endTouch));

            return {
                afterStart,
                eventInfo,
                afterMove
            };
        }, {
            startX: pieceInfo.centerX,
            startY: pieceInfo.centerY,
            endY: boardBox.y + boardBox.height / 2,
            pieceId: pieceInfo.pieceId
        });

        console.log('Result:', JSON.stringify(result, null, 2));

        // Check the debug log
        expect(result.afterStart.dragging).toBe(true);

        // Check if findTouchById was called and found the touch
        const findCalls = result.afterMove.debugLog.filter(l => l.method === 'findTouchById');
        console.log('findTouchById calls:', findCalls);

        // Check if handleMove was called
        const moveCalls = result.afterMove.debugLog.filter(l => l.method?.startsWith('handleMove'));
        console.log('handleMove calls:', moveCalls);

        // The piece position should have changed
        expect(result.afterMove.piecePos.y).toBeLessThan(result.afterStart.piecePos.y);
    });

    test('debug: check TouchList iteration', async ({ page }) => {
        // Test if TouchList from synthetic events is iterable
        const result = await page.evaluate(() => {
            const target = document.body;
            const touch = new Touch({
                identifier: 99,
                target: target,
                clientX: 100,
                clientY: 200
            });

            const event = new TouchEvent('touchmove', {
                bubbles: true,
                cancelable: true,
                touches: [touch],
                changedTouches: [touch]
            });

            const touchList = event.touches;

            return {
                isArray: Array.isArray(touchList),
                length: touchList.length,
                hasItem: typeof touchList.item === 'function',
                indexAccess: touchList[0]?.identifier,
                itemAccess: touchList.item?.(0)?.identifier,
                constructorName: touchList.constructor?.name,
                // Try Array.from
                arrayFromWorks: (() => {
                    try {
                        const arr = Array.from(touchList);
                        return arr.length === 1 && arr[0].identifier === 99;
                    } catch (e) {
                        return false;
                    }
                })(),
                // Try for loop
                forLoopWorks: (() => {
                    try {
                        let found = false;
                        for (let i = 0; i < touchList.length; i++) {
                            if (touchList[i].identifier === 99) found = true;
                        }
                        return found;
                    } catch (e) {
                        return false;
                    }
                })()
            };
        });

        console.log('TouchList iteration test:', result);

        expect(result.length).toBe(1);
        expect(result.indexAccess).toBe(99);
        expect(result.forLoopWorks).toBe(true);
    });
});
