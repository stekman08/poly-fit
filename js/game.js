
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
    }

    // Update position/state of a piece
    updatePieceState(id, newState) {
        const piece = this.pieces.find(p => p.id === id);
        if (!piece) return;

        let needsRecalc = false;

        if (newState.x !== undefined) piece.x = newState.x;
        if (newState.y !== undefined) piece.y = newState.y;
        if (newState.dockX !== undefined) piece.dockX = newState.dockX;
        if (newState.dockY !== undefined) piece.dockY = newState.dockY;

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
                // Determine grid coordinates
                // We assume piece.x/y are in Grid Units relative to targetGrid top-left
                // In the actual game, we'll need to snap visual coords to these grid coords.
                const gx = piece.x + block.x;
                const gy = piece.y + block.y;

                // Check bounds of the target grid
                // If a piece is outside, we can't be winning (unless target implies outside?)
                // Usually target is fully contained in the grid bounds.
                if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                    currentGrid[gy][gx] += 1;
                } else {
                    // Piece is strictly partly outside the bounds check area.
                    // Depending on game rules, this might be fail.
                    // But effectively, if it's outside, it won't match a target-1 cell, OR it's extraneous.
                    // Let's count it or track it.
                    // If we just ignore it, we might get a false positive if target is solved but extra piece is hiding outside?
                    // No, because we check ALL pieces must be used?
                    // "Ubongo" rules: fill the shape with exact set of pieces.
                    // So every block of every piece must be in a VALID target spot.
                    return false;
                }
            }
        }

        // 2. Compare currentGrid with targetGrid
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const targetVal = this.targetGrid[y][x];
                const currentVal = currentGrid[y][x];

                // Logic:
                // If target is 1 (hole), current must be 1.
                // If target is 0 (wall), current must be 0.
                // If current > 1 (overlap), Fail.

                if (currentVal > 1) return false; // Overlap
                if (targetVal === 1 && currentVal !== 1) return false; // Gap
                if (targetVal === 0 && currentVal !== 0) return false; // Piece sticking out
            }
        }

        return true;
    }
}
