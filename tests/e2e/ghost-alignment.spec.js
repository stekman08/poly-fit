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

test.describe('Ghost alignment', () => {
    test('ghost preview should align with piece snap position during drag', async ({ page }) => {
        await startGame(page);

        // Get a dock piece and set it to solution rotation, then get board info
        const setup = await page.evaluate(() => {
            const game = window.game;
            const piece = game.pieces[0];

            // Capture original dock position BEFORE any changes
            const originalX = piece.x;
            const originalY = piece.y;

            // Set piece to solution rotation/flip so it will fit
            game.updatePieceState(piece.id, {
                rotation: piece.effectiveRotation,
                flipped: piece.effectiveFlipped
            });

            const cellSize = window.renderer.cellSize;
            const boardRect = document.getElementById('game-board').getBoundingClientRect();

            // Calculate piece dimensions from shape
            const shape = piece.currentShape;
            const pieceW = Math.max(...shape.map(b => b.x)) + 1;
            const pieceH = Math.max(...shape.map(b => b.y)) + 1;

            return {
                pieceId: piece.id,
                originalX,
                originalY,
                solutionX: piece.solutionX,
                solutionY: piece.solutionY,
                pieceW,
                pieceH,
                cellSize,
                boardLeft: boardRect.left,
                boardTop: boardRect.top,
                boardRows: game.targetGrid.length,
                boardCols: game.targetGrid[0].length
            };
        });

        console.log('Setup:', setup);

        await page.waitForTimeout(50); // Wait for render after rotation

        // Get piece element
        const pieceEl = page.locator(`.piece[data-piece-id="${setup.pieceId}"]`);
        const pieceBox = await pieceEl.boundingBox();
        console.log('Piece box:', pieceBox);

        // Start drag from piece center - this is the "grab point"
        const grabOffsetX = pieceBox.width / 2;
        const grabOffsetY = pieceBox.height / 2;
        const startX = pieceBox.x + grabOffsetX;
        const startY = pieceBox.y + grabOffsetY;

        await page.mouse.move(startX, startY);
        await page.mouse.down();

        // Drag to SOLUTION position (guaranteed valid!)
        // The piece top-left should end up at (solutionX, solutionY)
        // So the GRAB POINT (center of piece) should end up at:
        //   (solutionX + pieceW/2, solutionY + pieceH/2) in grid coords
        // But wait - the grab offset in grid cells depends on piece dimensions
        const grabOffsetGridX = grabOffsetX / setup.cellSize;
        const grabOffsetGridY = grabOffsetY / setup.cellSize;

        // Target position: where grab point should go = piece origin + grab offset in grid
        const targetX = setup.boardLeft + (setup.solutionX + grabOffsetGridX) * setup.cellSize;
        const targetY = setup.boardTop + (setup.solutionY + grabOffsetGridY) * setup.cellSize;

        console.log('Grab offset (grid):', { x: grabOffsetGridX, y: grabOffsetGridY });
        console.log('Target (solution position):', { x: targetX, y: targetY, gridX: setup.solutionX, gridY: setup.solutionY });

        await page.mouse.move(targetX, targetY, { steps: 10 });
        await page.waitForTimeout(50);

        // Get piece position and ghost position
        const positions = await page.evaluate((pieceId) => {
            const piece = window.game.pieces.find(p => p.id === pieceId);
            const ghost = document.querySelector('.ghost-preview');
            const cellSize = window.renderer.cellSize;

            // Piece's current grid position (fractional during drag)
            const pieceGridX = piece.x;
            const pieceGridY = piece.y;

            // Snap position (what would be used for placement)
            const snapX = Math.round(pieceGridX);
            const snapY = Math.round(pieceGridY);

            // Ghost position (if visible)
            let ghostGridX = null;
            let ghostGridY = null;
            let ghostVisible = false;
            let ghostDisplay = null;

            if (ghost) {
                ghostDisplay = ghost.style.display;
                if (ghost.style.display !== 'none') {
                    ghostVisible = true;
                    const ghostLeft = parseFloat(ghost.style.left);
                    const ghostTop = parseFloat(ghost.style.top);
                    ghostGridX = ghostLeft / cellSize;
                    ghostGridY = ghostTop / cellSize;
                }
            }

            return {
                pieceGridX,
                pieceGridY,
                snapX,
                snapY,
                ghostGridX,
                ghostGridY,
                ghostVisible,
                ghostDisplay,
                cellSize
            };
        }, setup.pieceId);

        console.log('Positions during drag:', positions);

        await page.mouse.up();

        // Ghost MUST be visible when dragging to solution position
        expect(positions.ghostVisible).toBe(true);

        // Ghost should be at the snap position
        expect(positions.ghostGridX).toBe(positions.snapX);
        expect(positions.ghostGridY).toBe(positions.snapY);
    });

    test('ghost position should match where piece will be placed', async ({ page }) => {
        await startGame(page);

        // Get piece info
        const pieceId = await page.evaluate(() => window.game.pieces[0].id);
        const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
        const pieceBox = await pieceEl.boundingBox();

        // Get board position
        const boardBox = await page.locator('#game-board').boundingBox();
        const cellSize = await page.evaluate(() => window.renderer.cellSize);

        // Start drag
        await page.mouse.move(pieceBox.x + 20, pieceBox.y + 20);
        await page.mouse.down();

        // Move to a specific board position
        const targetGridX = 1;
        const targetGridY = 1;
        const targetPixelX = boardBox.x + targetGridX * cellSize + cellSize / 2;
        const targetPixelY = boardBox.y + targetGridY * cellSize + cellSize / 2;

        await page.mouse.move(targetPixelX, targetPixelY, { steps: 10 });
        await page.waitForTimeout(50);

        // Record ghost position before drop
        const ghostBeforeDrop = await page.evaluate(() => {
            const ghost = document.querySelector('.ghost-preview');
            if (!ghost || ghost.style.display === 'none') {
                return { visible: false };
            }
            const cellSize = window.renderer.cellSize;
            return {
                visible: true,
                gridX: parseFloat(ghost.style.left) / cellSize,
                gridY: parseFloat(ghost.style.top) / cellSize
            };
        });

        console.log('Ghost before drop:', ghostBeforeDrop);

        // Drop the piece
        await page.mouse.up();
        await page.waitForTimeout(50);

        // Get where piece actually landed
        const pieceAfterDrop = await page.evaluate((id) => {
            const piece = window.game.pieces.find(p => p.id === id);
            return { x: piece.x, y: piece.y };
        }, pieceId);

        console.log('Piece after drop:', pieceAfterDrop);

        // If ghost was visible, piece should land at ghost position
        if (ghostBeforeDrop.visible) {
            expect(pieceAfterDrop.x).toBe(ghostBeforeDrop.gridX);
            expect(pieceAfterDrop.y).toBe(ghostBeforeDrop.gridY);
        }
    });

    test('piece visual position should be near cursor during drag', async ({ page }) => {
        await startGame(page);

        const pieceId = await page.evaluate(() => window.game.pieces[0].id);
        const pieceEl = page.locator(`.piece[data-piece-id="${pieceId}"]`);
        const initialBox = await pieceEl.boundingBox();

        // Start drag from piece center
        const startX = initialBox.x + initialBox.width / 2;
        const startY = initialBox.y + initialBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();

        // Move 100px to the right and up
        const moveX = startX + 100;
        const moveY = startY - 100;
        await page.mouse.move(moveX, moveY, { steps: 5 });
        await page.waitForTimeout(50);

        // Get piece DOM position during drag
        const duringBox = await pieceEl.boundingBox();
        const pieceCenterX = duringBox.x + duringBox.width / 2;
        const pieceCenterY = duringBox.y + duringBox.height / 2;

        console.log('Cursor at:', { x: moveX, y: moveY });
        console.log('Piece center at:', { x: pieceCenterX, y: pieceCenterY });

        // The piece center should be reasonably close to cursor
        // Allow some offset for where we grabbed the piece
        const offsetX = Math.abs(pieceCenterX - moveX);
        const offsetY = Math.abs(pieceCenterY - moveY);

        console.log('Offset:', { x: offsetX, y: offsetY });

        await page.mouse.up();

        // Piece should follow cursor within reasonable tolerance
        // The offset should be consistent with where we grabbed it
        expect(offsetX).toBeLessThan(50);
        expect(offsetY).toBeLessThan(50);
    });
});
