/**
 * Difficulty configuration - calculates puzzle parameters based on level
 *
 * Design principles (based on game design research):
 * - Introduce ONE new mechanic at a time
 * - Scale back other difficulty when introducing something new
 * - Use logarithmic curves (fast early increase, plateaus later)
 * - Boredom kills more than difficulty (57% quit from boredom vs 27% from difficulty)
 *
 * Milestones:
 * - Level 15: 4 pieces
 * - Level 35: Wide/tall boards introduced
 * - Level 50: 5 pieces
 * - Level 60: Irregular shapes (L, T, cross) introduced
 * - Level 75: Holes introduced
 * - Level 100: Extreme shapes (3×8, 8×3) introduced
 * - Level 125: 6 pieces
 * - Level 150: 2 holes possible
 * - Level 175: Hard pieces dominate
 * - Level 200: 7 pieces
 * - Level 200+: Logarithmic increase continues
 */

// Board shape templates - {rows, cols} that roughly fit the same area
const BOARD_SHAPES = {
    square: { rows: 5, cols: 5 },      // 25 cells - easy to visualize
    wide: { rows: 4, cols: 6 },        // 24 cells - horizontal thinking
    tall: { rows: 6, cols: 4 },        // 24 cells - vertical thinking
    long: { rows: 3, cols: 8 },        // 24 cells - very constrained
    narrow: { rows: 8, cols: 3 },      // 24 cells - very constrained
    // Large boards for 7 pieces (level 200+)
    largeSquare: { rows: 6, cols: 5 }, // 30 cells - fits 7 pieces
    largeWide: { rows: 5, cols: 6 },   // 30 cells - horizontal
};

/**
 * Irregular board shapes - defined as masks on a base grid
 * Each shape has: base dimensions + cutout cells (relative to top-left)
 * Cutouts are cells that are "outside" the playable area
 *
 * These add variety, not difficulty - used from level 60+ with ~25% chance
 */
const IRREGULAR_SHAPES = {
    // L-shape: 5x5 with top-right 2x2 corner cut
    // ##...
    // ##...
    // #####
    // #####
    // #####
    L: {
        rows: 5, cols: 5,
        cutouts: [
            {x: 2, y: 0}, {x: 3, y: 0}, {x: 4, y: 0},
            {x: 2, y: 1}, {x: 3, y: 1}, {x: 4, y: 1}
        ]
        // 25 - 6 = 19 cells
    },
    // T-shape: 5x5 with bottom corners cut
    // #####
    // #####
    // #####
    // .###.
    // .###.
    T: {
        rows: 5, cols: 5,
        cutouts: [
            {x: 0, y: 3}, {x: 4, y: 3},
            {x: 0, y: 4}, {x: 4, y: 4}
        ]
        // 25 - 4 = 21 cells
    },
    // Cross/plus shape: 6x6 with all corners cut (2x2 each)
    // ..##..
    // ..##..
    // ######
    // ######
    // ..##..
    // ..##..
    cross: {
        rows: 6, cols: 6,
        cutouts: [
            {x: 0, y: 0}, {x: 1, y: 0}, {x: 4, y: 0}, {x: 5, y: 0},
            {x: 0, y: 1}, {x: 1, y: 1}, {x: 4, y: 1}, {x: 5, y: 1},
            {x: 0, y: 4}, {x: 1, y: 4}, {x: 4, y: 4}, {x: 5, y: 4},
            {x: 0, y: 5}, {x: 1, y: 5}, {x: 4, y: 5}, {x: 5, y: 5}
        ]
        // 36 - 16 = 20 cells
    },
    // U-shape: 5x4 with center top cut
    // ##.##
    // ##.##
    // #####
    // #####
    U: {
        rows: 4, cols: 5,
        cutouts: [
            {x: 2, y: 0},
            {x: 2, y: 1}
        ]
        // 20 - 2 = 18 cells
    },
    // Steps/staircase: 5x5 diagonal steps
    // #....
    // ##...
    // ###..
    // ####.
    // #####
    steps: {
        rows: 5, cols: 5,
        cutouts: [
            {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}, {x: 4, y: 0},
            {x: 2, y: 1}, {x: 3, y: 1}, {x: 4, y: 1},
            {x: 3, y: 2}, {x: 4, y: 2},
            {x: 4, y: 3}
        ]
        // 25 - 10 = 15 cells
    }
};

// Export for use in puzzle.js
export { IRREGULAR_SHAPES };

// Piece categories by difficulty
export const PIECE_CATEGORIES = {
    // Easy: symmetric or simple shapes
    easy: ['Domino', 'Line3', 'Square', 'Line4'],
    // Medium: slightly asymmetric
    medium: ['Corner3', 'T', 'L'],
    // Hard: highly asymmetric, tricky to place
    hard: ['S', 'P', 'L5', 'W', 'Y', 'C']
};

/**
 * Logarithmic probability function
 * Starts at 0 when level = introLevel, increases quickly at first, then plateaus
 * @param {number} level - Current level
 * @param {number} introLevel - Level where this mechanic is introduced
 * @param {number} maxProb - Maximum probability (0-1)
 * @param {number} scale - How quickly it ramps up (higher = slower)
 */
function logProb(level, introLevel, maxProb, scale = 50) {
    if (level < introLevel) return 0;
    const x = level - introLevel;
    return maxProb * Math.log(1 + x / scale) / Math.log(1 + 200 / scale);
}

/**
 * Calculate difficulty parameters based on level
 * Returns an object with all parameters needed for puzzle generation
 */
export function getDifficultyParams(level) {
    // --- PIECE COUNT ---
    // Milestones: 15 → 4, 50 → 5, 125 → 6, 200 → 7
    let numPieces;
    if (level < 15) numPieces = 3;
    else if (level < 50) numPieces = 4;
    else if (level < 125) numPieces = 5;
    else if (level < 200) numPieces = 6;
    else numPieces = 7;

    // --- BOARD SHAPE ---
    // Milestone 35: Wide/tall introduced
    // Milestone 100: Extreme shapes introduced
    // Milestone 200: Larger boards for 7 pieces
    let boardShape = BOARD_SHAPES.square;
    const shapeRoll = Math.random();

    if (level >= 200) {
        // Level 200+: Need larger boards for 7 pieces (30 cells minimum)
        boardShape = Math.random() < 0.5 ? BOARD_SHAPES.largeSquare : BOARD_SHAPES.largeWide;
    } else if (level < 35) {
        // Always square before milestone
        boardShape = BOARD_SHAPES.square;
    } else if (level < 100) {
        // Wide/tall only, logarithmic increase from 0% to ~40%
        const wideTallProb = logProb(level, 35, 0.4, 40);
        if (shapeRoll < wideTallProb) {
            boardShape = Math.random() < 0.5 ? BOARD_SHAPES.wide : BOARD_SHAPES.tall;
        }
    } else {
        // Extreme shapes possible, logarithmic increase
        const extremeProb = logProb(level, 100, 0.25, 60);
        const wideTallProb = logProb(level, 35, 0.4, 40);

        if (shapeRoll < extremeProb) {
            boardShape = Math.random() < 0.5 ? BOARD_SHAPES.long : BOARD_SHAPES.narrow;
        } else if (shapeRoll < extremeProb + wideTallProb) {
            boardShape = Math.random() < 0.5 ? BOARD_SHAPES.wide : BOARD_SHAPES.tall;
        }
    }

    // --- IRREGULAR SHAPES ---
    // Milestone 60: Irregular shapes introduced as variation (not difficulty)
    // ~25% chance, independent of other factors
    // Only used when numPieces <= 5 (irregular shapes have limited cells)
    let irregularShape = null;

    if (level >= 60 && numPieces <= 5 && Math.random() < 0.25) {
        // Calculate minimum cells needed (rough estimate: 4 blocks per piece)
        const minCells = numPieces * 4;

        // Cell counts for each irregular shape
        const shapeCells = {
            L: 19,      // 5x5 - 6 cutouts
            T: 21,      // 5x5 - 4 cutouts
            cross: 20,  // 6x6 - 16 cutouts
            U: 18,      // 5x4 - 2 cutouts
            steps: 15   // 5x5 - 10 cutouts
        };

        // Filter shapes that have enough cells
        const validShapes = Object.keys(shapeCells).filter(
            name => shapeCells[name] >= minCells
        );

        if (validShapes.length > 0) {
            irregularShape = validShapes[Math.floor(Math.random() * validShapes.length)];
            // Override board dimensions with irregular shape dimensions
            const shape = IRREGULAR_SHAPES[irregularShape];
            boardShape = { rows: shape.rows, cols: shape.cols };
        }
    }

    // --- HOLES ---
    // Milestone 75: First hole introduced
    // Milestone 150: 2 holes possible
    // Holes are disabled when using irregular shapes (already complex enough)
    let numHoles = 0;

    if (!irregularShape) {
        const holeRoll = Math.random();

        if (level < 75) {
            numHoles = 0;
        } else if (level < 150) {
            // 1 hole max, logarithmic probability
            const oneHoleProb = logProb(level, 75, 0.5, 50);
            if (holeRoll < oneHoleProb) numHoles = 1;
        } else {
            // 2 holes possible
            const oneHoleProb = logProb(level, 75, 0.5, 50);
            const twoHoleProb = logProb(level, 150, 0.3, 60);

            if (holeRoll < twoHoleProb) numHoles = 2;
            else if (holeRoll < twoHoleProb + oneHoleProb) numHoles = 1;
        }
    }

    // --- PIECE SELECTION BIAS ---
    // Gradual increase, milestone 175: hard pieces dominate
    // This is a value 0-1 where 1 = only hard pieces
    let asymmetricBias;
    if (level < 15) {
        asymmetricBias = 0;
    } else if (level < 175) {
        // Gradual logarithmic increase from 0 to 0.5
        asymmetricBias = logProb(level, 15, 0.5, 80);
    } else {
        // After milestone 175: ramp up to dominate
        asymmetricBias = 0.5 + logProb(level, 175, 0.4, 50);
    }

    // Add slight randomness (±10%)
    asymmetricBias = Math.max(0, Math.min(1, asymmetricBias + (Math.random() - 0.5) * 0.2));

    return {
        numPieces,
        boardRows: boardShape.rows,
        boardCols: boardShape.cols,
        numHoles,
        asymmetricBias,
        irregularShape  // null or shape name ('L', 'T', 'cross', 'U', 'steps')
    };
}

/**
 * Select pieces based on asymmetric bias
 * Returns array of shape names to use for puzzle
 */
export function selectPiecesWithBias(numPieces, asymmetricBias, availableShapes) {
    const selected = [];
    const allCategories = {
        easy: [...PIECE_CATEGORIES.easy].filter(s => availableShapes.includes(s)),
        medium: [...PIECE_CATEGORIES.medium].filter(s => availableShapes.includes(s)),
        hard: [...PIECE_CATEGORIES.hard].filter(s => availableShapes.includes(s))
    };

    // Shuffle each category
    for (const cat of Object.values(allCategories)) {
        shuffleArray(cat);
    }

    for (let i = 0; i < numPieces; i++) {
        const roll = Math.random();
        let pool;

        if (roll < asymmetricBias && allCategories.hard.length > 0) {
            // Pick from hard
            pool = allCategories.hard;
        } else if (roll < asymmetricBias + 0.3 && allCategories.medium.length > 0) {
            // Pick from medium
            pool = allCategories.medium;
        } else if (allCategories.easy.length > 0) {
            // Pick from easy
            pool = allCategories.easy;
        } else if (allCategories.medium.length > 0) {
            pool = allCategories.medium;
        } else {
            pool = allCategories.hard;
        }

        if (pool.length === 0) {
            // Fallback: use any available shape
            pool = availableShapes.filter(s => !selected.includes(s));
            if (pool.length === 0) pool = [...availableShapes]; // Allow duplicates as last resort
        }

        const piece = pool.shift() || availableShapes[i % availableShapes.length];
        selected.push(piece);

        // Remove from all categories to avoid duplicates
        for (const cat of Object.values(allCategories)) {
            const idx = cat.indexOf(piece);
            if (idx !== -1) cat.splice(idx, 1);
        }
    }

    return selected;
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
