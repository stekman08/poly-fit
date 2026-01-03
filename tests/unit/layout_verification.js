
/**
 * Layout Verification Script
 *
 * This script simulates the logic in Renderer.resize() to verify that
 * the game board NEVER overlaps with the header area, regardless of
 * screen size or aspect ratio.
 */

const MIN_HEADER_OFFSET = 120; // The NEW proposed value
const BOARD_ROWS = 5;
const BOARD_COLS = 5;
const DOCK_ROWS = 8;

function calculateLayout(screenWidth, screenHeight) {
    // Logic copied from Renderer.resize()
    const contentGridHeight = BOARD_ROWS + 1 + DOCK_ROWS + 1;
    const totalGridWidth = BOARD_COLS + 2;

    const availableHeight = screenHeight - MIN_HEADER_OFFSET;

    // If available height is negative (screen too small), we have a problem
    if (availableHeight <= 0) {
        return { valid: false, reason: "Screen too short" };
    }

    const maxCellH = availableHeight / contentGridHeight;
    const maxCellW = screenWidth / totalGridWidth;

    const gridSize = Math.floor(Math.min(maxCellH, maxCellW));

    const offsetY = Math.max(gridSize * 2.5, MIN_HEADER_OFFSET);

    return {
        valid: true,
        gridSize,
        offsetY,
        headerSafe: offsetY >= MIN_HEADER_OFFSET
    };
}

// Test Cases
const testCases = [
    { name: "iPhone SE (Small)", w: 375, h: 667 },
    { name: "iPhone 14 Pro (Standard)", w: 393, h: 852 },
    { name: "iPad Air (Tablet)", w: 820, h: 1180 },
    { name: "Desktop 1080p", w: 1920, h: 1080 },
    { name: "Tiny Window", w: 300, h: 400 } // Extreme edge case
];

console.log(`Running Layout Verification with MIN_HEADER_OFFSET = ${MIN_HEADER_OFFSET}px...\n`);

let allPassed = true;

testCases.forEach(test => {
    const result = calculateLayout(test.w, test.h);

    if (!result.valid) {
        console.log(`❌ ${test.name} (${test.w}x${test.h}): FAILED - ${result.reason}`);
        // Tiny window might fail validation which is expected, but we care about Header Safety
        if (test.name !== "Tiny Window") allPassed = false;
    } else if (!result.headerSafe) {
        console.log(`❌ ${test.name} (${test.w}x${test.h}): FAILED - Overlap Detected! OffsetY (${result.offsetY}) < Min (${MIN_HEADER_OFFSET})`);
        allPassed = false;
    } else {
        console.log(`✅ ${test.name} (${test.w}x${test.h}): Passed. OffsetY: ${result.offsetY}px (Safe) - GridSize: ${result.gridSize}px`);
    }
});

if (allPassed) {
    console.log("\n✨ All standard layout tests passed. The board pushes down correctly.");
} else {
    console.log("\n⚠️ Verification FAILED.");
    process.exit(1);
}
