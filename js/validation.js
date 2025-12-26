export function isValidPlacement(shape, x, y, grid, otherPieces = []) {
    const rows = grid.length;
    const cols = grid[0].length;

    let hasBlockOnBoard = false;
    let hasBlockBelowBoard = false;

    const occupiedCells = new Set();
    for (const piece of otherPieces) {
        for (const block of piece.currentShape) {
            const px = piece.x + block.x;
            const py = piece.y + block.y;
            if (py >= 0 && py < rows) {
                occupiedCells.add(`${px},${py}`);
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
            if (occupiedCells.has(`${bx},${by}`)) {
                return false;
            }
        } else if (by >= rows) {
            hasBlockBelowBoard = true;
        }
    }

    if (hasBlockOnBoard && hasBlockBelowBoard) {
        return false;
    }

    return true;
}
