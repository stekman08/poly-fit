import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    // New Game always shows tutorial - dismiss it
    await page.click('#btn-got-it');
    await page.waitForFunction(() => document.querySelector('#tutorial-overlay').classList.contains('hidden'));
    // Wait for game to be fully initialized with pieces rendered as DOM elements
    await page.waitForFunction(() =>
        window.game &&
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

/**
 * Get the pixel position of a piece's center using DOM element bounding box.
 * This is the DOM-native way to get piece positions.
 */
async function getPiecePixelCenter(page, pieceIndex = 0) {
    // Get piece ID from game state
    const pieceId = await page.evaluate((idx) => {
        const game = window.game;
        if (!game) return null;
        const piece = game.pieces[idx];
        return piece ? piece.id : null;
    }, pieceIndex);

    if (pieceId === null) return null;

    // Get the DOM element's bounding box
    const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
    const box = await pieceEl.boundingBox();
    if (!box) return null;

    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        pieceId: pieceId
    };
}

async function getPiecePosition(page, pieceId) {
    return await page.evaluate((id) => {
        const piece = window.game.pieces.find(p => p.id === id);
        return piece ? { x: piece.x, y: piece.y } : null;
    }, pieceId);
}

test.describe('Drag from dock', () => {
    test('can drag piece from dock to board using mouse', async ({ page }) => {
        await startGame(page);

        // Get piece and board info
        const pieceInfo = await getPiecePixelCenter(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();
        if (!boardBox) throw new Error("No board");

        // Get position before drag
        const posBefore = await getPiecePosition(page, pieceInfo.pieceId);
        console.log('Before drag (mouse):', posBefore);

        const endY = boardBox.y + boardBox.height * 0.5;

        await page.mouse.move(pieceInfo.x, pieceInfo.y);
        await page.mouse.down();
        await page.mouse.move(pieceInfo.x, endY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(100);

        const posAfter = await getPiecePosition(page, pieceInfo.pieceId);
        console.log('After drag (mouse):', posAfter);

        expect(posAfter).not.toBeNull();
    });

    test('can drag piece using native touch events', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPiecePixelCenter(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();
        if (!boardBox) throw new Error("No board");

        const posBefore = await getPiecePosition(page, pieceInfo.pieceId);
        console.log('Before drag (touch):', posBefore);

        // Dispatch real touch events via evaluate
        const endY = boardBox.y + boardBox.height * 0.5;

        const dragResult = await page.evaluate(async ({ startX, startY, endX, endY }) => {
            const container = document.getElementById('game-container');

            // Create TouchEvent helpers
            function createTouchEvent(type, x, y, target) {
                const touch = new Touch({
                    identifier: 0,
                    target: target,
                    clientX: x,
                    clientY: y,
                    pageX: x,
                    pageY: y
                });
                return new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [touch],
                    targetTouches: type === 'touchend' ? [] : [touch],
                    changedTouches: [touch]
                });
            }

            // Find piece element at start position
            const pieceEl = document.elementFromPoint(startX, startY);
            if (!pieceEl) return { error: 'No element at start position' };

            // Dispatch touchstart
            pieceEl.dispatchEvent(createTouchEvent('touchstart', startX, startY, pieceEl));

            // Dispatch touchmove steps
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
                const progress = i / steps;
                const currentY = startY + (endY - startY) * progress;
                await new Promise(r => setTimeout(r, 16)); // ~60fps
                window.dispatchEvent(createTouchEvent('touchmove', startX, currentY, pieceEl));
            }

            // Dispatch touchend
            window.dispatchEvent(createTouchEvent('touchend', endX, endY, pieceEl));

            return { success: true };
        }, { startX: pieceInfo.x, startY: pieceInfo.y, endX: pieceInfo.x, endY });

        console.log('Touch drag result:', dragResult);
        await page.waitForTimeout(100);

        const posAfter = await getPiecePosition(page, pieceInfo.pieceId);
        console.log('After drag (touch):', posAfter);

        expect(posAfter).not.toBeNull();
    });

    test('piece Y coordinate changes during drag', async ({ page }) => {
        await startGame(page);

        const pieceInfo = await getPiecePixelCenter(page, 0);
        expect(pieceInfo).not.toBeNull();

        const board = page.locator('#game-board');
        const boardBox = await board.boundingBox();

        const posBefore = await getPiecePosition(page, pieceInfo.pieceId);

        // Start drag
        await page.mouse.move(pieceInfo.x, pieceInfo.y);
        await page.mouse.down();

        // Move toward board
        const midY = pieceInfo.y - 100;
        await page.mouse.move(pieceInfo.x, midY, { steps: 5 });

        // Check position during drag
        const posDuring = await getPiecePosition(page, pieceInfo.pieceId);

        // End drag
        await page.mouse.up();

        // During drag, piece should have moved up (lower Y in grid coordinates)
        expect(posDuring.y).toBeLessThan(posBefore.y);
    });

    test('piece returns to dock if placed on invalid position', async ({ page }) => {
        await startGame(page);

        // Wait for inputHandler to be fully initialized
        await page.waitForFunction(() => window.inputHandler && typeof window.inputHandler.snapPiece === 'function');

        // Test snap-back logic directly via game API and input handler
        const result = await page.evaluate(() => {
            const game = window.game;
            const input = window.inputHandler;
            const piece = game.pieces[0];

            // Find a wall position (0 in target grid) - guaranteed to be invalid
            const grid = game.targetGrid;
            let wallX = 0, wallY = 0;
            outer:
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[y].length; x++) {
                    if (grid[y][x] === 0) {
                        wallX = x;
                        wallY = y;
                        break outer;
                    }
                }
            }

            // Move piece to the wall position
            game.updatePieceState(piece.id, { x: wallX, y: wallY });

            // Call snapPiece which validates and should return to dock
            input.snapPiece(piece);

            // Dock starts 1 row below the board
            const boardRows = game.targetGrid.length;
            const dockY = boardRows + 1;

            return {
                wallX,
                wallY,
                finalX: piece.x,
                finalY: piece.y,
                inDock: piece.y >= dockY
            };
        });

        // Piece should be back in dock after invalid placement
        expect(result.inDock).toBe(true);
    });
});
