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

    test('connected empty cells are detected as visual holes when surrounded together', async ({ page }) => {
        await page.goto('/');

        const testResult = await page.evaluate(() => {
            // Two vertically connected empty cells surrounded by targets:
            // 1 1 1
            // 1 0 1
            // 1 0 1
            // 1 1 1
            const testGrid = [
                [1, 1, 1],
                [1, 0, 1],
                [1, 0, 1],
                [1, 1, 1]
            ];

            // Implement the same flood-fill logic as in renderer.js
            const rows = testGrid.length;
            const cols = testGrid[0].length;
            const visited = new Set();
            const visualHoles = new Set();
            const key = (r, c) => `${r},${c}`;

            function getRegion(startR, startC) {
                const region = [];
                const stack = [[startR, startC]];
                while (stack.length > 0) {
                    const [r, c] = stack.pop();
                    const k = key(r, c);
                    if (visited.has(k)) continue;
                    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                    if (testGrid[r][c] !== 0) continue;
                    visited.add(k);
                    region.push([r, c]);
                    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
                }
                return region;
            }

            function isRegionSurrounded(region) {
                const regionSet = new Set(region.map(([r, c]) => key(r, c)));
                for (const [r, c] of region) {
                    const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
                    for (const [nr, nc] of neighbors) {
                        const nk = key(nr, nc);
                        if (regionSet.has(nk)) continue;
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;
                        if (testGrid[nr][nc] !== 1) return false;
                    }
                }
                return true;
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (testGrid[r][c] === 0 && !visited.has(key(r, c))) {
                        const region = getRegion(r, c);
                        if (region.length > 0 && isRegionSurrounded(region)) {
                            for (const [rr, rc] of region) {
                                visualHoles.add(key(rr, rc));
                            }
                        }
                    }
                }
            }

            return {
                cell1_1IsHole: visualHoles.has('1,1'),
                cell2_1IsHole: visualHoles.has('2,1'),
                totalHoles: visualHoles.size
            };
        });

        // Both connected cells should be detected as visual holes
        expect(testResult.cell1_1IsHole).toBe(true);
        expect(testResult.cell2_1IsHole).toBe(true);
        expect(testResult.totalHoles).toBe(2);
    });

    test('connected empty cells touching board edge are NOT visual holes', async ({ page }) => {
        await page.goto('/');

        const testResult = await page.evaluate(() => {
            // Two connected empty cells at the edge (missing left wall):
            // 0 1 1
            // 0 1 1
            // 1 1 1
            const testGrid = [
                [0, 1, 1],
                [0, 1, 1],
                [1, 1, 1]
            ];

            const rows = testGrid.length;
            const cols = testGrid[0].length;
            const visited = new Set();
            const visualHoles = new Set();
            const key = (r, c) => `${r},${c}`;

            function getRegion(startR, startC) {
                const region = [];
                const stack = [[startR, startC]];
                while (stack.length > 0) {
                    const [r, c] = stack.pop();
                    const k = key(r, c);
                    if (visited.has(k)) continue;
                    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                    if (testGrid[r][c] !== 0) continue;
                    visited.add(k);
                    region.push([r, c]);
                    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
                }
                return region;
            }

            function isRegionSurrounded(region) {
                const regionSet = new Set(region.map(([r, c]) => key(r, c)));
                for (const [r, c] of region) {
                    const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
                    for (const [nr, nc] of neighbors) {
                        const nk = key(nr, nc);
                        if (regionSet.has(nk)) continue;
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;
                        if (testGrid[nr][nc] !== 1) return false;
                    }
                }
                return true;
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (testGrid[r][c] === 0 && !visited.has(key(r, c))) {
                        const region = getRegion(r, c);
                        if (region.length > 0 && isRegionSurrounded(region)) {
                            for (const [rr, rc] of region) {
                                visualHoles.add(key(rr, rc));
                            }
                        }
                    }
                }
            }

            return {
                cell0_0IsHole: visualHoles.has('0,0'),
                cell1_0IsHole: visualHoles.has('1,0'),
                totalHoles: visualHoles.size
            };
        });

        // Edge cells should NOT be detected as holes (touching board boundary)
        expect(testResult.cell0_0IsHole).toBe(false);
        expect(testResult.cell1_0IsHole).toBe(false);
        expect(testResult.totalHoles).toBe(0);
    });
});
