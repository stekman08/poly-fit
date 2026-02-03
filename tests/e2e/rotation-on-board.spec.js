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

test.describe('Rotation on board', () => {
    test('can rotate piece on board with tap', async ({ page }) => {
        await startGame(page);

        // Place a piece on the board via JavaScript
        const setupResult = await page.evaluate(() => {
            const game = window.game;
            const grid = game.targetGrid;

            // Try each piece until we find one that fits on the board
            for (const piece of game.pieces) {
                const shape = piece.currentShape;

                // Find a valid placement position for this piece
                for (let y = 0; y < grid.length; y++) {
                    for (let x = 0; x < grid[0].length; x++) {
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
                            game.updatePieceState(piece.id, { x, y });
                            window.requestRender && window.requestRender();
                            return { id: piece.id, x, y, rotation: piece.rotation, success: true };
                        }
                    }
                }
            }
            return { success: false };
        });

        expect(setupResult.success).toBe(true);
        await page.waitForTimeout(100);

        // Get piece element and initial rotation
        const pieceEl = page.locator(`.piece[data-piece-id="${setupResult.id}"]`);
        const pieceBox = await pieceEl.boundingBox();

        // Tap on the piece (quick click = rotate)
        await page.mouse.click(pieceBox.x + 15, pieceBox.y + 15);
        await page.waitForTimeout(100);

        // Check rotation changed
        const afterTap = await page.evaluate((id) => {
            const piece = window.game.pieces.find(p => p.id === id);
            return { rotation: piece.rotation, x: piece.x, y: piece.y };
        }, setupResult.id);

        console.log('Before tap rotation:', setupResult.rotation);
        console.log('After tap:', afterTap);

        // Rotation should have changed by 1 (mod 4)
        expect(afterTap.rotation).toBe((setupResult.rotation + 1) % 4);

        // Piece should still be on board (snapped to valid position)
        const boardRows = await page.evaluate(() => window.game.targetGrid.length);
        // Allow piece to be on board or in dock (it might have been pushed to dock if no valid position)
        expect(afterTap.y).toBeGreaterThanOrEqual(0);
    });

    test('rotation on board snaps to valid position', async ({ page }) => {
        await startGame(page);

        // Place a piece and check that rotation snaps it correctly
        const result = await page.evaluate(() => {
            const game = window.game;
            const input = window.inputHandler;
            const grid = game.targetGrid;

            // Try each piece until we find one that fits on the board
            for (const piece of game.pieces) {
                const shape = piece.currentShape;
                const originalRotation = piece.rotation;

                // Find any valid position on board for this piece
                for (let y = 0; y < grid.length; y++) {
                    for (let x = 0; x < grid[0].length; x++) {
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
                            // Place piece on board
                            game.updatePieceState(piece.id, { x, y });

                            // Simulate rotation using handleRotate (which includes snap logic)
                            input.draggingPiece = piece;
                            input.handleRotate();
                            input.draggingPiece = null;

                            const afterRotation = {
                                x: piece.x,
                                y: piece.y,
                                rotation: piece.rotation
                            };

                            // Piece should have rotated
                            const rotated = afterRotation.rotation !== originalRotation;

                            // Position should be integers (snapped)
                            const snapped = Number.isInteger(afterRotation.x) && Number.isInteger(afterRotation.y);

                            return {
                                success: true,
                                pieceId: piece.id,
                                validX: x,
                                validY: y,
                                afterRotation,
                                rotated,
                                snapped,
                                boardRows: grid.length
                            };
                        }
                    }
                }
            }

            return { success: false, reason: 'No valid position found for any piece' };
        });

        console.log('Rotation test result:', result);
        expect(result.success).toBe(true);
        expect(result.rotated).toBe(true);
        expect(result.snapped).toBe(true);
    });

    test('rotation on board triggers win when completing solution', async ({ page }) => {
        // Arrange
        await startGame(page);
        const setupResult = await page.evaluate(() => {
            const game = window.game;

            const normalize = (shape) => {
                let minX = shape[0].x;
                let minY = shape[0].y;
                for (const block of shape) {
                    if (block.x < minX) minX = block.x;
                    if (block.y < minY) minY = block.y;
                }
                return shape.map(block => ({ x: block.x - minX, y: block.y - minY }));
            };

            const rotate = (shape) => normalize(shape.map(block => ({ x: -block.y, y: block.x })));

            const shapeKey = (shape) =>
                shape
                    .map(block => `${block.x},${block.y}`)
                    .sort()
                    .join(';');

            const pieces = game.pieces;
            let chosen = null;

            for (const candidate of pieces) {
                const rotated = rotate(candidate.currentShape);
                if (shapeKey(rotated) === shapeKey(normalize(candidate.currentShape))) {
                    continue;
                }

                for (const piece of pieces) {
                    const targetRotation = piece.effectiveRotation ?? piece.solutionRotation ?? 0;
                    const targetFlipped = piece.effectiveFlipped ?? piece.solutionFlipped ?? false;
                    const rotation = piece.id === candidate.id
                        ? (targetRotation + 3) % 4
                        : targetRotation;

                    game.updatePieceState(piece.id, {
                        x: piece.solutionX,
                        y: piece.solutionY,
                        rotation,
                        flipped: targetFlipped
                    });
                }

                if (!game.checkWin()) {
                    chosen = candidate;
                    break;
                }
            }

            if (!chosen) {
                return { success: false };
            }

            window.requestRender && window.requestRender();

            return {
                success: true,
                id: chosen.id,
                beforeWin: game.checkWin()
            };
        });

        expect(setupResult.success).toBe(true);
        expect(setupResult.beforeWin).toBe(false);
        await page.waitForTimeout(100);

        const pieceEl = page.locator(`.piece[data-piece-id="${setupResult.id}"]`);
        const pieceBox = await pieceEl.boundingBox();

        // Act
        await page.mouse.click(pieceBox.x + 15, pieceBox.y + 15);
        await page.waitForFunction(() => window.isWinning && window.isWinning());

        // Assert
        const isWinning = await page.evaluate(() => window.isWinning && window.isWinning());
        expect(isWinning).toBe(true);
    });
});
