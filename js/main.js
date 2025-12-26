import { generatePuzzle } from './puzzle.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { sounds } from './sounds.js';
import { haptics } from './haptics.js';
import {
    DOCK_Y,
    MAX_DOCK_Y,
    LEVEL_3_PIECE_MAX,
    LEVEL_14_PIECE_MAX,
    LEVEL_49_PIECE_MAX,
    WIN_OVERLAY_DELAY,
    HINT_DELAY
} from './config/constants.js';

const canvas = document.getElementById('game-canvas');
const winOverlay = document.getElementById('win-overlay');
const levelDisplay = document.getElementById('level-display');
const startScreen = document.getElementById('start-screen');
const btnNewGame = document.getElementById('btn-new-game');
const btnContinue = document.getElementById('btn-continue');
const tutorialOverlay = document.getElementById('tutorial-overlay');
const btnGotIt = document.getElementById('btn-got-it');
const levelSelectScreen = document.getElementById('level-select-screen');
const levelGrid = document.getElementById('level-grid');
const btnLevelSelect = document.getElementById('btn-level-select');
const btnBack = document.getElementById('btn-back');

// Tutorial configuration
const TUTORIAL_STORAGE_KEY = 'polyfit-tutorial-shown';
const TUTORIAL_MAX_SHOWS = 3;

// Color themes
const THEMES = [
    { name: 'cyan', primary: '#00ffff', secondary: '#00cccc' },
    { name: 'magenta', primary: '#ff00ff', secondary: '#cc00cc' },
    { name: 'green', primary: '#00ff00', secondary: '#00cc00' },
    { name: 'orange', primary: '#ff8800', secondary: '#cc6600' }
];
const THEME_STORAGE_KEY = 'polyfit-theme';

const renderer = new Renderer(canvas);
let game = null;
let level = 1;
let maxLevel = parseInt(localStorage.getItem('polyfit-max-level'), 10) || 1;
let lastInteractionTime = Date.now();
let hintShown = false;
let isWinning = false;
let practiceMode = false; // When true, return to start screen after win
let currentThemeIndex = 0;

// Check if tutorial should be shown (first 3 times)
function shouldShowTutorial() {
    try {
        const timesShown = parseInt(localStorage.getItem(TUTORIAL_STORAGE_KEY) || '0', 10);
        if (timesShown >= TUTORIAL_MAX_SHOWS) {
            return false;
        }
        localStorage.setItem(TUTORIAL_STORAGE_KEY, String(timesShown + 1));
        return true;
    } catch {
        return true; // Show if localStorage unavailable
    }
}

function showTutorial() {
    tutorialOverlay.classList.remove('hidden');
}

function hideTutorial() {
    tutorialOverlay.classList.add('hidden');
    startLevel();
}

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
    const piecesCount = level <= LEVEL_3_PIECE_MAX ? 3
        : level <= LEVEL_14_PIECE_MAX ? 4
        : level <= LEVEL_49_PIECE_MAX ? 5
        : 6;

    try {
        const puzzleData = generatePuzzle(piecesCount);
        game = new Game(puzzleData);
        window.game = game;
        window.getLevel = () => level;
        window.isWinning = () => isWinning;
        window.triggerCheckWin = () => onInteraction(true);
        window.__testForceHint = () => { lastInteractionTime = 0; };

        let currentX = 0;
        let currentY = DOCK_Y;
        let rowMaxHeight = 0;

        game.pieces.forEach((p) => {
            const pieceWidth = Math.max(...p.shape.map(b => b.x)) + 1;
            const pieceHeight = Math.max(...p.shape.map(b => b.y)) + 1;

            if (currentX + pieceWidth > 5) {
                currentX = 0;
                currentY += rowMaxHeight; // Pack rows tightly
                rowMaxHeight = 0;
            }

            // Ensure piece stays within visible dock area
            const maxY = MAX_DOCK_Y - pieceHeight + 1;
            const placementY = Math.min(currentY, maxY);

            game.updatePieceState(p.id, {
                x: currentX,
                y: placementY,
                rotation: 0,
                dockX: currentX,
                dockY: placementY
            });

            currentX += pieceWidth;
            rowMaxHeight = Math.max(rowMaxHeight, pieceHeight);
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
    isWinning = false;
    winOverlay.classList.add('hidden');
    levelDisplay.innerText = `LEVEL ${level}`;
}

function onInteraction(checkWin = false) {
    lastInteractionTime = Date.now();
    if (hintShown) {
        renderer.hideHint();
        hintShown = false;
    }

    if (checkWin && game && !isWinning && game.checkWin()) {
        isWinning = true;
        sounds.playWin();
        haptics.vibrateWin();
        renderer.triggerWinEffect();
        setTimeout(() => {
            winOverlay.classList.remove('hidden');
            setTimeout(() => {
                if (practiceMode) {
                    // Practice mode: return to start screen
                    practiceMode = false;
                    showStartScreen();
                } else {
                    // Normal mode: advance to next level
                    level++;
                    if (level > maxLevel) {
                        maxLevel = level;
                        localStorage.setItem('polyfit-max-level', maxLevel);

                        // Track new max level in analytics
                        try {
                            if (window.goatcounter && window.goatcounter.count) {
                                window.goatcounter.count({
                                    path: '/polyfit/event/maxlevel/' + maxLevel,
                                    title: 'PolyFit Max Level: ' + maxLevel,
                                    event: true
                                });
                            }
                        } catch (e) {
                            // Analytics error should not break the game
                        }
                    }
                    startLevel();
                }
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

function applyTheme(theme) {
    document.documentElement.style.setProperty('--neon-blue', theme.primary);
    // Update button borders and text shadows that use the theme color
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
    const theme = THEMES[currentThemeIndex];
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme.name);
    haptics.vibrateRotate(); // Subtle feedback
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        const index = THEMES.findIndex(t => t.name === savedTheme);
        if (index !== -1) {
            currentThemeIndex = index;
            applyTheme(THEMES[index]);
        }
    }
}

function showStartScreen() {
    if (maxLevel > 1) {
        btnContinue.textContent = `Continue (Level ${maxLevel})`;
        btnContinue.classList.remove('hidden');
        btnLevelSelect.classList.remove('hidden');
    } else {
        btnContinue.classList.add('hidden');
        btnLevelSelect.classList.add('hidden');
    }
    startScreen.classList.remove('hidden');
    winOverlay.classList.add('hidden');
}

function showLevelSelect() {
    buildLevelGrid();
    startScreen.classList.add('hidden');
    levelSelectScreen.classList.remove('hidden');
}

function hideLevelSelect() {
    levelSelectScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function buildLevelGrid() {
    levelGrid.innerHTML = '';
    // Show up to maxLevel + some locked levels for preview
    const showLevels = Math.min(maxLevel + 10, 100);

    for (let i = 1; i <= showLevels; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.textContent = i;

        if (i > maxLevel) {
            btn.classList.add('locked');
        } else {
            btn.addEventListener('click', () => selectLevel(i));
        }

        levelGrid.appendChild(btn);
    }
}

function selectLevel(selectedLevel) {
    level = selectedLevel;
    practiceMode = true;
    levelSelectScreen.classList.add('hidden');
    // Skip tutorial in practice mode
    startLevel();
}

btnNewGame.addEventListener('click', () => {
    level = 1;
    startScreen.classList.add('hidden');
    // Always show tutorial on New Game (new player might be borrowing phone)
    showTutorial();
});

btnContinue.addEventListener('click', () => {
    level = maxLevel;
    startScreen.classList.add('hidden');
    if (shouldShowTutorial()) {
        showTutorial();
    } else {
        startLevel();
    }
});

btnGotIt.addEventListener('click', hideTutorial);

btnLevelSelect.addEventListener('click', showLevelSelect);
btnBack.addEventListener('click', hideLevelSelect);

// Title tap to cycle themes
const startTitle = document.querySelector('.start-modal .neon-text');
if (startTitle) {
    startTitle.style.cursor = 'pointer';
    startTitle.addEventListener('click', cycleTheme);
}

loadTheme();
showStartScreen();
loop();
