
import { describe, it, expect } from 'vitest';
import { canPlacePiece, generatePuzzle, placePiece } from '../../js/puzzle.js';
import { SHAPES } from '../../js/shapes.js';

describe('Puzzle Generation Logic', () => {

    // Helper: Create an empty 5x5 grid
    function createGrid(size = 5) {
        return Array(size).fill(0).map(() => Array(size).fill(0));
    }

    describe('canPlacePiece', () => {
        it('should return true if piece fits in empty space', () => {
            const grid = createGrid(5);
            // Place T shape at 0,0
            // T: (0,0), (1,0), (2,0), (1,1)
            const piece = SHAPES.T;
            expect(canPlacePiece(grid, piece, 0, 0)).toBe(true);
        });

        it('should return false if piece goes out of bounds', () => {
            const grid = createGrid(5);
            const piece = SHAPES.Line4; // Length 4 vertical
            // Place at y=2. 2,3,4,5. 5 is out of bounds.
            expect(canPlacePiece(grid, piece, 0, 2)).toBe(false);
        });

        it('should return false if piece overlaps existing block', () => {
            const grid = createGrid(5);
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
            const result = generatePuzzle(3);

            expect(result).toHaveProperty('targetGrid');
            expect(result).toHaveProperty('pieces');
            expect(result.pieces.length).toBe(3);

            // Verify checksum: The number of filled cells in targetGrid
            // must equal sum of blocks in all pieces.
            const totalTargetBlocks = result.targetGrid.flat().filter(cell => cell === 1).length;
            const totalPieceBlocks = result.pieces.reduce((sum, p) => sum + p.shape.length, 0);

            expect(totalTargetBlocks).toBe(totalPieceBlocks);
        });
    });
});
