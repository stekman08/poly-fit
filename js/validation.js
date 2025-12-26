export function isValidPlacement(shape, x, y, grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    let hasBlockOnBoard = false;
    let hasBlockBelowBoard = false;

    for (const block of shape) {
        const bx = x + block.x;
        const by = y + block.y;

        if (by >= 0 && by < rows) {
            hasBlockOnBoard = true;
            if (bx < 0 || bx >= cols || grid[by][bx] !== 1) {
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
