import { generatePuzzle } from './puzzle.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { sounds } from './sounds.js';
import {
    DOCK_Y,
    LEVEL_3_PIECE_MAX,
    LEVEL_14_PIECE_MAX,
    WIN_OVERLAY_DELAY,
    HINT_DELAY
} from './config/constants.js';

const canvas = document.getElementById('game-canvas');
const winOverlay = document.getElementById('win-overlay');
const nextBtn = document.getElementById('next-level-btn');
const levelDisplay = document.getElementById('level-display');

const renderer = new Renderer(canvas);
let game = null;
let level = 1;
let lastInteractionTime = Date.now();
let hintShown = false;

// Loop
function loop() {
    if (game) {
        // Check for hint trigger
        if (!hintShown && Date.now() - lastInteractionTime > HINT_DELAY) {
            const hint = game.getHint();
            if (hint) {
                renderer.showHint(hint);
                hintShown = true;
            }
        }

        renderer.draw(game);
    }
    requestAnimationFrame(loop);
}

function startLevel() {
    // Difficulty scaling: more pieces at higher levels
    const piecesCount = level <= LEVEL_3_PIECE_MAX ? 3 : level <= LEVEL_14_PIECE_MAX ? 4 : 5;

    // Retry generation until success (handled inside, throws if fails)
    try {
        const puzzleData = generatePuzzle(piecesCount);
        game = new Game(puzzleData);
        window.game = game; // Expose for testing

        // Scatter pieces in dock area below the grid
        game.pieces.forEach((p, index) => {
            // Layout pieces in dock area below the board
            // Spread them evenly across the 5-wide board
            const totalPieces = game.pieces.length;
            const spacing = 5 / totalPieces;
            const x = Math.floor(index * spacing);

            game.updatePieceState(p.id, {
                x: x,
                y: DOCK_Y,
                rotation: Math.floor(Math.random() * 4),
                dockX: x,
                dockY: DOCK_Y
            });
        });

    } catch (e) {
        console.error("Generaiton failed", e);
        startLevel(); // Try again (dumb retry)
        return;
    }

    renderer.clearEffects();
    renderer.hideHint();
    lastInteractionTime = Date.now();
    hintShown = false;
    winOverlay.classList.add('hidden');
    levelDisplay.innerText = `LEVEL ${level}`;
}

// Check Win Handler
function onInteraction(checkWin = false) {
    // Reset hint on any interaction
    lastInteractionTime = Date.now();
    if (hintShown) {
        renderer.hideHint();
        hintShown = false;
    }

    if (checkWin && game) {
        if (game.checkWin()) {
            sounds.playWin();
            renderer.triggerWinEffect();
            setTimeout(() => {
                winOverlay.classList.remove('hidden');
            }, WIN_OVERLAY_DELAY);
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
