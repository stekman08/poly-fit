import { generatePuzzle } from './puzzle.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { sounds } from './sounds.js';
import { haptics } from './haptics.js';
import { getShapeDimensions } from './shapes.js';
import { getDifficultyParams } from './config/difficulty.js';
import {
    getDockY,
    getMaxDockY,
    HINT_DELAY,
    WIN_TRANSITION_DELAY
} from './config/constants.js';

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
    { name: 'cyan', primary: '#00E5FF', secondary: '#00B8CC' },
    { name: 'magenta', primary: '#F92672', secondary: '#E02266' },
    { name: 'green', primary: '#A6E22E', secondary: '#8FD125' },
    { name: 'orange', primary: '#FD971F', secondary: '#E0851A' }
];
const THEME_STORAGE_KEY = 'polyfit-theme';

// Safe localStorage helpers (handles private browsing, disabled storage, etc.)
function safeGetItem(key, defaultValue = null) {
    try {
        return localStorage.getItem(key) ?? defaultValue;
    } catch {
        return defaultValue;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Silently fail - storage unavailable
    }
}

// DOM-based renderer (no canvas needed)
const renderer = new Renderer();
let game = null;
let level = 1;
let maxLevel = parseInt(safeGetItem('polyfit-max-level', '1'), 10) || 1;

// URL parameter: ?level=XXX sets progress (useful for restoring after PWA reinstall)
const urlParams = new URLSearchParams(window.location.search);
const urlLevel = parseInt(urlParams.get('level'), 10);
if (urlLevel && urlLevel > 0) {
    level = urlLevel;
    if (urlLevel > maxLevel) {
        maxLevel = urlLevel;
        safeSetItem('polyfit-max-level', String(maxLevel));
    }
    // Clean URL without reload (removes ?level=XXX)
    window.history.replaceState({}, '', window.location.pathname);
}

let lastInteractionTime = Date.now();
let hintShown = false;
let isWinning = false;
let currentThemeIndex = 0;
let generationRetryCount = 0; // Prevent infinite recursion on puzzle generation failure
const MAX_GENERATION_RETRIES = 10; // Higher for complex puzzles at level 200+

// Dirty flag for render optimization - only redraw when something changed
let needsRender = true;

// Request a render on next frame (call this when game state changes)
function requestRender() {
    needsRender = true;
}
// Expose globally for input handler
window.requestRender = requestRender;

// Check if tutorial should be shown (first 3 times)
function shouldShowTutorial() {
    const timesShown = parseInt(safeGetItem(TUTORIAL_STORAGE_KEY, '0'), 10);
    if (timesShown >= TUTORIAL_MAX_SHOWS) {
        return false;
    }
    safeSetItem(TUTORIAL_STORAGE_KEY, String(timesShown + 1));
    return true;
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
        // Check hint timer (doesn't need render, just time check)
        if (!hintShown && Date.now() - lastInteractionTime > HINT_DELAY) {
            const hint = game.getHint();
            if (hint) {
                renderer.showHint(hint);
                needsRender = true;
            }
            // Mark as checked regardless of whether hint was shown
            // (prevents recalculating every frame if no hint available)
            hintShown = true;
        }

        // Only render when something changed OR confetti is animating
        const confettiActive = renderer.isConfettiActive();
        if (needsRender || confettiActive) {
            renderer.draw(game, confettiActive);
            needsRender = false;
        }
    }
    requestAnimationFrame(loop);
}

const generationWorker = new Worker('js/worker.js', { type: 'module' });
window.__generationWorker = generationWorker; // Expose for E2E testing
let preGeneratedPuzzle = null;
let isGenerating = false;
let pendingLevelStart = null; // Callback when generation finishes

// Handle worker messages
generationWorker.onmessage = function (e) {
    const { type, puzzle, error, reqId } = e.data;

    if (type === 'PUZZLE_GENERATED') {
        console.log(`[Worker] Puzzle generated for Level ${puzzle.level || '?'}`);
        generationRetryCount = 0; // Reset on success

        if (pendingLevelStart) {
            // We were waiting for this!
            const cb = pendingLevelStart;
            pendingLevelStart = null;
            document.getElementById('loading-overlay').classList.add('hidden');
            startLevelWithData(puzzle);
        } else {
            // Store for later
            preGeneratedPuzzle = puzzle;
        }
        isGenerating = false;
    } else if (type === 'ERROR') {
        console.error('[Worker] Generation error:', error);
        isGenerating = false;

        if (pendingLevelStart) {
            // Failed while user invalidly waited

            generationRetryCount++;
            if (generationRetryCount > MAX_GENERATION_RETRIES) {
                console.error('[Game] Max generation retries reached. Giving up.');
                document.querySelector('#loading-overlay h2').textContent = 'GENERATION FAILED';
                document.querySelector('#loading-overlay p').textContent = 'Please reload to try again.';
                // document.getElementById('loading-overlay').classList.add('hidden'); // Keep it visible to show error
                pendingLevelStart = null;
                isGenerating = false;
                return;
            }

            console.warn(`[Game] Generation failed (Attempt ${generationRetryCount}/${MAX_GENERATION_RETRIES}). Retrying...`);

            // Re-post message to worker for retry
            const config = getDifficultyParams(level);
            config.level = level;
            generationWorker.postMessage({ type: 'GENERATE', config, reqId: Date.now() });
        }
    }
};

function preGenerateNextLevel(nextLevel) {
    if (isGenerating) return; // Already busy

    // Don't pre-generate if we already have the right one
    if (preGeneratedPuzzle && preGeneratedPuzzle.level === nextLevel) return;

    console.log(`[Worker] Pre-generating Level ${nextLevel}...`);
    isGenerating = true;
    generationRetryCount = 0; // Reset for new attempt
    preGeneratedPuzzle = null; // Clear old

    const config = getDifficultyParams(nextLevel);
    // Tag with level for verification
    config.level = nextLevel;

    generationWorker.postMessage({
        type: 'GENERATE',
        config,
        reqId: Date.now()
    });
}

function startLevel() {
    // Check if we have a pre-generated puzzle for this level
    if (preGeneratedPuzzle && preGeneratedPuzzle.level === level) {
        console.log(`[Game] Using pre-generated puzzle for Level ${level}`);
        const p = preGeneratedPuzzle;
        preGeneratedPuzzle = null;
        startLevelWithData(p);

        // Immediately start working on the NEXT one
        preGenerateNextLevel(level + 1);
        return;
    }

    // Checking if we are currently generating THIS level
    // If so, show loading screen and wait
    if (isGenerating) {
        // We assume the worker is working on 'level' because we request it on level up
        // But strictly we should track request ID. For now assume sequential play.
        console.log(`[Game] Waiting for generation...`);
        document.getElementById('loading-overlay').classList.remove('hidden');
        pendingLevelStart = () => { }; // Marker that we are waiting
        return;
    }

    // Nothing pre-generated, and not generating. Start now.
    // This happens on first load, or jumping levels.
    console.log(`[Game] Cache miss. Generating Level ${level} now...`);
    document.getElementById('loading-overlay').classList.remove('hidden');
    // Prepare for generation
    // Reset error text in case we showed failure before
    document.querySelector('#loading-overlay h2').textContent = 'GENERATION';
    document.querySelector('#loading-overlay p').textContent = 'Constructing tight puzzle...';

    isGenerating = true;
    generationRetryCount = 0;
    pendingLevelStart = () => { };

    const config = getDifficultyParams(level);
    config.level = level;
    generationWorker.postMessage({ type: 'GENERATE', config, reqId: Date.now() });
}

function startLevelWithData(puzzleData) {
    // Clear previous game state to help GC
    if (game) {
        game.pieces = [];
        game.targetGrid = null;
    }

    // Force reset of board animations by clearing DOM (ensures sync)
    const boardEl = document.getElementById('game-board');
    if (boardEl) boardEl.innerHTML = '';

    try {
        // Update renderer with new board dimensions
        renderer.setBoardSize(puzzleData.boardRows, puzzleData.boardCols);
        game = new Game(puzzleData);
        window.game = game;
        window.renderer = renderer;
        window.getLevel = () => level;
        window.isWinning = () => isWinning;
        window.triggerCheckWin = () => onInteraction(true);
        window.__testForceHint = () => { lastInteractionTime = 0; };

        // Sort pieces by height (tallest first) for better bin packing
        const sortedPieces = [...game.pieces].sort((a, b) => {
            const heightA = getShapeDimensions(a.shape).height;
            const heightB = getShapeDimensions(b.shape).height;
            return heightB - heightA;
        });

        let currentX = 0;
        const dockY = getDockY(puzzleData.boardRows);
        const maxDockY = getMaxDockY(puzzleData.boardRows);
        let currentY = dockY;
        let rowMaxHeight = 0;

        const dockCols = puzzleData.boardCols; // Use board width for dock layout

        sortedPieces.forEach((p) => {
            const { width: pieceWidth, height: pieceHeight } = getShapeDimensions(p.shape);

            if (currentX + pieceWidth > dockCols) {
                currentX = 0;
                currentY += rowMaxHeight; // Pack rows tightly
                rowMaxHeight = 0;
            }

            // Ensure piece stays within visible dock area
            const maxY = maxDockY - pieceHeight + 1;
            const placementY = Math.min(currentY, maxY);

            game.updatePieceState(p.id, {
                x: currentX,
                y: placementY,
                rotation: 0
            });

            currentX += pieceWidth;
            rowMaxHeight = Math.max(rowMaxHeight, pieceHeight);
        });

    } catch (e) {
        console.error("Setup failed", e);
        // Fallback or alert?
        return;
    }

    renderer.clearEffects();
    renderer.hideHint();
    lastInteractionTime = Date.now();
    hintShown = false;
    isWinning = false;
    levelDisplay.innerText = `LEVEL ${level}`;
}

function onInteraction(checkWin = false) {
    lastInteractionTime = Date.now();
    needsRender = true; // Request render on any interaction

    if (hintShown) {
        renderer.hideHint();
        hintShown = false;
    }

    if (checkWin && game && !isWinning && game.checkWin()) {
        isWinning = true;
        sounds.playWin();
        haptics.vibrateWin();
        renderer.triggerWinEffect();
        needsRender = true; // Start confetti animation

        // INSTANT FLOW: Short delay then advance to next level
        setTimeout(() => {
            level++;
            if (level > maxLevel) {
                maxLevel = level;
                safeSetItem('polyfit-max-level', String(maxLevel));

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
        }, WIN_TRANSITION_DELAY);
    }
}

const inputHandler = new InputHandler(
    {
        get pieces() { return game ? game.pieces : []; },
        get targetGrid() { return game ? game.targetGrid : []; },
        updatePieceState: (id, s) => game && game.updatePieceState(id, s)
    },
    renderer,
    onInteraction
);
window.inputHandler = inputHandler;

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
    safeSetItem(THEME_STORAGE_KEY, theme.name);
    haptics.vibrateRotate(); // Subtle feedback
}


// Load saved theme
function loadTheme() {
    const savedTheme = safeGetItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        const index = THEMES.findIndex(t => t.name === savedTheme);
        if (index !== -1) {
            currentThemeIndex = index;
            applyTheme(THEMES[index]);
        }
    }
}

// Secret Hint Cheat Code
// Sequence: Title(1) -> Level(2) -> Title(3) -> Level(4)
function setupCheatCode() {
    const SEQUENCE = [
        { target: 'TITLE', count: 1 },
        { target: 'LEVEL', count: 2 },
        { target: 'TITLE', count: 3 },
        { target: 'LEVEL', count: 4 }
    ];

    let currentStep = 0;
    let currentCount = 0;
    let resetTimer = null;
    const RESET_DELAY = 1500;

    const titleEl = document.getElementById('title-display');
    const levelEl = document.getElementById('level-display');

    if (!titleEl || !levelEl) return;

    function reset() {
        currentStep = 0;
        currentCount = 0;
        if (resetTimer) clearTimeout(resetTimer);
    }

    function checkTap(targetName) {
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(reset, RESET_DELAY);

        const expected = SEQUENCE[currentStep];

        // Wrong target logic
        if (targetName !== expected.target) {
            // Special case: If tapping Title, checking if it starts a new sequence
            if (targetName === SEQUENCE[0].target) {
                currentStep = 0;
                currentCount = 1;
                haptics.vibrateRotate(); // Feedback for restart
                return;
            }
            reset();
            return;
        }

        // Correct target
        currentCount++;
        haptics.vibrateRotate(); // Feedback on every correct tap

        if (currentCount === expected.count) {
            // Step complete
            currentStep++;
            currentCount = 0;

            if (currentStep >= SEQUENCE.length) {
                // Sequence complete!
                console.log('Cheat Activated: Force Hint');
                lastInteractionTime = 0;
                haptics.vibrateWin();
                reset();
            }
        }
    }

    titleEl.addEventListener('click', (e) => { e.stopPropagation(); checkTap('TITLE'); });
    levelEl.addEventListener('click', (e) => { e.stopPropagation(); checkTap('LEVEL'); });
}

// Initialize
setupCheatCode();
loadTheme();
showStartScreen();

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
    // Show maxLevel + 20 locked levels for preview
    const showLevels = maxLevel + 20;

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
    levelSelectScreen.classList.add('hidden');
    // Skip tutorial when selecting from level menu
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
const btnMenu = document.getElementById('btn-menu');
if (btnMenu) {
    btnMenu.addEventListener('click', () => {
        showStartScreen();
    });
}

// Title tap to cycle themes (with guard against duplicate listeners)
const startTitle = document.querySelector('.start-modal .neon-text');
if (startTitle && !startTitle.hasAttribute('data-theme-listener')) {
    startTitle.setAttribute('data-theme-listener', 'true');
    startTitle.style.cursor = 'pointer';
    startTitle.addEventListener('click', cycleTheme);
}

loop();
