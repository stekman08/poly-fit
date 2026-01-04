import { SHAPES, COLORS, rotateShape, flipShape, normalizeShape } from './shapes.js';
import { GRID_ROWS, GRID_COLS } from './config/constants.js';
import { selectPiecesWithBias, IRREGULAR_SHAPES } from './config/difficulty.js';
import { countSolutions } from './solver.js';
import { shuffleArray, createGrid } from './utils.js';

export { createGrid };

// Grid cell values:
// -2 = outside (cutout, not part of board) - rendered as background
// -1 = hole (blocked, can't place pieces) - rendered as background
//  0 = empty (valid placement spot)
//  1 = piece placed / target spot
const HOLE_VALUE = -1;
const OUTSIDE_VALUE = -2;

/**
 * Apply irregular shape cutouts to a grid
 * Marks cutout cells as OUTSIDE_VALUE (-2)
 */
function applyIrregularShape(grid, shapeName) {
    if (!shapeName || !IRREGULAR_SHAPES[shapeName]) return;

    const shape = IRREGULAR_SHAPES[shapeName];
    for (const cutout of shape.cutouts) {
        if (cutout.y < grid.length && cutout.x < grid[0].length) {
            grid[cutout.y][cutout.x] = OUTSIDE_VALUE;
        }
    }
}

// Check if a piece (array of coords) can be placed at grid x,y
// Grid values: -1 = hole (blocked), 0 = empty, 1+ = piece placed
export function canPlacePiece(grid, shape, startX, startY) {
    const rows = grid.length;
    const cols = grid[0].length;

    for (const block of shape) {
        const x = startX + block.x;
        const y = startY + block.y;

        // Check boundaries
        if (x < 0 || x >= cols || y < 0 || y >= rows) {
            return false; // Out of bounds
        }

        // Check collision (0 = empty, anything else is occupied or hole)
        if (grid[y][x] !== 0) {
            return false; // Occupied or hole
        }
    }
    return true;
}

// Mark the grid with the piece
export function placePiece(grid, shape, startX, startY, value = 1) {
    for (const block of shape) {
        grid[startY + block.y][startX + block.x] = value;
    }
}

// Helper to get random item from array
function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Check if shape at position is adjacent to existing pieces
function isAdjacentToExisting(grid, shape, x, y) {
    const rows = grid.length;
    const cols = grid[0].length;
    for (const block of shape) {
        const bx = x + block.x;
        const by = y + block.y;
        // Check all 4 neighbors
        if (by > 0 && grid[by - 1][bx] === 1) return true;
        if (by < rows - 1 && grid[by + 1][bx] === 1) return true;
        if (bx > 0 && grid[by][bx - 1] === 1) return true;
        if (bx < cols - 1 && grid[by][bx + 1] === 1) return true;
    }
    return false;
}

// Find all valid placements for a shape on the grid
function findValidPlacements(grid, shape, requireAdjacent) {
    const rows = grid.length;
    const cols = grid[0].length;
    const placements = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (canPlacePiece(grid, shape, x, y)) {
                if (!requireAdjacent || isAdjacentToExisting(grid, shape, x, y)) {
                    placements.push({ x, y });
                }
            }
        }
    }
    return placements;
}

/**
 * Add holes to the interior of the puzzle area
 * Holes are placed away from edges to create interesting constraints
 */
function addHolesToGrid(grid, numHoles, occupiedCells) {
    if (numHoles === 0) return;

    const rows = grid.length;
    const cols = grid[0].length;

    // Find valid hole positions (not on edge, not occupied)
    const validPositions = [];
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            if (grid[y][x] === 0 && !occupiedCells.has(`${x},${y}`)) {
                validPositions.push({ x, y });
            }
        }
    }

    shuffleArray(validPositions);

    // Place holes, ensuring they don't touch each other (creates harder puzzles)
    const holes = [];
    for (const pos of validPositions) {
        if (holes.length >= numHoles) break;

        // Check that no adjacent cell is already a hole
        const hasAdjacentHole = holes.some(h =>
            Math.abs(h.x - pos.x) <= 1 && Math.abs(h.y - pos.y) <= 1
        );

        if (!hasAdjacentHole) {
            grid[pos.y][pos.x] = HOLE_VALUE;
            holes.push(pos);
        }
    }
}

/**
 * Generate a solvable puzzle with difficulty parameters
 * @param {Object} config - Difficulty configuration
 * @param {number} config.numPieces - Number of pieces (default: 3)
 * @param {number} config.boardRows - Board height (default: GRID_ROWS)
 * @param {number} config.boardCols - Board width (default: GRID_COLS)
 * @param {number} config.numHoles - Number of interior holes (default: 0)
 * @param {number} config.asymmetricBias - Bias toward hard pieces 0-1 (default: 0)
 * @param {string} config.irregularShape - Irregular board shape name (default: null)
 */
export function generatePuzzle(config = {}) {
    // Support legacy call: generatePuzzle(3) -> generatePuzzle({numPieces: 3})
    if (typeof config === 'number') {
        config = { numPieces: config };
    }

    const {
        numPieces = 3,
        boardRows = GRID_ROWS,
        boardCols = GRID_COLS,
        numHoles = 0,
        asymmetricBias = 0,
        irregularShape = null
    } = config;

    const MAX_RETRIES = 2000;
    let retries = 0;
    const shapeKeys = Object.keys(SHAPES);

    while (retries < MAX_RETRIES) {
        const grid = createGrid(boardRows, boardCols);

        // Apply irregular shape cutouts if specified
        if (irregularShape) {
            applyIrregularShape(grid, irregularShape);
        }

        const pieces = [];
        let success = true;

        // Select pieces based on difficulty bias
        const selectedShapes = selectPiecesWithBias(numPieces, asymmetricBias, shapeKeys);

        for (let i = 0; i < numPieces; i++) {
            const shapeName = selectedShapes[i];
            const baseShape = SHAPES[shapeName];

            // Try all 8 orientations (4 rotations × 2 flip states)
            const orientations = [];
            for (let flip = 0; flip < 2; flip++) {
                for (let rot = 0; rot < 4; rot++) {
                    let shape = baseShape;
                    if (flip === 1) shape = flipShape(shape);
                    for (let r = 0; r < rot; r++) shape = rotateShape(shape);
                    shape = normalizeShape(shape);
                    orientations.push({ shape, rotations: rot, flipped: flip === 1 });
                }
            }
            shuffleArray(orientations);

            let placed = false;

            // Try each orientation until we find one that fits
            for (const orient of orientations) {
                const placements = findValidPlacements(grid, orient.shape, i > 0);

                if (placements.length > 0) {
                    // Pick random valid placement
                    const pos = getRandom(placements);
                    placePiece(grid, orient.shape, pos.x, pos.y, 1);
                    pieces.push({
                        id: i,
                        shapeName,
                        originalShape: baseShape,
                        color: COLORS[i % COLORS.length],
                        shape: orient.shape,
                        solutionX: pos.x,
                        solutionY: pos.y,
                        solutionRotation: orient.rotations,
                        solutionFlipped: orient.flipped
                    });
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                success = false;
                break;
            }
        }

        if (success) {
            // Tightness Check for 6+ pieces (Level 125+)
            // Filter out puzzles with too many solutions ("loose" puzzles)
            if (numPieces >= 6) {
                // Ensure solution pieces have originalShape for solver
                const solverPieces = pieces.map(p => ({
                    originalShape: p.originalShape,
                    shapeName: p.shapeName
                }));

                // Max solutions allowed (Tightness threshold)
                // Level 125-199 (6 pieces): Tight limit (10) to ensure quality
                // Level 200+ (7 pieces): Relaxed limit (20) - Background worker allows more time for quality
                const MAX_SOLUTIONS = numPieces >= 7 ? 20 : 10;

                const count = countSolutions(grid, solverPieces, MAX_SOLUTIONS + 1);

                if (count > MAX_SOLUTIONS) {
                    // console.warn(`Puzzle too loose (${count} solutions), discarding. (Retries: ${retries})`);
                    retries++;
                    continue;
                }
            }
            // Collect occupied cells for hole placement
            const occupiedCells = new Set();
            for (let y = 0; y < boardRows; y++) {
                for (let x = 0; x < boardCols; x++) {
                    if (grid[y][x] === 1) {
                        occupiedCells.add(`${x},${y}`);
                    }
                }
            }

            // Add holes to empty spaces (not where pieces are)
            addHolesToGrid(grid, numHoles, occupiedCells);

            // Verify: target spots should equal total piece blocks
            let targetSpots = 0;
            for (const row of grid) {
                for (const cell of row) {
                    if (cell === 1) targetSpots++;
                }
            }
            let totalBlocks = pieces.reduce((sum, p) => sum + p.shape.length, 0);

            if (targetSpots !== totalBlocks) {
                console.error('Puzzle verification failed: target/blocks mismatch',
                    { targetSpots, totalBlocks });
                retries++;
                continue; // Try again
            }

            // CRITICAL: Verify the solution actually works by simulating placement
            // This catches bugs where the transformed shape doesn't match what we expect
            const verifyGrid = createGrid(boardRows, boardCols);

            // Copy holes and cutouts to verify grid
            for (let y = 0; y < boardRows; y++) {
                for (let x = 0; x < boardCols; x++) {
                    if (grid[y][x] === HOLE_VALUE || grid[y][x] === OUTSIDE_VALUE) {
                        verifyGrid[y][x] = grid[y][x];
                    }
                }
            }

            let solutionValid = true;

            for (const p of pieces) {
                // Reconstruct the solution shape from originalShape + transforms
                let solShape = SHAPES[p.shapeName];
                if (p.solutionFlipped) {
                    solShape = flipShape(solShape);
                }
                for (let r = 0; r < p.solutionRotation; r++) {
                    solShape = rotateShape(solShape);
                }
                solShape = normalizeShape(solShape);

                // Try to place at solution position
                if (!canPlacePiece(verifyGrid, solShape, p.solutionX, p.solutionY)) {
                    solutionValid = false;
                    break;
                }
                placePiece(verifyGrid, solShape, p.solutionX, p.solutionY, 1);
            }

            // Compare verifyGrid with original grid
            if (solutionValid) {
                for (let y = 0; y < boardRows; y++) {
                    for (let x = 0; x < boardCols; x++) {
                        if (grid[y][x] !== verifyGrid[y][x]) {
                            solutionValid = false;
                            break;
                        }
                    }
                    if (!solutionValid) break;
                }
            }

            if (!solutionValid) {
                console.error('Puzzle verification failed: solution does not recreate target grid');
                retries++;
                continue; // Try again
            }

            return {
                targetGrid: grid,
                boardRows,
                boardCols,
                pieces: pieces.map(p => {
                    // Randomize starting orientation to prevent pattern learning
                    const startRotation = Math.floor(Math.random() * 4);
                    const startFlipped = Math.random() < 0.5;

                    // Transform the base shape with random orientation
                    let startShape = p.originalShape;
                    if (startFlipped) {
                        startShape = flipShape(startShape);
                    }
                    for (let r = 0; r < startRotation; r++) {
                        startShape = rotateShape(startShape);
                    }
                    startShape = normalizeShape(startShape);

                    // Calculate the actual solution shape
                    let solutionShape = p.originalShape;
                    if (p.solutionFlipped) {
                        solutionShape = flipShape(solutionShape);
                    }
                    for (let r = 0; r < p.solutionRotation; r++) {
                        solutionShape = rotateShape(solutionShape);
                    }
                    solutionShape = normalizeShape(solutionShape);

                    // Find effectiveRotation and effectiveFlipped:
                    // transform(startShape, R, F) == solutionShape
                    let effectiveRotation = 0;
                    let effectiveFlipped = false;
                    let foundTransform = false;

                    findTransform:
                    for (let f = 0; f < 2; f++) {
                        for (let r = 0; r < 4; r++) {
                            let testShape = startShape;
                            if (f === 1) testShape = flipShape(testShape);
                            for (let i = 0; i < r; i++) testShape = rotateShape(testShape);
                            testShape = normalizeShape(testShape);

                            // Compare shapes (both normalized, so direct comparison works)
                            const match = testShape.length === solutionShape.length &&
                                testShape.every((b, idx) =>
                                    b.x === solutionShape[idx].x && b.y === solutionShape[idx].y
                                );

                            if (match) {
                                effectiveRotation = r;
                                effectiveFlipped = f === 1;
                                foundTransform = true;
                                break findTransform;
                            }
                        }
                    }

                    if (!foundTransform) {
                        throw new Error(`Could not find transform from start to solution for piece ${p.shapeName}`);
                    }

                    return {
                        ...p,
                        shape: startShape,
                        // Track initial orientation so Game can compute correct solution
                        startRotation,
                        startFlipped,
                        // Effective transform from startShape to solution
                        effectiveRotation,
                        effectiveFlipped
                    };
                })
            };
        }
        retries++;
    }

    throw new Error("Failed to generate puzzle after max retries");
}
