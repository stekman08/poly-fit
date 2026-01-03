
import { rotateShape, flipShape, normalizeShape } from './shapes.js';

/**
 * optimized solver to count solutions for a given puzzle configuration
 */

// Cache for unique orientations to avoid re-computing during recursive calls
const orientationCache = new Map();

/**
 * Get all unique orientations of a shape
 * @param {Array} baseShape - Array of blocks {x,y}
 * @returns {Array} Array of shape arrays
 */
function getUniqueOrientations(baseShape) {
    const sigKey = JSON.stringify(baseShape);
    if (orientationCache.has(sigKey)) {
        return orientationCache.get(sigKey);
    }

    const uniques = [];
    const seen = new Set();

    for (let f = 0; f < 2; f++) {
        for (let r = 0; r < 4; r++) {
            let s = baseShape;
            if (f) s = flipShape(s);
            for (let i = 0; i < r; i++) s = rotateShape(s);
            s = normalizeShape(s);

            const sig = JSON.stringify(s);
            if (!seen.has(sig)) {
                seen.add(sig);
                uniques.push(s);
            }
        }
    }

    orientationCache.set(sigKey, uniques);
    return uniques;
}

/**
 * Create a simple 2D array grid from dimensions
 */
function createGrid(rows, cols) {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
}

/**
 * Counts the number of valid solutions for a given puzzle configuration.
 *
 * @param {Array<Array<number>>} targetGrid - The target shape (1=valid, 0=hole/void)
 * @param {Array} pieces - Array of piece objects to place
 * @param {number} limit - Max solutions to find before stopping (optimization)
 * @returns {number} Number of solutions found (capped at limit)
 */
export function countSolutions(targetGrid, pieces, limit = 10) {
    const rows = targetGrid.length;
    const cols = targetGrid[0].length;
    const occupiedMask = createGrid(rows, cols);

    // Pre-calculate unique orientations for all pieces
    // Note: pieces here are the definitions from puzzle.js, need originalShape
    const solverPieces = pieces.map(p => ({
        orientations: getUniqueOrientations(p.originalShape || p.shape), // Fallback if originalShape missing
        name: p.shapeName
    }));

    // Mask for tracking used pieces (index based)
    const usedPiecesMask = 0; // Bitmask, supports up to 32 pieces (game max is much lower)

    return solveRecursive(targetGrid, solverPieces, usedPiecesMask, occupiedMask, limit, 0);
}

/**
 * Recursive backtracking core with "First Empty Cell" optimization
 */
function solveRecursive(targetGrid, pieces, usedPiecesMask, occupiedMask, limit, placedCount) {
    // Base case: All pieces placed
    if (placedCount === pieces.length) {
        return 1;
    }

    const rows = targetGrid.length;
    const cols = targetGrid[0].length;

    // Find the first empty cell that needs to be filled (targetGrid=1, occupiedMask=0)
    // Scanning top-to-bottom, left-to-right
    let fx = -1, fy = -1;
    let found = false;

    // We can iterate occupiedMask to find 0, AND check targetGrid is 1
    // Optimization: we could pass fx, fy from previous step, but grid changes.
    // Brute scan is fine for small grids.
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (targetGrid[y][x] === 1 && occupiedMask[y][x] === 0) {
                fx = x;
                fy = y;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (!found) {
        // No empty target cells left.
        // If we still have pieces to place, it's an invalid state (should cover all target cells)
        // Wait, does pieces area = target area?
        // Yes, usually. But if not, we can't place remaining pieces?
        // If placedCount < pieces.length, return 0.
        // However, standard Puzzles in this game: Target Area == Sum of Piece Areas.
        // So checking placedCount is sufficient?
        // Actually, if !found, it implies board is full.
        // If placedCount < pieces.length, we failed (pieces overlap or outside? no, occupiedMask handles overlap).
        // It means pieces left over.
        return 0;
    }

    // Try to cover (fx, fy) with any unused piece
    let count = 0;

    for (let i = 0; i < pieces.length; i++) {
        // If piece i is already used, skip
        if ((usedPiecesMask & (1 << i)) !== 0) continue;

        const piece = pieces[i];

        // Try all orientations of this piece
        for (const shape of piece.orientations) {
            // Try to anchor the shape such that one of its blocks lands on (fx, fy)
            for (const block of shape) {
                // To place 'block' at (fx, fy), the shape top-left must be at:
                const startX = fx - block.x;
                const startY = fy - block.y;

                // Valid placement?
                if (canPlaceShape(targetGrid, occupiedMask, shape, startX, startY)) {
                    // Place
                    placeShape(occupiedMask, shape, startX, startY, 1);

                    // Recurse
                    // Mark piece i as used
                    const newUsedMask = usedPiecesMask | (1 << i);
                    count += solveRecursive(targetGrid, pieces, newUsedMask, occupiedMask, limit - count, placedCount + 1);

                    // Backtrack
                    placeShape(occupiedMask, shape, startX, startY, 0);

                    if (count >= limit) return count;
                }
            }
        }
    }

    return count;
}

function canPlaceShape(targetGrid, occupiedMask, shape, startX, startY) {
    const rows = targetGrid.length;
    const cols = targetGrid[0].length;

    for (const block of shape) {
        const x = startX + block.x;
        const y = startY + block.y;

        // Bounds check
        if (x < 0 || x >= cols || y < 0 || y >= rows) return false;

        // Target shape check (must be on a '1')
        if (targetGrid[y][x] !== 1) return false;

        // Collision check
        if (occupiedMask[y][x] !== 0) return false;
    }
    return true;
}

function placeShape(occupiedMask, shape, startX, startY, value) {
    for (const block of shape) {
        occupiedMask[startY + block.y][startX + block.x] = value;
    }
}
