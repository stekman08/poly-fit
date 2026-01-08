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

test.describe('Piece Shape Rendering Bug', () => {
    test('each piece DOM should match its game state shape', async ({ page }) => {
        await startGame(page);

        // Compare each piece's DOM representation with its currentShape
        const mismatches = await page.evaluate(() => {
            const errors = [];
            for (const piece of window.game.pieces) {
                const el = document.querySelector(`[data-piece-id="${piece.id}"]`);
                if (!el) {
                    errors.push(`Piece ${piece.id}: no DOM element found`);
                    continue;
                }

                // Count visible blocks in DOM
                const domBlocks = el.querySelectorAll('.piece-block').length;
                const expectedBlocks = piece.currentShape.length;

                if (domBlocks !== expectedBlocks) {
                    errors.push(`Piece ${piece.id}: DOM has ${domBlocks} blocks, expected ${expectedBlocks}`);
                }
            }
            return errors;
        });

        expect(mismatches).toEqual([]);
    });

    test('pieces should render correctly after level transition', async ({ page }) => {
        await startGame(page);

        // Complete level 1 by placing all pieces correctly
        await page.evaluate(() => {
            for (const piece of window.game.pieces) {
                window.game.updatePieceState(piece.id, {
                    x: piece.solutionX,
                    y: piece.solutionY,
                    rotation: piece.effectiveRotation,
                    flipped: piece.effectiveFlipped
                });
            }
            window.triggerCheckWin();
        });

        // Wait for level 2 and pieces to be rendered
        await page.waitForFunction(() => window.getLevel() === 2, { timeout: 5000 });
        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0 &&
            document.querySelectorAll('.piece').length > 0
        );

        // Verify all pieces render with correct shape
        const mismatches = await page.evaluate(() => {
            const errors = [];
            for (const piece of window.game.pieces) {
                const el = document.querySelector(`[data-piece-id="${piece.id}"]`);
                if (!el) {
                    errors.push(`Piece ${piece.id}: no DOM element found`);
                    continue;
                }

                const domBlocks = el.querySelectorAll('.piece-block').length;
                const expectedBlocks = piece.currentShape.length;

                if (domBlocks !== expectedBlocks) {
                    errors.push(`Piece ${piece.id}: DOM has ${domBlocks} blocks, expected ${expectedBlocks}`);
                }
            }
            return errors;
        });

        expect(mismatches).toEqual([]);
    });
});
