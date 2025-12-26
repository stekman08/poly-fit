/**
 * Game configuration constants
 */

// Grid dimensions
export const GRID_ROWS = 5;
export const GRID_COLS = 5;
export const DOCK_Y = 6;
export const MAX_DOCK_Y = 11; // Maximum Y position to keep pieces visible

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
// Level 50+: 6 pieces

// Timing
export const WIN_OVERLAY_DELAY = 300;    // ms - delay before showing win overlay
export const HINT_DELAY = 60000;         // ms - show hint after 1 minute inactivity
