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
