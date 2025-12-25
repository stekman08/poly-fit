import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../../js/game.js';
import { SHAPES } from '../../js/shapes.js';

describe('Game - checkWin edge cases', () => {
    it('returns false when pieces overlap', () => {
        // Create a simple puzzle with 2 pieces
        const puzzleData = {
            targetGrid: [
                [1, 1, 0],
                [1, 1, 0],
                [0, 0, 0]
            ],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: '#ff0000' },
                { id: 1, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: '#00ff00' }
            ]
        };

        const game = new Game(puzzleData);

        // Place both pieces at same position (overlap)
        game.updatePieceState(0, { x: 0, y: 0 });
        game.updatePieceState(1, { x: 0, y: 0 });

        expect(game.checkWin()).toBe(false);
    });

    it('returns false when piece is on wall (0)', () => {
        const puzzleData = {
            targetGrid: [
                [1, 1, 0],
                [1, 0, 0],
                [0, 0, 0]
            ],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);

        // Place piece so one block lands on wall (position 1,1 is 0)
        game.updatePieceState(0, { x: 0, y: 0 });

        // This should fail because the piece shape covers (1,1) which is a wall
        // Actually let's check - shape is [{0,0}, {1,0}, {0,1}]
        // At position (0,0): blocks at (0,0), (1,0), (0,1) - all are 1s in grid
        // So this should pass. Let me create a failing case.

        // Move piece to position where it hits a wall
        game.updatePieceState(0, { x: 1, y: 0 });
        // Now blocks at (1,0), (2,0), (1,1)
        // (2,0) is 0 (wall), so should fail

        expect(game.checkWin()).toBe(false);
    });

    it('returns false when there are gaps in target', () => {
        const puzzleData = {
            targetGrid: [
                [1, 1, 1],
                [1, 1, 1],
                [0, 0, 0]
            ],
            pieces: [
                // Only 4 blocks, but target has 6 spots
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        game.updatePieceState(0, { x: 0, y: 0 });

        // Covers (0,0), (1,0), (0,1), (1,1) but target also needs (2,0), (2,1)
        expect(game.checkWin()).toBe(false);
    });

    it('returns true when puzzle is correctly solved', () => {
        const puzzleData = {
            targetGrid: [
                [1, 1, 0],
                [1, 1, 0],
                [0, 0, 0]
            ],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        game.updatePieceState(0, { x: 0, y: 0 });

        expect(game.checkWin()).toBe(true);
    });

    it('returns false when piece extends outside grid', () => {
        const puzzleData = {
            targetGrid: [
                [1, 1],
                [1, 1]
            ],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        game.updatePieceState(0, { x: 0, y: 0 });

        // Piece at (0,0) with shape extending to x=2, but grid is only 2 wide
        expect(game.checkWin()).toBe(false);
    });

    it('returns false when any piece is in dock area', () => {
        const puzzleData = {
            targetGrid: [
                [1, 1],
                [1, 1]
            ],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: '#ff0000' },
                { id: 1, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: '#00ff00' }
            ]
        };

        const game = new Game(puzzleData);
        game.updatePieceState(0, { x: 0, y: 0 });
        game.updatePieceState(1, { x: 0, y: 6 }); // In dock

        expect(game.checkWin()).toBe(false);
    });
});

describe('Game - piece state management', () => {
    it('updates currentShape when rotation changes', () => {
        const puzzleData = {
            targetGrid: [[1]],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        const originalShape = JSON.stringify(game.pieces[0].currentShape);

        game.updatePieceState(0, { rotation: 1 });
        const rotatedShape = JSON.stringify(game.pieces[0].currentShape);

        expect(rotatedShape).not.toBe(originalShape);
    });

    it('updates currentShape when flipped changes', () => {
        const puzzleData = {
            targetGrid: [[1]],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        const originalShape = JSON.stringify(game.pieces[0].currentShape);

        game.updatePieceState(0, { flipped: true });
        const flippedShape = JSON.stringify(game.pieces[0].currentShape);

        expect(flippedShape).not.toBe(originalShape);
    });

    it('4 rotations returns to original shape', () => {
        const puzzleData = {
            targetGrid: [[1]],
            pieces: [
                { id: 0, shape: SHAPES.L, color: '#ff0000' }
            ]
        };

        const game = new Game(puzzleData);
        const originalShape = JSON.stringify(game.pieces[0].currentShape);

        // Rotate 4 times
        game.updatePieceState(0, { rotation: 1 });
        game.updatePieceState(0, { rotation: 2 });
        game.updatePieceState(0, { rotation: 3 });
        game.updatePieceState(0, { rotation: 0 });

        const finalShape = JSON.stringify(game.pieces[0].currentShape);
        expect(finalShape).toBe(originalShape);
    });
});
