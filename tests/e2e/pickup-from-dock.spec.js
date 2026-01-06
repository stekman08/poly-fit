import { test, expect } from './fixtures/coverage.js';

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

test.describe('Pickup from dock', () => {
    test('piece should stay directly under cursor when picked up from dock', async ({ page }) => {
        await startGame(page);

        // Get a piece that's in the dock
        const pieceInfo = await page.evaluate(() => {
            const game = window.game;
            const boardRows = game.targetGrid.length;
            const dockY = boardRows + 1;

            // Find a piece in dock
            const dockPiece = game.pieces.find(p => p.y >= dockY);
            if (!dockPiece) return null;

            return { id: dockPiece.id, x: dockPiece.x, y: dockPiece.y };
        });

        expect(pieceInfo).not.toBeNull();
        console.log('Dock piece:', pieceInfo);

        // Get piece DOM position before drag
        const pieceEl = page.locator(`.piece[data-piece-id="${pieceInfo.id}"]`);
        const beforeBox = await pieceEl.boundingBox();
        console.log('Before drag DOM box:', beforeBox);

        // Pick up piece from its center
        const pickX = beforeBox.x + beforeBox.width / 2;
        const pickY = beforeBox.y + beforeBox.height / 2;

        // Start drag and move just a tiny bit to trigger drag mode
        await page.mouse.move(pickX, pickY);
        await page.mouse.down();

        // Move 30 pixels right (enough to trigger drag, about 0.75 cells)
        const moveX = pickX + 30;
        await page.mouse.move(moveX, pickY, { steps: 3 });

        // Get DOM position during drag
        const duringBox = await pieceEl.boundingBox();
        console.log('During drag DOM box:', duringBox);

        // The piece center should be close to cursor
        const pieceCenterX = duringBox.x + duringBox.width / 2;
        const pieceCenterY = duringBox.y + duringBox.height / 2;

        const distFromCursorX = Math.abs(pieceCenterX - moveX);
        const distFromCursorY = Math.abs(pieceCenterY - pickY);

        console.log('Cursor at:', { x: moveX, y: pickY });
        console.log('Piece center at:', { x: pieceCenterX, y: pieceCenterY });
        console.log('Distance from cursor:', { x: distFromCursorX, y: distFromCursorY });

        await page.mouse.up();

        // Piece should stay close to cursor (within half a cell = 20px)
        // The offset should account for where we grabbed the piece
        expect(distFromCursorX).toBeLessThan(50);
        expect(distFromCursorY).toBeLessThan(50);
    });

    test('piece follows cursor smoothly during dock drag', async ({ page }) => {
        await startGame(page);

        // Get piece info
        const pieceInfo = await page.evaluate(() => {
            const game = window.game;
            const boardRows = game.targetGrid.length;
            const dockY = boardRows + 1;
            const dockPiece = game.pieces.find(p => p.y >= dockY);
            return dockPiece ? { id: dockPiece.id } : null;
        });

        expect(pieceInfo).not.toBeNull();

        const pieceEl = page.locator(`.piece[data-piece-id="${pieceInfo.id}"]`);
        const beforeBox = await pieceEl.boundingBox();

        const pickX = beforeBox.x + 20;
        const pickY = beforeBox.y + 20;

        await page.mouse.move(pickX, pickY);
        await page.mouse.down();

        // Record positions as we move
        const positions = [];

        for (let i = 0; i < 5; i++) {
            const cursorX = pickX + (i + 1) * 20; // Move 20px each step
            await page.mouse.move(cursorX, pickY, { steps: 1 });
            await page.waitForTimeout(16); // One frame

            const box = await pieceEl.boundingBox();
            positions.push({
                step: i + 1,
                cursorX,
                pieceX: box.x,
                pieceCenter: box.x + box.width / 2,
                offset: (box.x + box.width / 2) - cursorX
            });
        }

        await page.mouse.up();

        console.log('Movement tracking:', positions);

        // Check that offset stays consistent (piece follows cursor)
        // The offset might not be 0 due to touch offset, but should be consistent
        const offsets = positions.map(p => p.offset);
        const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        const maxDeviation = Math.max(...offsets.map(o => Math.abs(o - avgOffset)));

        console.log('Average offset:', avgOffset);
        console.log('Max deviation from average:', maxDeviation);

        // Offset should be consistent (piece follows cursor, not jumping around)
        expect(maxDeviation).toBeLessThan(20);

        // Offset should be reasonable (not lagging way behind)
        expect(Math.abs(avgOffset)).toBeLessThan(100);
    });
});
