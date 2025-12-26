
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
    // 3 blocks
    Line3: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
    Corner3: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],

    // 4 blocks (Tetrominoes)
    T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    L: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
    J: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
    S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    Square: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    Line4: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],

    // 5 blocks (Pentominoes - subset)
    C: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }, { x: 1, y: 2 }], // U-shape
    P: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    L5: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }],
};

export const COLORS = [
    '#FF00FF', // Neon Magenta
    '#00FFFF', // Neon Cyan
    '#00FF00', // Neon Green
    '#FFFF00', // Neon Yellow
    '#FF0000', // Neon Red
    '#7F00FF', // Neon Purple
    '#FF7F00', // Neon Orange
    '#FFFFFF', // Neon White
];
