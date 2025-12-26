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
const levelDisplay = document.getElementById('level-display');
const startScreen = document.getElementById('start-screen');
const btnNewGame = document.getElementById('btn-new-game');
const btnContinue = document.getElementById('btn-continue');

const renderer = new Renderer(canvas);
let game = null;
let level = 1;
let maxLevel = parseInt(localStorage.getItem('polyfit-max-level'), 10) || 1;
let lastInteractionTime = Date.now();
let hintShown = false;

function loop() {
    if (game) {
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
    const piecesCount = level <= LEVEL_3_PIECE_MAX ? 3 : level <= LEVEL_14_PIECE_MAX ? 4 : 5;

    try {
        const puzzleData = generatePuzzle(piecesCount);
        game = new Game(puzzleData);
        window.game = game;

        let currentX = 0;
        let currentY = DOCK_Y;

        game.pieces.forEach((p) => {
            const pieceWidth = Math.max(...p.shape.map(b => b.x)) + 1;
            const pieceHeight = Math.max(...p.shape.map(b => b.y)) + 1;

            if (currentX + pieceWidth > 5) {
                currentX = 0;
                currentY += 3;
            }

            game.updatePieceState(p.id, {
                x: currentX,
                y: currentY,
                rotation: 0,
                dockX: currentX,
                dockY: currentY
            });

            currentX += pieceWidth;
        });

    } catch (e) {
        console.error("Generation failed", e);
        startLevel();
        return;
    }

    renderer.clearEffects();
    renderer.hideHint();
    lastInteractionTime = Date.now();
    hintShown = false;
    winOverlay.classList.add('hidden');
    levelDisplay.innerText = `LEVEL ${level}`;
}

function onInteraction(checkWin = false) {
    lastInteractionTime = Date.now();
    if (hintShown) {
        renderer.hideHint();
        hintShown = false;
    }

    if (checkWin && game && game.checkWin()) {
        sounds.playWin();
        renderer.triggerWinEffect();
        setTimeout(() => {
            winOverlay.classList.remove('hidden');
            setTimeout(() => {
                level++;
                if (level > maxLevel) {
                    maxLevel = level;
                    localStorage.setItem('polyfit-max-level', maxLevel);
                }
                startLevel();
            }, 1500);
        }, WIN_OVERLAY_DELAY);
    }
}

new InputHandler(
    {
        get pieces() { return game ? game.pieces : []; },
        get targetGrid() { return game ? game.targetGrid : []; },
        updatePieceState: (id, s) => game && game.updatePieceState(id, s)
    },
    renderer,
    onInteraction
);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        lastInteractionTime = Date.now();
        if (hintShown) {
            renderer.hideHint();
            hintShown = false;
        }
    }
});

function showStartScreen() {
    if (maxLevel > 1) {
        btnContinue.textContent = `Continue (Level ${maxLevel})`;
        btnContinue.classList.remove('hidden');
    } else {
        btnContinue.classList.add('hidden');
    }
    startScreen.classList.remove('hidden');
}

btnNewGame.addEventListener('click', () => {
    level = 1;
    startScreen.classList.add('hidden');
    startLevel();
});

btnContinue.addEventListener('click', () => {
    level = maxLevel;
    startScreen.classList.add('hidden');
    startLevel();
});

showStartScreen();
loop();
