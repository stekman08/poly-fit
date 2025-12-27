
import { SHAPES, COLORS, rotateShape, flipShape, normalizeShape } from './shapes.js';

export function createGrid(rows = 6, cols = 6) {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
}

// Check if a piece (array of coords) can be placed at grid x,y
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

        // Check collision
        if (grid[y][x] !== 0) {
            return false; // Occupied
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

// Shuffle array in place (Fisher-Yates)
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

// Generate a solvable puzzle
export function generatePuzzle(numPieces = 3) {
    const MAX_RETRIES = 200;
    let retries = 0;
    const shapeKeys = Object.keys(SHAPES);

    while (retries < MAX_RETRIES) {
        const grid = createGrid(5, 5);
        const pieces = [];
        let success = true;

        // Shuffle shape order for variety
        const shuffledShapeKeys = shuffleArray([...shapeKeys]);

        for (let i = 0; i < numPieces; i++) {
            // Pick shape (cycle through shuffled list for variety)
            const shapeName = shuffledShapeKeys[i % shuffledShapeKeys.length];
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
            const verifyGrid = createGrid(5, 5);
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
                for (let y = 0; y < 5; y++) {
                    for (let x = 0; x < 5; x++) {
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
                                break findTransform;
                            }
                        }
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
