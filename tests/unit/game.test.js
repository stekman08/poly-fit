
import { describe, it, expect } from 'vitest';
import { Game } from '../../js/game.js';
import { SHAPES } from '../../js/shapes.js';

describe('Game State', () => {

    // Mock puzzle data
    const mockPuzzle = {
        // A simple 2x1 target:
        // [1, 1]
        targetGrid: [
            [1, 1],
            [0, 0]
        ],
        pieces: [
            { id: 0, shape: SHAPES.Line3, color: 'red' }, // Too big, but let's assume we use it
            { id: 1, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: 'blue' } // A 2-block line that fits perfectly
        ]
    };

    it('should initialize with provided puzzle', () => {
        const game = new Game(mockPuzzle);
        expect(game.targetGrid).toEqual(mockPuzzle.targetGrid);
        expect(game.pieces).toHaveLength(2);

        // Pieces should have initial state (x,y=null or outside, rotation=0)
        expect(game.pieces[0]).toHaveProperty('x');
        expect(game.pieces[0]).toHaveProperty('rotation');
    });

    it('should update piece state', () => {
        const game = new Game(mockPuzzle);
        // Move piece 0 to 5,5
        game.updatePieceState(0, { x: 5, y: 5, rotation: 1 });

        expect(game.pieces[0].x).toBe(5);
        expect(game.pieces[0].y).toBe(5);
        expect(game.pieces[0].rotation).toBe(1);
    });

    it('checkWin should return true only when target is perfectly filled', () => {
        // Redefine a simpler game for this test
        // Target: 1 single cell at 0,0
        const simplePuzzle = {
            targetGrid: [[1]],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }] } // 1x1 block
            ]
        };
        const game = new Game(simplePuzzle);

        // Not placed yet
        expect(game.checkWin()).toBe(false);

        // Place correctly at 0,0 (assuming grid coordinates match)
        game.updatePieceState(0, { x: 0, y: 0, rotation: 0 });

        expect(game.checkWin()).toBe(true);
    });

    it('checkWin should fail if pieces overlap each other', () => {
        // Target: 2 cells [1, 1]
        const puzzle = {
            targetGrid: [[1, 1]],
            pieces: [
                { id: 0, shape: [{ x: 0, y: 0 }] },
                { id: 1, shape: [{ x: 0, y: 0 }] }  // Both are 1x1
            ]
        };
        const game = new Game(puzzle);

        // Place both at 0,0
        game.updatePieceState(0, { x: 0, y: 0 });
        game.updatePieceState(1, { x: 0, y: 0 });

        // Overlap -> Invalid
        expect(game.checkWin()).toBe(false);
    });

    it('checkWin should fail if piece is outside target area', () => {
        const simplePuzzle = {
            targetGrid: [[1]],
            pieces: [{ id: 0, shape: [{ x: 0, y: 0 }] }]
        };
        const game = new Game(simplePuzzle);
        // Place at 0,1 (valid grid coord, but target is 0)
        // targetGrid 1x1 only has (0,0).
        // A 1x1 grid relative to top-left.
        // Actually grid definitions are usually fixed size?
        // Let's assume infinite negative space is 0.

        game.updatePieceState(0, { x: 1, y: 0 });
        expect(game.checkWin()).toBe(false);
    });
});
