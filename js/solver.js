import { rotateShape, flipShape, normalizeShape } from './shapes.js';
import { createGrid } from './utils.js';

/**
 * optimized solver to count solutions for a given puzzle configuration
 */

// Cache for unique orientations to avoid re-computing during recursive calls
// Note: Cache size is naturally bounded by the number of unique shapes (~14)
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
    // NOTE: JavaScript bitwise ops use 32-bit signed integers, limiting to 31 pieces max.
    // Game currently caps at 7 pieces, so this is safe.
    const usedPiecesMask = 0;

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
        // No empty target cells - if pieces remain, placement failed
        return 0;
    }

    // Try to cover (fx, fy) with any unused piece
    let count = 0;

    for (let i = 0; i < pieces.length; i++) {
        if ((usedPiecesMask & (1 << i)) !== 0) continue;

        const piece = pieces[i];

        for (const shape of piece.orientations) {
            // Try to anchor the shape such that one of its blocks lands on (fx, fy)
            for (const block of shape) {
                // To place 'block' at (fx, fy), the shape top-left must be at:
                const startX = fx - block.x;
                const startY = fy - block.y;

                if (canPlaceShape(targetGrid, occupiedMask, shape, startX, startY)) {
                    placeShape(occupiedMask, shape, startX, startY, 1);

                    const newUsedMask = usedPiecesMask | (1 << i);
                    count += solveRecursive(targetGrid, pieces, newUsedMask, occupiedMask, limit - count, placedCount + 1);

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

        if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
        if (targetGrid[y][x] !== 1) return false;
        if (occupiedMask[y][x] !== 0) return false;
    }
    return true;
}

function placeShape(occupiedMask, shape, startX, startY, value) {
    for (const block of shape) {
        occupiedMask[startY + block.y][startX + block.x] = value;
    }
}
