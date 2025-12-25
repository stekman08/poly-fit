
import { generatePuzzle } from './puzzle.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';

const canvas = document.getElementById('game-canvas');
const winOverlay = document.getElementById('win-overlay');
const nextBtn = document.getElementById('next-level-btn');
const levelDisplay = document.getElementById('level-display');

const renderer = new Renderer(canvas);
let game = null;
let level = 1;

// Loop
function loop() {
    if (game) {
        // Optional: Animation updates here
        renderer.draw(game);
    }
    requestAnimationFrame(loop);
}

function startLevel() {
    // 1. Generate new puzzle
    // Difficulty: Increase piece count?
    // Levels 1-3: 3 pieces. Levels 4+: 4 pieces.
    const piecesCount = level <= 3 ? 3 : 4;

    // Retry generation until success (handled inside, throws if fails)
    try {
        const puzzleData = generatePuzzle(piecesCount);
        game = new Game(puzzleData);
        window.game = game; // Expose for testing

        // 2. Scatter pieces in "Dock"
        // Dock is below the 5x5 grid.
        // Grid is 0..4 (Y). Dock start at Y=6?
        // Scatter X: 0..4
        const dockY = 6;

        game.pieces.forEach((p, index) => {
            // Layout pieces in dock area below the board
            // Spread them evenly across the 5-wide board
            const totalPieces = game.pieces.length;
            const spacing = 5 / totalPieces;
            const x = Math.floor(index * spacing);

            game.updatePieceState(p.id, {
                x: x,
                y: dockY,
                rotation: Math.floor(Math.random() * 4),
                dockX: x,
                dockY: dockY
            });
        });

    } catch (e) {
        console.error("Generaiton failed", e);
        startLevel(); // Try again (dumb retry)
        return;
    }

    winOverlay.classList.add('hidden');
    levelDisplay.innerText = `LEVEL ${level}`;
}

// Check Win Handler
function onInteraction(checkWin = false) {
    // Force redraw?
    // Loop handles redraws, but maybe we want instant feedback?
    // Loop is 60fps, so good enough.

    if (checkWin && game) {
        if (game.checkWin()) {
            // Trigger Win
            // Delay slightly for effect
            setTimeout(() => {
                winOverlay.classList.remove('hidden');
                // Fireworks?
            }, 300);
        }
    }
}

// Input setup
new InputHandler(
    {
        get pieces() { return game ? game.pieces : []; },
        get targetGrid() { return game ? game.targetGrid : []; },
        updatePieceState: (id, s) => game && game.updatePieceState(id, s)
    },
    renderer,
    onInteraction
);

// Events
nextBtn.addEventListener('click', () => {
    level++;
    startLevel();
});

// Start
startLevel();
loop();
