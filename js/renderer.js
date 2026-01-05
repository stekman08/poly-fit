import { COLORS, getShapeDimensions } from './shapes.js';
import { ConfettiSystem } from './effects/Confetti.js';
import { getDockY } from './config/constants.js';

/**
 * DOM-based Renderer - replaces Canvas rendering with CSS Grid
 * Benefits: automatic responsiveness, native touch handling, easier styling
 */
export class Renderer {
    constructor() {
        // DOM elements
        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('piece-dock');
        this.effectsCanvas = document.getElementById('effects-canvas');
        this.effectsCtx = this.effectsCanvas?.getContext('2d');

        // Board dimensions
        this.boardRows = 5;
        this.boardCols = 5;

        // Cell size (calculated on resize)
        this.cellSize = 50;

        // Track created piece elements
        this.pieceElements = new Map();

        // Ghost preview element
        this.ghostEl = null;

        // Hint element
        this.hintEl = null;

        // Confetti system (still uses canvas for particle effects)
        this.confetti = new ConfettiSystem();

        // Currently dragging
        this.draggingPieceId = null;

        // Resize handling
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    setBoardSize(rows, cols) {
        if (this.boardRows !== rows || this.boardCols !== cols) {
            this.boardRows = rows;
            this.boardCols = cols;
            this.resize();
        }
    }

    resize() {
        // Update CSS variables for grid sizing
        this.boardEl.style.setProperty('--rows', this.boardRows);
        this.boardEl.style.setProperty('--cols', this.boardCols);

        // Calculate cell size - uniform size everywhere (no scaling)
        // Target: ~40px cells, similar to what dock pieces were at scale(0.5)
        const containerWidth = Math.min(window.innerWidth, 600) - 40;
        const containerHeight = window.innerHeight * 0.30;
        const maxCellSize = 40;
        this.cellSize = Math.floor(Math.min(
            containerWidth / this.boardCols,
            containerHeight / this.boardRows,
            maxCellSize
        ));

        // Set on container so it's available for pieces in dock too
        this.boardEl.parentElement.style.setProperty('--cell-size', `${this.cellSize}px`);

        // Resize effects canvas
        if (this.effectsCanvas) {
            this.effectsCanvas.width = window.innerWidth;
            this.effectsCanvas.height = window.innerHeight;
        }
    }

    // Get board position for coordinate calculations
    getBoardRect() {
        return this.boardEl.getBoundingClientRect();
    }

    // Convert pixel position to grid coordinates
    pixelToGrid(px, py) {
        const rect = this.getBoardRect();
        return {
            x: (px - rect.left) / this.cellSize,
            y: (py - rect.top) / this.cellSize
        };
    }

    /**
     * Get the piece ID at the specified screen coordinates
     * Uses native DOM hit detection
     * @param {number} x - Client X coordinate
     * @param {number} y - Client Y coordinate
     * @returns {string|null} - Piece ID or null
     */
    getPieceAt(x, y) {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;

        // Traverse up to find the piece container
        const pieceEl = el.closest('.piece');
        if (pieceEl) {
            return pieceEl.dataset.pieceId;
        }
        return null;
    }

    // Get cell size for external calculations
    get gridSize() {
        return this.cellSize;
    }

    // Main draw function - updates DOM elements
    draw(game) {
        this.updateBoard(game.targetGrid);
        this.updatePieces(game.pieces);

        // Update confetti (still canvas-based)
        if (this.effectsCtx) {
            this.effectsCtx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
            this.confetti.update();
            this.confetti.draw(this.effectsCtx);
        }
    }

    // Create/update board grid cells
    updateBoard(grid) {
        if (!grid || grid.length === 0) return;

        const rows = grid.length;
        const cols = grid[0].length;

        // Only recreate if dimensions changed
        const currentCells = this.boardEl.querySelectorAll('.board-cell').length;
        if (currentCells !== rows * cols) {
            this.boardEl.innerHTML = '';

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    this.boardEl.appendChild(cell);
                }
            }
        }

        // Update cell states
        const cells = this.boardEl.querySelectorAll('.board-cell');
        let i = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = cells[i++];
                const value = grid[r][c];

                cell.classList.toggle('target', value === 1);
                cell.classList.toggle('hole', value === -1);
                cell.classList.toggle('outside', value === -2);
            }
        }
    }

    // Create/update piece elements
    updatePieces(pieces) {
        const dockY = getDockY(this.boardRows);

        pieces.forEach(piece => {
            let el = this.pieceElements.get(piece.id);

            // Create piece element if needed
            if (!el) {
                el = this.createPieceElement(piece);
                this.pieceElements.set(piece.id, el);
            }

            // Update piece shape and color
            this.updatePieceShape(el, piece);

            // Determine state
            // Use loose equality to be safe
            const isDragging = piece.id == this.draggingPieceId;

            if (isDragging) {
                // Debug log to verify renderer sees the drag state
                // console.log('Renderer: dragging piece', piece.id);
            }

            const inDock = piece.y >= dockY;
            const onBoard = !inDock && !isDragging;

            // Update classes
            el.classList.toggle('in-dock', inDock && !isDragging);
            el.classList.toggle('on-board', onBoard);
            el.classList.toggle('dragging', isDragging);

            // Position piece using CSS custom properties for cleaner DOM-based rendering
            el.style.setProperty('--piece-x', piece.x);
            el.style.setProperty('--piece-y', piece.y);

            if (onBoard) {
                // On board: CSS handles positioning via custom properties
                el.style.position = 'absolute';
                el.style.zIndex = '';

                if (el.parentElement !== this.boardEl) {
                    this.boardEl.appendChild(el);
                }
            } else if (isDragging) {
                // Dragging: use fixed position relative to viewport
                // IMPORTANT: Do NOT reparent the element - moving it in the DOM during
                // a touch gesture breaks touch event tracking.
                const rect = this.getBoardRect();
                el.style.setProperty('--board-left', `${rect.left}px`);
                el.style.setProperty('--board-top', `${rect.top}px`);
                el.style.position = 'fixed';
                el.style.zIndex = '1000';
            } else {
                // In dock: relative positioning handled by flexbox
                el.style.position = 'relative';
                el.style.zIndex = '';

                if (el.parentElement !== this.dockEl) {
                    this.dockEl.appendChild(el);
                }
            }
        });

        // Remove orphaned piece elements
        for (const [id, el] of this.pieceElements) {
            if (!pieces.find(p => p.id === id)) {
                el.remove();
                this.pieceElements.delete(id);
            }
        }
    }

    createPieceElement(piece) {
        const el = document.createElement('div');
        el.className = 'piece';
        el.dataset.pieceId = piece.id;
        el.style.color = piece.color || COLORS[0];
        return el;
    }

    updatePieceShape(el, piece) {
        const shape = piece.currentShape;
        const dims = getShapeDimensions(shape);
        const color = piece.color || COLORS[0];

        // Create a signature for the current shape to detect changes
        // This prevents unnecessary DOM rebuilds which break touch tracking
        const shapeSignature = `${dims.width}x${dims.height}:${shape.map(b => `${b.x},${b.y}`).sort().join(';')}:${color}`;

        // Update grid template - no gap to match board cells exactly
        el.style.display = 'grid';
        el.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        el.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        el.style.width = `calc(var(--cell-size) * ${dims.width})`;
        el.style.height = `calc(var(--cell-size) * ${dims.height})`;
        el.style.color = color;

        // Only rebuild DOM if shape has actually changed
        // Rebuilding during touchstart breaks Chrome/CDP touch tracking
        if (el.dataset.shapeSignature === shapeSignature) {
            return; // Shape unchanged, skip DOM rebuild
        }
        el.dataset.shapeSignature = shapeSignature;

        // Clear and rebuild blocks
        el.innerHTML = '';

        // Create a grid of the shape
        for (let y = 0; y < dims.height; y++) {
            for (let x = 0; x < dims.width; x++) {
                const hasBlock = shape.some(b => b.x === x && b.y === y);

                if (hasBlock) {
                    const block = document.createElement('div');
                    block.className = 'piece-block';
                    block.style.setProperty('--piece-color', color);
                    el.appendChild(block);
                } else {
                    // Empty spacer for grid alignment - must be completely invisible
                    const spacer = document.createElement('div');
                    spacer.style.background = 'transparent';
                    spacer.style.border = 'none';
                    spacer.style.visibility = 'hidden';
                    el.appendChild(spacer);
                }
            }
        }
    }

    // Ghost preview for drag placement
    setGhostPreview(shape, x, y, color, isValid = true) {
        if (!this.ghostEl) {
            this.ghostEl = document.createElement('div');
            this.ghostEl.className = 'ghost-preview';
            this.boardEl.appendChild(this.ghostEl);
        }

        const dims = getShapeDimensions(shape);
        this.ghostEl.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        this.ghostEl.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        this.ghostEl.style.color = color;
        this.ghostEl.style.left = `${x * this.cellSize}px`;
        this.ghostEl.style.top = `${y * this.cellSize}px`;
        this.ghostEl.style.opacity = isValid ? '0.4' : '0.2';

        // Rebuild blocks
        this.ghostEl.innerHTML = '';
        for (let py = 0; py < dims.height; py++) {
            for (let px = 0; px < dims.width; px++) {
                const hasBlock = shape.some(b => b.x === px && b.y === py);
                if (hasBlock) {
                    const block = document.createElement('div');
                    block.className = 'piece-block';
                    block.style.backgroundColor = isValid ? color : '#888';
                    this.ghostEl.appendChild(block);
                } else {
                    const spacer = document.createElement('div');
                    spacer.style.background = 'transparent';
                    spacer.style.border = 'none';
                    spacer.style.visibility = 'hidden';
                    this.ghostEl.appendChild(spacer);
                }
            }
        }

        this.ghostEl.style.display = 'grid';
    }

    clearGhostPreview() {
        if (this.ghostEl) {
            this.ghostEl.style.display = 'none';
        }
    }

    // Hint display
    showHint(hintData) {
        const { x, y, shape, color } = hintData;

        if (!this.hintEl) {
            this.hintEl = document.createElement('div');
            this.hintEl.className = 'hint-overlay';
            this.boardEl.appendChild(this.hintEl);
        }

        const dims = getShapeDimensions(shape);
        this.hintEl.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        this.hintEl.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        this.hintEl.style.color = color;
        this.hintEl.style.left = `${x * this.cellSize}px`;
        this.hintEl.style.top = `${y * this.cellSize}px`;

        // Rebuild blocks
        this.hintEl.innerHTML = '';
        for (let py = 0; py < dims.height; py++) {
            for (let px = 0; px < dims.width; px++) {
                const hasBlock = shape.some(b => b.x === px && b.y === py);
                if (hasBlock) {
                    const block = document.createElement('div');
                    block.className = 'piece-block';
                    this.hintEl.appendChild(block);
                } else {
                    const spacer = document.createElement('div');
                    spacer.style.background = 'transparent';
                    spacer.style.border = 'none';
                    spacer.style.visibility = 'hidden';
                    this.hintEl.appendChild(spacer);
                }
            }
        }

        this.hintEl.style.display = 'grid';
    }

    hideHint() {
        if (this.hintEl) {
            this.hintEl.style.display = 'none';
        }
    }

    // Effects
    triggerWinEffect() {
        if (this.effectsCanvas) {
            const rect = this.boardEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            this.confetti.burst(centerX, centerY, 100);
        }
    }

    clearEffects() {
        this.confetti.clear();
        if (this.effectsCtx) {
            this.effectsCtx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
        }
    }

    // Get piece element by ID (for input handler)
    getPieceElement(pieceId) {
        return this.pieceElements.get(pieceId);
    }
}
