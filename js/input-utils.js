/**
 * Input Utilities
 * Pure functions for input handling - no DOM or side effects
 * These can be unit tested without mocking
 */

/**
 * Find a touch in a TouchList by identifier
 * @param {TouchList} touchList - List of touches
 * @param {number|null} id - Touch identifier to find
 * @returns {Touch|null} The matching touch or null
 */
export function findTouchById(touchList, id) {
    if (id === null) return null;
    for (let i = 0; i < touchList.length; i++) {
        if (touchList[i].identifier === id) {
            return touchList[i];
        }
    }
    return null;
}

/**
 * Detect gesture type based on movement and timing
 * @param {number} distance - Distance moved in pixels
 * @param {number} duration - Time elapsed in milliseconds
 * @param {Object} config - Gesture thresholds
 * @param {number} config.tapMaxDistance - Max distance for tap
 * @param {number} config.tapMaxDuration - Max duration for tap
 * @param {number} config.swipeMinDistance - Min distance for swipe
 * @param {number} config.swipeMaxDuration - Max duration for swipe
 * @returns {'tap'|'swipe'|'drag'|'none'} The detected gesture type
 */
export function detectGesture(distance, duration, config) {
    const { tapMaxDistance, tapMaxDuration, swipeMinDistance, swipeMaxDuration } = config;

    // Swipe: fast movement over threshold distance (takes priority)
    if (distance >= swipeMinDistance && duration < swipeMaxDuration) {
        return 'swipe';
    }

    // Tap: small movement, short duration
    if (distance < tapMaxDistance && duration < tapMaxDuration) {
        return 'tap';
    }

    // Drag: significant movement (or too slow for swipe)
    if (distance >= tapMaxDistance) {
        return 'drag';
    }

    // None: no significant gesture detected
    return 'none';
}

/**
 * Calculate the snap position for a piece on the board
 * Clamps to valid board boundaries
 * @param {number} x - Current x position (fractional)
 * @param {number} y - Current y position (fractional)
 * @param {number} pieceWidth - Width of the piece in cells
 * @param {number} boardCols - Number of board columns
 * @param {number} boardRows - Number of board rows (optional, for dock boundary)
 * @returns {{x: number, y: number}} Snapped grid position
 */
export function calculateSnapPosition(x, y, pieceWidth, boardCols, boardRows = Infinity) {
    let snapX = Math.round(x);
    let snapY = Math.round(y);

    // Clamp X to valid range
    snapX = Math.max(0, Math.min(snapX, boardCols - pieceWidth));

    // Clamp Y to minimum 0
    snapY = Math.max(0, snapY);

    return { x: snapX, y: snapY };
}

/**
 * Find the nearest position from a list of candidates
 * @param {Array<{x: number, y: number}>} candidates - List of candidate positions
 * @param {number} fromX - Source X position
 * @param {number} fromY - Source Y position
 * @returns {{x: number, y: number, dist: number}|null} Nearest position or null if no candidates
 */
export function findNearestPosition(candidates, fromX, fromY) {
    if (!candidates || candidates.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;

    for (const pos of candidates) {
        const dist = Math.hypot(pos.x - fromX, pos.y - fromY);
        if (dist < minDist) {
            minDist = dist;
            nearest = { x: pos.x, y: pos.y, dist };
        }
    }

    return nearest;
}

/**
 * Check if a point is within a rectangle (with optional radius for fat finger)
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {{left: number, right: number, top: number, bottom: number}} rect - Rectangle bounds
 * @param {number} radius - Additional radius for hit detection (fat finger)
 * @returns {{inside: boolean, distance: number}} Whether point is in range and distance to rect
 */
export function pointToRectDistance(px, py, rect, radius = 0) {
    // Calculate distance to rectangle (0 if inside)
    const dx = Math.max(rect.left - px, 0, px - rect.right);
    const dy = Math.max(rect.top - py, 0, py - rect.bottom);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return {
        inside: distance <= radius,
        distance
    };
}

/**
 * Convert screen position to grid position
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {{left: number, top: number}} boardRect - Board element bounds
 * @param {number} cellSize - Size of each grid cell in pixels
 * @returns {{x: number, y: number}} Grid position (can be fractional)
 */
export function screenToGrid(screenX, screenY, boardRect, cellSize) {
    return {
        x: (screenX - boardRect.left) / cellSize,
        y: (screenY - boardRect.top) / cellSize
    };
}

/**
 * Calculate grid position delta from screen movement
 * @param {number} startScreenX - Starting screen X
 * @param {number} startScreenY - Starting screen Y
 * @param {number} currentScreenX - Current screen X
 * @param {number} currentScreenY - Current screen Y
 * @param {number} cellSize - Size of each grid cell in pixels
 * @returns {{deltaX: number, deltaY: number}} Movement in grid units
 */
export function calculateGridDelta(startScreenX, startScreenY, currentScreenX, currentScreenY, cellSize) {
    return {
        deltaX: (currentScreenX - startScreenX) / cellSize,
        deltaY: (currentScreenY - startScreenY) / cellSize
    };
}
