
import { generatePuzzle } from '../../js/puzzle.js';
import { getDifficultyParams } from '../../js/config/difficulty.js';
import { countSolutions } from '../../js/solver.js';

console.log("Verifying Puzzle Tightness (Level 150 - 6 pieces)...");

// Default to 5 samples for quick CI/Commit hooks (approx 5-10s)
// Use 'node tests/unit/tightness_verification.js 20' for full stress test
const args = process.argv.slice(2);
const SAMPLES = args.length > 0 ? parseInt(args[0]) : 5;

let passed = 0;
let totalSolutions = 0;
let retriesObserved = 0;

// Mock console.warn to count retries
const originalWarn = console.warn;
console.warn = (msg) => {
    if (msg.includes("Puzzle too loose")) retriesObserved++;
    // originalWarn(msg); // Silence for clearer output
};

for (let i = 0; i < SAMPLES; i++) {
    const params = getDifficultyParams(150);
    const puzzle = generatePuzzle(params);

    // Check solution count
    const solverPieces = puzzle.pieces.map(p => ({
        originalShape: p.originalShape,
        shapeName: p.shapeName
    }));

    // Limit is 100 for checking count effectively
    const count = countSolutions(puzzle.targetGrid, solverPieces, 100);
    totalSolutions += count;

    if (count <= 10) {
        passed++;
    } else {
        console.error(`❌ FAILED: Generated puzzle has ${count} solutions! (Limit 10)`);
    }

    process.stdout.write(".");
}

console.warn = originalWarn; // Restore

console.log("\n\n--- VERIFICATION RESULTS ---");
console.log(`Passed: ${passed}/${SAMPLES}`);
console.log(`Avg Solutions: ${(totalSolutions / SAMPLES).toFixed(1)}`);
console.log(`Retries Triggered (Discards): ${retriesObserved}`);

if (passed === SAMPLES) {
    console.log("✅ SUCCESS: All generated puzzles meet tightness criteria.");
} else {
    console.log("❌ FAILURE: Tightness filter leaking loose puzzles.");
    process.exit(1);
}
