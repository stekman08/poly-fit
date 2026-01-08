/**
 * Game configuration constants
 */

// Grid dimensions
export const GRID_ROWS = 5;
export const GRID_COLS = 5;

// Dock configuration
export const DOCK_GAP = 1;    // Gap between board and dock (in grid cells)
export const DOCK_ROWS = 8;   // Number of rows available in dock

// Dynamic dock position based on board height
export function getDockY(boardRows) {
    return boardRows + DOCK_GAP;
}

export function getMaxDockY(boardRows) {
    return boardRows + DOCK_GAP + DOCK_ROWS - 1;
}

// Gesture detection thresholds
export const TAP_MAX_DISTANCE = 10;      // pixels - max movement for tap
export const TAP_MAX_DURATION = 300;     // ms - max duration for tap
export const SWIPE_MIN_DISTANCE = 30;    // pixels - min movement for swipe
export const SWIPE_MAX_DURATION = 300;   // ms - max duration for swipe (must be fast)

// Touch handling
export const FAT_FINGER_RADIUS = 45;     // pixels - hit detection radius for touch
export const TOUCH_MOUSE_DEBOUNCE = 500; // ms - ignore mouse after touch

// Timing
export const HINT_DELAY = 300000;        // ms - show hint after 5 minutes inactivity
export const WIN_TRANSITION_DELAY = 600; // ms - delay before next level after win

// Puzzle generation
export const MAX_GENERATION_RETRIES = 2000; // max internal attempts in puzzle.js
export const MAX_WORKER_RETRIES = 10; // max worker-level retries in main.js
