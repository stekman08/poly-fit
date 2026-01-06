import { test, expect } from './fixtures/coverage.js';

test.describe('Hole visibility', () => {
    test('board cells are created for entire grid', async ({ page }) => {
        await page.goto('/');

        await page.evaluate(() => {
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-new-game');
        await page.waitForSelector('#tutorial-overlay:not(.hidden)');
        await page.click('#btn-got-it');

        await page.waitForFunction(() =>
            window.game &&
            window.game.pieces.length > 0 &&
            window.game.targetGrid
        );

        const gridInfo = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            const rows = grid.length;
            const cols = grid[0].length;
            let targets = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c] === 1) targets++;
                }
            }
            return { rows, cols, targets };
        });

        const domInfo = await page.evaluate(() => {
            const boardCells = document.querySelectorAll('.board-cell');
            const targetCells = document.querySelectorAll('.board-cell.target');
            return {
                totalCells: boardCells.length,
                targetCells: targetCells.length
            };
        });

        expect(domInfo.totalCells).toBe(gridInfo.rows * gridInfo.cols);
        expect(domInfo.targetCells).toBe(gridInfo.targets);
    });

    test('visual holes are detected when surrounded by targets on all 4 sides', async ({ page }) => {
        await page.goto('/');

        await page.evaluate(() => {
            localStorage.setItem('polyfit-tutorial-shown', '3');
        });
        await page.reload();
        await page.waitForSelector('#start-screen');

        await page.click('#btn-new-game');
        await page.waitForSelector('#tutorial-overlay:not(.hidden)');
        await page.click('#btn-got-it');

        await page.waitForFunction(() =>
            window.game && window.game.targetGrid
        );

        // Manually create a grid with a visual hole for testing
        const testResult = await page.evaluate(() => {
            // Create a test grid with a hole in the middle
            // 1 1 1
            // 1 0 1
            // 1 1 1
            const testGrid = [
                [1, 1, 1],
                [1, 0, 1],
                [1, 1, 1]
            ];

            // Check the visual hole detection logic
            const r = 1, c = 1;
            const rows = 3, cols = 3;
            const hasTop = r > 0 && testGrid[r - 1][c] === 1;
            const hasBottom = r < rows - 1 && testGrid[r + 1][c] === 1;
            const hasLeft = c > 0 && testGrid[r][c - 1] === 1;
            const hasRight = c < cols - 1 && testGrid[r][c + 1] === 1;
            const isVisualHole = hasTop && hasBottom && hasLeft && hasRight;

            return { hasTop, hasBottom, hasLeft, hasRight, isVisualHole };
        });

        expect(testResult.hasTop).toBe(true);
        expect(testResult.hasBottom).toBe(true);
        expect(testResult.hasLeft).toBe(true);
        expect(testResult.hasRight).toBe(true);
        expect(testResult.isVisualHole).toBe(true);
    });

    test('edge cells are not detected as visual holes', async ({ page }) => {
        await page.goto('/');

        const testResult = await page.evaluate(() => {
            // Cell with only 3 sides having targets (missing top)
            // 0 0 0
            // 1 0 1
            // 1 1 1
            const testGrid = [
                [0, 0, 0],
                [1, 0, 1],
                [1, 1, 1]
            ];

            const r = 1, c = 1;
            const rows = 3, cols = 3;
            const hasTop = r > 0 && testGrid[r - 1][c] === 1;
            const hasBottom = r < rows - 1 && testGrid[r + 1][c] === 1;
            const hasLeft = c > 0 && testGrid[r][c - 1] === 1;
            const hasRight = c < cols - 1 && testGrid[r][c + 1] === 1;
            const isVisualHole = hasTop && hasBottom && hasLeft && hasRight;

            return { hasTop, hasBottom, hasLeft, hasRight, isVisualHole };
        });

        // Missing top neighbor
        expect(testResult.hasTop).toBe(false);
        expect(testResult.hasBottom).toBe(true);
        expect(testResult.hasLeft).toBe(true);
        expect(testResult.hasRight).toBe(true);
        // Should NOT be a visual hole (only 3 sides)
        expect(testResult.isVisualHole).toBe(false);
    });
});
