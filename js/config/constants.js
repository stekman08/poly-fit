/**
 * Game configuration constants
 */

// Grid dimensions
export const GRID_ROWS = 5;
export const GRID_COLS = 5;
export const DOCK_Y = 6;

// Gesture detection thresholds
export const TAP_MAX_DISTANCE = 10;      // pixels - max movement for tap
export const TAP_MAX_DURATION = 300;     // ms - max duration for tap
export const DOUBLE_TAP_WINDOW = 400;    // ms - max time between taps
export const DOUBLE_TAP_DISTANCE = 50;   // pixels - max distance between taps

// Mobile UX
export const TOUCH_LIFT_OFFSET = 100;    // pixels - lift piece above finger

// Difficulty scaling
export const LEVEL_3_PIECE_MAX = 3;      // levels 1-3: 3 pieces
export const LEVEL_14_PIECE_MAX = 14;    // levels 4-14: 4 pieces
// Level 15+: 5 pieces

// Timing
export const WIN_OVERLAY_DELAY = 300;    // ms - delay before showing win overlay
