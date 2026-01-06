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

test.describe('Pickup from board bug', () => {
    test('piece should stay near cursor when picked up from board', async ({ page }) => {
        await startGame(page);

        // Step 1: Place a piece on the board via JavaScript (ensures valid placement)
        const setupResult = await page.evaluate(() => {
            const game = window.game;
            const piece = game.pieces[0];
            const grid = game.targetGrid;

            // Find a valid placement position
            const shape = piece.currentShape;
            let validX = -1, validY = -1;

            outer:
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[0].length; x++) {
                    // Check if all blocks of the shape fit at this position
                    let valid = true;
                    for (const block of shape) {
                        const bx = x + block.x;
                        const by = y + block.y;
                        if (by < 0 || by >= grid.length || bx < 0 || bx >= grid[0].length) {
                            valid = false;
                            break;
                        }
                        if (grid[by][bx] !== 1) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        validX = x;
                        validY = y;
                        break outer;
                    }
                }
            }

            if (validX >= 0) {
                game.updatePieceState(piece.id, { x: validX, y: validY });
                window.requestRender && window.requestRender();
                return { id: piece.id, x: validX, y: validY, success: true };
            }
            return { success: false, message: 'No valid position found' };
        });

        console.log('Setup result:', setupResult);
        expect(setupResult.success).toBe(true);
        await page.waitForTimeout(100);

        const boardBox = await page.locator('#game-board').boundingBox();
        const pieceEl = page.locator(`.piece[data-piece-id="${setupResult.id}"]`);
        const afterDrop = { x: setupResult.x, y: setupResult.y, id: setupResult.id };
        
        // Step 2: Get piece position on board
        const onBoardBox = await pieceEl.boundingBox();
        console.log('On board box:', onBoardBox);

        // Step 3: Pick up from board and drag right
        const pickX = onBoardBox.x + 15;
        const pickY = onBoardBox.y + 15;
        const moveX = pickX + 60; // Move ~1.5 cells right

        await page.mouse.move(pickX, pickY);
        await page.mouse.down();
        await page.mouse.move(moveX, pickY, { steps: 5 });

        // Check during drag - use the piece ID we captured
        const duringDrag = await page.evaluate((id) => {
            const piece = window.game.pieces.find(p => p.id === id);
            return piece ? { x: piece.x, y: piece.y } : null;
        }, afterDrop.id);
        const dragBox = await pieceEl.boundingBox();

        console.log('During drag pos:', duringDrag);
        console.log('During drag box:', dragBox);
        console.log('Expected X ~=', afterDrop.x + 1.5, 'Actual X:', duringDrag.x);

        await page.mouse.up();

        // The key assertions
        // X should have increased by about 1.5 (60px / 40px cell)
        const deltaX = duringDrag.x - afterDrop.x;
        console.log('Delta X:', deltaX, '(expected ~1.5)');
        expect(deltaX).toBeGreaterThan(0.5);
        expect(deltaX).toBeLessThan(3);

        // DOM position should be reasonably close to cursor
        const domDistFromCursor = Math.abs(dragBox.x - moveX);
        console.log('DOM distance from cursor:', domDistFromCursor);
        expect(domDistFromCursor).toBeLessThan(100);
    });
});
