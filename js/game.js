
import { rotateShape, flipShape, normalizeShape } from './shapes.js';

export class Game {
    constructor(puzzleData) {
        this.targetGrid = puzzleData.targetGrid;
        // Deep copy pieces to avoid mutating original puzzle data
        this.pieces = puzzleData.pieces.map(p => ({
            ...p,
            x: -100, // Initial off-screen position or specific holding area
            y: -100,
            rotation: 0,
            flipped: false,
            // We cache the transformed shape for rendering/collision
            currentShape: p.shape // Start with base shape
        }));

        // Hint state
        this.hintPiece = null;
        this.hintShape = null;
    }

    // Get a hint: find a piece not in correct position and show its solution
    getHint() {
        for (const piece of this.pieces) {
            // Check if piece is in correct position
            const inCorrectPosition =
                Math.round(piece.x) === piece.solutionX &&
                Math.round(piece.y) === piece.solutionY &&
                piece.rotation === piece.solutionRotation &&
                piece.flipped === piece.solutionFlipped;

            if (!inCorrectPosition) {
                // Calculate the solution shape
                let solutionShape = piece.originalShape;
                if (piece.solutionFlipped) {
                    solutionShape = flipShape(solutionShape);
                }
                for (let i = 0; i < piece.solutionRotation; i++) {
                    solutionShape = rotateShape(solutionShape);
                }
                solutionShape = normalizeShape(solutionShape);

                this.hintPiece = piece;
                this.hintShape = solutionShape;
                return {
                    piece,
                    x: piece.solutionX,
                    y: piece.solutionY,
                    shape: solutionShape,
                    color: piece.color
                };
            }
        }
        return null;
    }

    clearHint() {
        this.hintPiece = null;
        this.hintShape = null;
    }

    // Update position/state of a piece
    updatePieceState(id, newState) {
        const piece = this.pieces.find(p => p.id === id);
        if (!piece) return;

        let needsRecalc = false;

        if (newState.x !== undefined) piece.x = newState.x;
        if (newState.y !== undefined) piece.y = newState.y;

        if (newState.rotation !== undefined && newState.rotation !== piece.rotation) {
            piece.rotation = newState.rotation;
            needsRecalc = true;
        }

        if (newState.flipped !== undefined && newState.flipped !== piece.flipped) {
            piece.flipped = newState.flipped;
            needsRecalc = true;
        }

        // If rotation/flip changed, recalculate currentShape
        // We always start from the original 'shape' (base definition) and apply transforms
        if (needsRecalc) {
            let s = piece.shape; // Base

            // Apply flips first? Or rotations? Order matters for orientation but for tiling it just needs to be consistent.
            if (piece.flipped) s = flipShape(s);

            // Apply rotations
            for (let i = 0; i < (piece.rotation % 4); i++) {
                s = rotateShape(s);
            }

            // Normalize so 0,0 is top-left
            // This is important because x,y represents top-left of the bounding box
            piece.currentShape = normalizeShape(s);
        }
    }

    checkWin() {
        const rows = this.targetGrid.length;
        const cols = this.targetGrid[0].length;

        // Safety check: All pieces must be on the board (not in dock)
        // Dock area is y >= rows (typically y=6 for a 5-row board)
        for (const piece of this.pieces) {
            if (piece.y >= rows) {
                return false; // Piece still in dock
            }
        }

        // Create a blank grid to map current placements
        const currentGrid = Array(rows).fill(0).map(() => Array(cols).fill(0));

        // 1. Place all pieces onto currentGrid
        for (const piece of this.pieces) {
            const shape = piece.currentShape;

            for (const block of shape) {
                const gx = piece.x + block.x;
                const gy = piece.y + block.y;

                // Bounds check - all blocks must be within grid
                if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                    currentGrid[gy][gx] += 1;
                } else {
                    return false; // Part of piece outside board
                }
            }
        }

        // 2. Compare currentGrid with targetGrid
        // Grid values: -1 = hole (blocked), 0 = wall, 1 = valid target spot
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const targetVal = this.targetGrid[y][x];
                const currentVal = currentGrid[y][x];

                // Logic:
                // If target is 1 (valid spot), current must be exactly 1
                // If target is 0 (wall), current must be 0
                // If target is -1 (hole), current must be 0 (can't place on holes)
                // If current > 1 (overlap), Fail

                if (currentVal > 1) return false; // Overlap
                if (targetVal === 1 && currentVal !== 1) return false; // Gap in target
                if (targetVal === 0 && currentVal !== 0) return false; // Piece sticking out
                if (targetVal === -1 && currentVal !== 0) return false; // Piece on hole
            }
        }

        return true;
    }
}
