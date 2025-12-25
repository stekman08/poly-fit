
import { SHAPES, COLORS, rotateShape, normalizeShape } from './shapes.js';

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

// Generate a solvable puzzle
export function generatePuzzle(numPieces = 3) {
    const MAX_RETRIES = 100;
    let retries = 0;
    // Keys of SHAPES object
    const shapeKeys = Object.keys(SHAPES);

    while (retries < MAX_RETRIES) {
        const grid = createGrid(5, 5); // 5x5 area for constructing the target shape
        const pieces = [];
        let success = true;

        for (let i = 0; i < numPieces; i++) {
            // 1. Pick a random shape
            const shapeName = getRandom(shapeKeys);
            let shape = SHAPES[shapeName];

            // 2. Randomize rotation (0, 90, 180, 270)
            const rotations = Math.floor(Math.random() * 4);
            for (let r = 0; r < rotations; r++) shape = rotateShape(shape);
            // Normalize after rotation to ensure it's tight to 0,0
            shape = normalizeShape(shape);

            // 3. Try to place it
            let placed = false;

            // Optimization: If i > 0, we SHOULD try to be adjacent to existing pieces.
            // But checking every adjacency is complex. simpler:
            // Randomly pick a spot, check if it FITS (no collision) AND if it TOUCHES existing (i>0).

            for (let attempt = 0; attempt < 50; attempt++) {
                const x = Math.floor(Math.random() * 5);
                const y = Math.floor(Math.random() * 5);

                if (canPlacePiece(grid, shape, x, y)) {
                    // Contiguity check:
                    let isContiguous = false;
                    if (i === 0) {
                        isContiguous = true; // First piece always OK
                    } else {
                        // Check if any block of current shape is adjacent to a '1' in grid
                        for (const block of shape) {
                            const bx = x + block.x;
                            const by = y + block.y;
                            // Check neighbors
                            if ((grid[by - 1] && grid[by - 1][bx] === 1) ||
                                (grid[by + 1] && grid[by + 1][bx] === 1) ||
                                (grid[by][bx - 1] === 1) ||
                                (grid[by][bx + 1] === 1)) {
                                isContiguous = true;
                                break;
                            }
                        }
                    }

                    if (isContiguous) {
                        placePiece(grid, shape, x, y, 1);
                        pieces.push({
                            id: i,
                            shapeName,
                            originalShape: SHAPES[shapeName],
                            color: COLORS[i % COLORS.length],
                            shape: shape
                        });
                        placed = true;
                        break;
                    }
                }
            }

            if (!placed) {
                success = false;
                break; // Restart generation
            }
        }

        if (success) {
            // Check if the resulting shape is contiguous?
            // Ubongo puzzles are usually one blob, but disjoint is also harder/interesting.
            // For now, accept any result.
            return {
                targetGrid: grid,
                pieces: pieces.map(p => ({
                    ...p,
                    // Give the user the base shape, not the pre-rotated solution shape
                    // They have to figure out rotation themselves.
                    shape: p.originalShape
                }))
            };
        }
        retries++;
    }

    throw new Error("Failed to generate puzzle after max retries");
}
