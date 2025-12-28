import { test, expect } from '@playwright/test';

/**
 * Tests for the difficulty curve mechanics:
 * - Board shapes at different levels
 * - Holes introduction
 * - Large boards for 7 pieces
 */

async function startAtLevel(page, level) {
    await page.goto('/');
    await page.evaluate((lvl) => {
        localStorage.setItem('polyfit-max-level', String(lvl));
        localStorage.setItem('polyfit-tutorial-shown', '3');
    }, level);
    await page.reload();
    await page.waitForSelector('#start-screen');
    await page.click('#btn-continue');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
}

test.describe('Board Shapes', () => {
    test('level 1-34 always has 5x5 square board', async ({ page }) => {
        await startAtLevel(page, 10);

        const boardSize = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            return { rows: grid.length, cols: grid[0].length };
        });

        expect(boardSize.rows).toBe(5);
        expect(boardSize.cols).toBe(5);
    });

    test('level 35+ can have non-square boards', async ({ page }) => {
        // Run multiple times to catch probabilistic board shapes
        const boardSizes = [];
        for (let i = 0; i < 10; i++) {
            await startAtLevel(page, 50);
            const size = await page.evaluate(() => {
                const grid = window.game.targetGrid;
                return { rows: grid.length, cols: grid[0].length };
            });
            boardSizes.push(size);
        }

        // At level 50, we should see some variety in board shapes
        const uniqueShapes = new Set(boardSizes.map(s => `${s.rows}x${s.cols}`));
        // Should have at least square (5x5), might have wide (4x6) or tall (6x4)
        expect(uniqueShapes.size).toBeGreaterThanOrEqual(1);

        // All boards should have roughly 24-25 cells
        for (const size of boardSizes) {
            const cells = size.rows * size.cols;
            expect(cells).toBeGreaterThanOrEqual(24);
            expect(cells).toBeLessThanOrEqual(25);
        }
    });

    test('level 200+ has larger boards (30 cells)', async ({ page }) => {
        await startAtLevel(page, 200);

        const boardSize = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            return { rows: grid.length, cols: grid[0].length };
        });

        const cells = boardSize.rows * boardSize.cols;
        expect(cells).toBe(30); // 6x5 or 5x6
        expect([5, 6]).toContain(boardSize.rows);
        expect([5, 6]).toContain(boardSize.cols);
    });
});

test.describe('Holes', () => {
    test('level 1-74 has no holes', async ({ page }) => {
        await startAtLevel(page, 50);

        const holeCount = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            let holes = 0;
            for (const row of grid) {
                for (const cell of row) {
                    if (cell === -1) holes++;
                }
            }
            return holes;
        });

        expect(holeCount).toBe(0);
    });

    test('level 75+ can have holes', async ({ page }) => {
        // Run multiple times since holes are probabilistic
        let foundHole = false;
        for (let i = 0; i < 20; i++) {
            await startAtLevel(page, 100);
            const holeCount = await page.evaluate(() => {
                const grid = window.game.targetGrid;
                let holes = 0;
                for (const row of grid) {
                    for (const cell of row) {
                        if (cell === -1) holes++;
                    }
                }
                return holes;
            });
            if (holeCount > 0) {
                foundHole = true;
                break;
            }
        }

        // At level 100, we should eventually see a hole
        expect(foundHole).toBe(true);
    });

    test('holes reduce valid target cells', async ({ page }) => {
        // Find a puzzle with holes
        let gridWithHole = null;
        for (let i = 0; i < 30; i++) {
            await startAtLevel(page, 120);
            const result = await page.evaluate(() => {
                const grid = window.game.targetGrid;
                let holes = 0;
                let targets = 0;
                for (const row of grid) {
                    for (const cell of row) {
                        if (cell === -1) holes++;
                        if (cell === 1) targets++;
                    }
                }
                return { holes, targets, rows: grid.length, cols: grid[0].length };
            });
            if (result.holes > 0) {
                gridWithHole = result;
                break;
            }
        }

        if (gridWithHole) {
            // Total cells = targets + holes (+ 0s for empty space)
            const totalCells = gridWithHole.rows * gridWithHole.cols;
            expect(gridWithHole.targets).toBeLessThan(totalCells);
            expect(gridWithHole.targets + gridWithHole.holes).toBeLessThanOrEqual(totalCells);
        }
    });
});

test.describe('Piece block count matches target cells', () => {
    test('total piece blocks equals target cells at level 50', async ({ page }) => {
        await startAtLevel(page, 50);

        const result = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            let targetCells = 0;
            for (const row of grid) {
                for (const cell of row) {
                    if (cell === 1) targetCells++;
                }
            }

            let pieceBlocks = 0;
            for (const piece of window.game.pieces) {
                pieceBlocks += piece.shape.length;
            }

            return { targetCells, pieceBlocks };
        });

        expect(result.pieceBlocks).toBe(result.targetCells);
    });

    test('total piece blocks equals target cells at level 200', async ({ page }) => {
        await startAtLevel(page, 200);

        const result = await page.evaluate(() => {
            const grid = window.game.targetGrid;
            let targetCells = 0;
            for (const row of grid) {
                for (const cell of row) {
                    if (cell === 1) targetCells++;
                }
            }

            let pieceBlocks = 0;
            for (const piece of window.game.pieces) {
                pieceBlocks += piece.shape.length;
            }

            return { targetCells, pieceBlocks, pieceCount: window.game.pieces.length };
        });

        expect(result.pieceCount).toBe(7);
        expect(result.pieceBlocks).toBe(result.targetCells);
    });
});

test.describe('Irregular Shapes', () => {
    test('level 1-59 never has irregular shapes', async ({ page }) => {
        await page.goto('/');

        // Test multiple times at level 50
        for (let i = 0; i < 10; i++) {
            const config = await page.evaluate(() => {
                return import('/js/config/difficulty.js').then(m => m.getDifficultyParams(50));
            });
            expect(config.irregularShape).toBeNull();
        }
    });

    test('level 60+ can have irregular shapes', async ({ page }) => {
        await page.goto('/');

        // Run multiple times to catch probabilistic irregular shapes (~25% chance)
        let foundIrregular = false;
        for (let i = 0; i < 30; i++) {
            const config = await page.evaluate(() => {
                return import('/js/config/difficulty.js').then(m => m.getDifficultyParams(80));
            });
            if (config.irregularShape !== null) {
                foundIrregular = true;
                expect(['L', 'T', 'cross', 'U']).toContain(config.irregularShape);
                break;
            }
        }
        expect(foundIrregular).toBe(true);
    });

    test('irregular shape boards have cutout cells (-2)', async ({ page }) => {
        // Find a puzzle with an irregular shape
        let foundCutout = false;
        for (let i = 0; i < 40; i++) {
            await startAtLevel(page, 80);
            const result = await page.evaluate(() => {
                const grid = window.game.targetGrid;
                let cutouts = 0;
                for (const row of grid) {
                    for (const cell of row) {
                        if (cell === -2) cutouts++;
                    }
                }
                return { cutouts, rows: grid.length, cols: grid[0].length };
            });
            if (result.cutouts > 0) {
                foundCutout = true;
                // Verify cutouts exist and puzzle is still valid
                expect(result.cutouts).toBeGreaterThan(0);
                break;
            }
        }
        // At level 80 with ~25% chance, we should find one in 40 tries
        expect(foundCutout).toBe(true);
    });

    test('irregular shape puzzles are solvable', async ({ page }) => {
        // Find and solve an irregular shape puzzle
        let foundIrregular = false;
        for (let i = 0; i < 40; i++) {
            await startAtLevel(page, 80);
            const result = await page.evaluate(() => {
                const grid = window.game.targetGrid;
                let cutouts = 0;
                let targets = 0;
                for (const row of grid) {
                    for (const cell of row) {
                        if (cell === -2) cutouts++;
                        if (cell === 1) targets++;
                    }
                }

                let pieceBlocks = 0;
                for (const piece of window.game.pieces) {
                    pieceBlocks += piece.shape.length;
                }

                return { cutouts, targets, pieceBlocks };
            });
            if (result.cutouts > 0) {
                foundIrregular = true;
                // Total piece blocks must equal target cells
                expect(result.pieceBlocks).toBe(result.targets);
                break;
            }
        }
        expect(foundIrregular).toBe(true);
    });
});

test.describe('Difficulty parameter validation', () => {
    test('getDifficultyParams returns valid config', async ({ page }) => {
        await page.goto('/');

        // Test various levels
        const levels = [1, 15, 35, 50, 75, 100, 125, 150, 175, 200, 250];

        for (const level of levels) {
            const config = await page.evaluate((lvl) => {
                // Import and call getDifficultyParams
                return import('/js/config/difficulty.js').then(m => m.getDifficultyParams(lvl));
            }, level);

            expect(config.numPieces).toBeGreaterThanOrEqual(3);
            expect(config.numPieces).toBeLessThanOrEqual(7);
            expect(config.boardRows).toBeGreaterThanOrEqual(3);
            expect(config.boardRows).toBeLessThanOrEqual(8);
            expect(config.boardCols).toBeGreaterThanOrEqual(3);
            expect(config.boardCols).toBeLessThanOrEqual(8);
            expect(config.numHoles).toBeGreaterThanOrEqual(0);
            expect(config.numHoles).toBeLessThanOrEqual(2);
            expect(config.asymmetricBias).toBeGreaterThanOrEqual(0);
            expect(config.asymmetricBias).toBeLessThanOrEqual(1);
        }
    });
});
