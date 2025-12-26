import { bench, describe } from 'vitest';
import { generatePuzzle, canPlacePiece, placePiece, createGrid } from '../../js/puzzle.js';
import { SHAPES, rotateShape, flipShape, normalizeShape } from '../../js/shapes.js';

describe('Puzzle Generation Performance', () => {
    bench('generatePuzzle (3 pieces)', () => {
        generatePuzzle(3);
    });

    bench('generatePuzzle (4 pieces)', () => {
        generatePuzzle(4);
    });

    // Note: 5 pieces on 5x5 grid often fails - algorithm limitation
    // bench('generatePuzzle (5 pieces)', () => {
    //     generatePuzzle(5);
    // });

    bench('10 puzzles in sequence', () => {
        for (let i = 0; i < 10; i++) {
            generatePuzzle(3);
        }
    });
});

describe('Grid Operations Performance', () => {
    const grid = createGrid(5, 5);
    const lShape = SHAPES.L;

    bench('createGrid (5x5)', () => {
        createGrid(5, 5);
    });

    bench('createGrid (10x10)', () => {
        createGrid(10, 10);
    });

    bench('canPlacePiece - valid placement', () => {
        const emptyGrid = createGrid(5, 5);
        canPlacePiece(emptyGrid, lShape, 0, 0);
    });

    bench('canPlacePiece - boundary check', () => {
        const emptyGrid = createGrid(5, 5);
        canPlacePiece(emptyGrid, lShape, 4, 4);
    });

    bench('placePiece', () => {
        const freshGrid = createGrid(5, 5);
        placePiece(freshGrid, lShape, 0, 0, 1);
    });
});

describe('Shape Transformations Performance', () => {
    const lShape = SHAPES.L;
    const tShape = SHAPES.T;

    bench('rotateShape (L)', () => {
        rotateShape(lShape);
    });

    bench('flipShape (L)', () => {
        flipShape(lShape);
    });

    bench('normalizeShape (L)', () => {
        normalizeShape(lShape);
    });

    bench('full transform chain (flip + 3 rotations + normalize)', () => {
        let shape = lShape;
        shape = flipShape(shape);
        shape = rotateShape(shape);
        shape = rotateShape(shape);
        shape = rotateShape(shape);
        shape = normalizeShape(shape);
    });

    bench('all 4 rotations of T-shape', () => {
        let shape = tShape;
        for (let i = 0; i < 4; i++) {
            shape = rotateShape(shape);
            shape = normalizeShape(shape);
        }
    });
});

describe('Algorithm Complexity', () => {
    bench('worst case: many failed placements', () => {
        // Fill most of the grid to make placement hard
        const grid = createGrid(5, 5);
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 5; x++) {
                grid[y][x] = 1;
            }
        }
        // Try to place L-shape (will fail most places)
        const lShape = SHAPES.L;
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                canPlacePiece(grid, lShape, x, y);
            }
        }
    });

    bench('contiguity check simulation', () => {
        const grid = createGrid(5, 5);
        grid[2][2] = 1; // One piece already placed
        const shape = SHAPES.L;

        // Check adjacency for 25 positions
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                for (const block of shape) {
                    const bx = x + block.x;
                    const by = y + block.y;
                    if (by >= 0 && by < 5 && bx >= 0 && bx < 5) {
                        // Check neighbors
                        const hasNeighbor =
                            (grid[by - 1]?.[bx] === 1) ||
                            (grid[by + 1]?.[bx] === 1) ||
                            (grid[by]?.[bx - 1] === 1) ||
                            (grid[by]?.[bx + 1] === 1);
                    }
                }
            }
        }
    });
});
