// Module-level cache for occupancy during drag operations
let occupancyCache = null;

/**
 * Build occupancy cache for drag session.
 * Call once at drag start to avoid repeated Set construction.
 */
export function buildOccupancyCache(pieces, grid) {
    const rows = grid.length;
    occupancyCache = new Set();
    for (const piece of pieces) {
        for (const block of piece.currentShape) {
            const px = piece.x + block.x;
            const py = piece.y + block.y;
            if (py >= 0 && py < rows) {
                occupancyCache.add(`${px},${py}`);
            }
        }
    }
}

/**
 * Clear occupancy cache when drag ends.
 */
export function clearOccupancyCache() {
    occupancyCache = null;
}

export function isValidPlacement(shape, x, y, grid, otherPieces = []) {
    if (!grid || grid.length === 0 || !grid[0]) return false;
    if (!shape || shape.length === 0) return false; // Reject empty shapes

    const rows = grid.length;
    const cols = grid[0].length;

    let hasBlockOnBoard = false;
    let hasBlockOutsideBoard = false;

    // Use cached occupancy if available, otherwise build fresh
    let occupiedCells = null;
    if (otherPieces.length > 0) {
        if (occupancyCache) {
            occupiedCells = occupancyCache;
        } else {
            occupiedCells = new Set();
            for (const piece of otherPieces) {
                for (const block of piece.currentShape) {
                    const px = piece.x + block.x;
                    const py = piece.y + block.y;
                    if (py >= 0 && py < rows) {
                        occupiedCells.add(`${px},${py}`);
                    }
                }
            }
        }
    }

    for (const block of shape) {
        const bx = x + block.x;
        const by = y + block.y;

        if (by >= 0 && by < rows) {
            hasBlockOnBoard = true;
            if (bx < 0 || bx >= cols || grid[by][bx] !== 1) {
                return false;
            }
            if (occupiedCells?.has(`${bx},${by}`)) {
                return false;
            }
        } else {
            hasBlockOutsideBoard = true;
        }
    }

    // Valid placement requires ALL blocks to be on the board
    // Reject if any block is outside, or if no blocks are on board
    if (hasBlockOutsideBoard || !hasBlockOnBoard) {
        return false;
    }

    return true;
}
