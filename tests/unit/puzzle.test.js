
import { describe, it, expect } from 'vitest';
import { canPlacePiece, generatePuzzle, placePiece, createGrid } from '../../js/puzzle.js';
import { SHAPES, rotateShape, flipShape, normalizeShape } from '../../js/shapes.js';

describe('Puzzle Generation Logic', () => {

    describe('canPlacePiece', () => {
        it('should return true if piece fits in empty space', () => {
            const grid = createGrid(5, 5);
            // Place T shape at 0,0
            // T: (0,0), (1,0), (2,0), (1,1)
            const piece = SHAPES.T;
            expect(canPlacePiece(grid, piece, 0, 0)).toBe(true);
        });

        it('should return false if piece goes out of bounds', () => {
            const grid = createGrid(5, 5);
            const piece = SHAPES.Line4; // Length 4 vertical
            // Place at y=2. 2,3,4,5. 5 is out of bounds.
            expect(canPlacePiece(grid, piece, 0, 2)).toBe(false);
        });

        it('should return false if piece overlaps existing block', () => {
            const grid = createGrid(5, 5);
            // Occupy 1,1
            grid[1][1] = 1;

            // Try to place T at 0,0 (Start at 0,0 -> occupies 1,1)
            // T: (0,0), (1,0), (2,0), (1,1) <-- overlap
            const piece = SHAPES.T;
            expect(canPlacePiece(grid, piece, 0, 0)).toBe(false);
        });
    });

    describe('generatePuzzle', () => {
        it('should generate a puzzle with target shape and pieces', () => {
            // Generate a puzzle using 3 pieces
            const result = generatePuzzle({ numPieces: 3 });

            expect(result).toHaveProperty('targetGrid');
            expect(result).toHaveProperty('pieces');
            expect(result.pieces.length).toBe(3);

            // Verify checksum: The number of filled cells in targetGrid
            // must equal sum of blocks in all pieces.
            const totalTargetBlocks = result.targetGrid.flat().filter(cell => cell === 1).length;
            const totalPieceBlocks = result.pieces.reduce((sum, p) => sum + p.shape.length, 0);

            expect(totalTargetBlocks).toBe(totalPieceBlocks);
        });

        it('should generate puzzles where the solution actually works', () => {
            // Test multiple puzzles to catch intermittent bugs
            // Run 50 iterations to ensure all shapes (including W, Y) get tested
            for (let i = 0; i < 50; i++) {
                const numPieces = 3 + (i % 3); // 3, 4, or 5 pieces
                const result = generatePuzzle({ numPieces });

                // Recreate the solution by placing pieces at their solution positions
                const solutionGrid = createGrid(5, 5);

                for (const piece of result.pieces) {
                    // Transform originalShape to get solutionShape
                    let solShape = piece.originalShape;
                    if (piece.solutionFlipped) {
                        solShape = flipShape(solShape);
                    }
                    for (let r = 0; r < piece.solutionRotation; r++) {
                        solShape = rotateShape(solShape);
                    }
                    solShape = normalizeShape(solShape);

                    // Place on solution grid
                    for (const block of solShape) {
                        const x = piece.solutionX + block.x;
                        const y = piece.solutionY + block.y;
                        expect(y).toBeGreaterThanOrEqual(0);
                        expect(y).toBeLessThan(5);
                        expect(x).toBeGreaterThanOrEqual(0);
                        expect(x).toBeLessThan(5);
                        solutionGrid[y][x] += 1;
                    }
                }

                // Verify solution grid matches target grid exactly
                for (let y = 0; y < 5; y++) {
                    for (let x = 0; x < 5; x++) {
                        expect(solutionGrid[y][x]).toBe(result.targetGrid[y][x]);
                    }
                }
            }
        });
    });
});
