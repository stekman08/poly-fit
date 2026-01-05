
/**
 * Shape is an array of {x, y} coordinates.
 */

// Rotate 90 degrees clockwise
export function rotateShape(shape) {
    return shape.map(p => ({
        x: -p.y || 0,  // Convert -0 to 0
        y: p.x
    }));
}

// Flip horizontally
export function flipShape(shape) {
    return shape.map(p => ({
        x: -p.x || 0,  // Convert -0 to 0
        y: p.y
    }));
}

// Get shape dimensions safely (handles empty shapes)
export function getShapeDimensions(shape) {
    if (!shape || shape.length === 0) {
        return { width: 0, height: 0 };
    }
    let maxX = 0, maxY = 0;
    for (const block of shape) {
        if (block.x > maxX) maxX = block.x;
        if (block.y > maxY) maxY = block.y;
    }
    return { width: maxX + 1, height: maxY + 1 };
}

// Normalize coordinates so the top-left-most block is at (0,0) (or closes to it)
export function normalizeShape(shape) {
    const len = shape.length;
    if (len === 0) return [];

    // Find min x and min y in single pass
    let minX = shape[0].x;
    let minY = shape[0].y;
    for (let i = 1; i < len; i++) {
        if (shape[i].x < minX) minX = shape[i].x;
        if (shape[i].y < minY) minY = shape[i].y;
    }

    // Offset all coordinates
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = { x: shape[i].x - minX, y: shape[i].y - minY };
    }
    return result;
}

// Standard Polyominoes
// Defined relative to 0,0
export const SHAPES = {
    // 2 blocks (Domino)
    Domino: [{ x: 0, y: 0 }, { x: 0, y: 1 }],

    // 3 blocks
    Line3: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
    Corner3: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],

    // 4 blocks (Tetrominoes)
    T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    L: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
    S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    Square: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    Line4: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],

    // 5 blocks (Pentominoes - subset)
    C: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }, { x: 1, y: 2 }], // U-shape
    P: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    L5: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }],
    W: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }], // Staircase
    Y: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }], // T with tail
};

export const COLORS = [
    '#F92672', // Neon Pink
    '#00E5FF', // Cyan
    '#A6E22E', // Lime
    '#FD971F', // Orange
    '#AE81FF', // Purple
    '#E6DB74', // Mellow Yellow
    '#FF3333', // Red
    '#F8F8F2', // White
];
