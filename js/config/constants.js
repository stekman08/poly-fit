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

export const DOCK_PIECE_SCALE = 0.5;  // Scale pieces down in dock (50%)
export const BOARD_PIECE_SCALE = 1.0; // Full size on board
export const GHOST_ALPHA = 0.4;       // Shadow/preview transparency on board

// Gesture detection thresholds
export const TAP_MAX_DISTANCE = 10;      // pixels - max movement for tap
export const TAP_MAX_DURATION = 300;     // ms - max duration for tap
export const SWIPE_MIN_DISTANCE = 30;    // pixels - min movement for swipe
export const SWIPE_MAX_DURATION = 300;   // ms - max duration for swipe (must be fast)

// Mobile UX
export const TOUCH_LIFT_OFFSET = 100;    // pixels - lift piece above finger

// Difficulty scaling
export const LEVEL_3_PIECE_MAX = 3;      // levels 1-3: 3 pieces
export const LEVEL_14_PIECE_MAX = 14;    // levels 4-14: 4 pieces
export const LEVEL_49_PIECE_MAX = 49;    // levels 15-49: 5 pieces
export const LEVEL_99_PIECE_MAX = 99;    // levels 50-99: 6 pieces
// Level 100+: 7 pieces

// Timing
export const WIN_OVERLAY_DELAY = 300;    // ms - delay before showing win overlay
export const HINT_DELAY = 300000;        // ms - show hint after 5 minutes inactivity
