/**
 * Shared utility functions
 */

/**
 * Fisher-Yates shuffle - shuffles array in place
 * @param {Array} arr - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Create a 2D grid filled with zeros
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @returns {Array<Array<number>>} 2D array of zeros
 */
export function createGrid(rows, cols) {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
}

/**
 * Get a canonical signature for a shape (order-independent)
 * @param {Array<{x: number, y: number}>} shape - Array of blocks
 * @returns {string} Canonical signature string
 */
export function getShapeSignature(shape) {
    return shape.map(b => `${b.x},${b.y}`).sort().join(';');
}

/**
 * Get a random element from an array
 * @param {Array} arr - Array to pick from
 * @returns {*} Random element
 */
export function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
